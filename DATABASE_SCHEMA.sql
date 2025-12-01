-- ==========================================
-- COMPLETE DATABASE SCHEMA FOR COMMU-LINK-NATION
-- Created from Lovable migrations
-- Execute this entire file to set up your database
-- ==========================================

-- ==========================================
-- 1. CREATE ENUMS
-- ==========================================

CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.post_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.approach_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Profiles table (links to auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  avatar_url TEXT,
  skills TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  media_type TEXT,
  status post_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post comments table
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Post likes table
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payment_amount DECIMAL(10, 2),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_address TEXT,
  status task_status NOT NULL DEFAULT 'open',
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task ratings table
CREATE TABLE public.task_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  rated_user_id UUID NOT NULL,
  rater_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(task_id, rater_id)
);

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Direct approaches table (ticketing/support system)
CREATE TABLE public.direct_approaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  status approach_status NOT NULL DEFAULT 'open',
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approach messages table for conversations
CREATE TABLE public.approach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approach_id UUID REFERENCES public.direct_approaches(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_approaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approach_messages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. CREATE FUNCTIONS
-- ==========================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, contact_number, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'contact_number',
    NEW.raw_user_meta_data->>'address'
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- 5. CREATE TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_direct_approaches_updated_at
  BEFORE UPDATE ON public.direct_approaches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Profiles RLS Policies
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- User Roles RLS Policies
CREATE POLICY "User roles are viewable by everyone" 
  ON public.user_roles FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can insert user roles" 
  ON public.user_roles FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Posts RLS Policies
CREATE POLICY "Approved posts are viewable by everyone" 
  ON public.posts FOR SELECT 
  USING (status = 'approved' OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create posts" 
  ON public.posts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
  ON public.posts FOR UPDATE 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posts" 
  ON public.posts FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'));

-- Post Comments RLS Policies
CREATE POLICY "Anyone can view comments" 
  ON public.post_comments FOR SELECT 
  USING (true);

CREATE POLICY "Users can create comments" 
  ON public.post_comments FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
  ON public.post_comments FOR DELETE 
  USING (auth.uid() = user_id);

-- Post Likes RLS Policies
CREATE POLICY "Anyone can view likes" 
  ON public.post_likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can create likes" 
  ON public.post_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
  ON public.post_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Tasks RLS Policies
CREATE POLICY "Tasks are viewable by everyone" 
  ON public.tasks FOR SELECT 
  USING (true);

CREATE POLICY "Users can create tasks" 
  ON public.tasks FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own tasks or accepted tasks" 
  ON public.tasks FOR UPDATE 
  USING (auth.uid() = creator_id OR auth.uid() = accepted_by);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = creator_id);

-- Task Ratings RLS Policies
CREATE POLICY "Anyone can view ratings" 
  ON public.task_ratings FOR SELECT 
  USING (true);

CREATE POLICY "Task creators can create ratings" 
  ON public.task_ratings FOR INSERT 
  WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE id = task_id 
      AND creator_id = auth.uid()
      AND status = 'completed'
    )
  );

-- Friendships RLS Policies
CREATE POLICY "Users can view their own friendships" 
  ON public.friendships FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests" 
  ON public.friendships FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of" 
  ON public.friendships FOR UPDATE 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Messages RLS Policies
CREATE POLICY "Users can view their own messages" 
  ON public.messages FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages they received" 
  ON public.messages FOR UPDATE 
  USING (auth.uid() = receiver_id);

-- Direct Approaches RLS Policies
CREATE POLICY "Users can view their own approaches" 
  ON public.direct_approaches FOR SELECT 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create approaches" 
  ON public.direct_approaches FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update approaches" 
  ON public.direct_approaches FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

-- Approach Messages RLS Policies
CREATE POLICY "Users can view messages for their approaches" 
  ON public.approach_messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_approaches 
      WHERE id = approach_id 
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users and admins can create messages" 
  ON public.approach_messages FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.direct_approaches 
      WHERE id = approach_id 
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- ==========================================
-- 7. STORAGE BUCKETS (if using Supabase)
-- ==========================================

-- Note: Storage buckets are created separately in Supabase.
-- For your own database setup, you may store files in your file system
-- and store paths/URLs in the database.
-- 
-- Required buckets (if using Supabase S3-like storage):
-- 1. 'avatars' (public)
-- 2. 'posts' (public)
-- 3. 'message-media' (private)
-- 4. 'approach-media' (private)

-- ==========================================
-- END OF SCHEMA
-- ==========================================
