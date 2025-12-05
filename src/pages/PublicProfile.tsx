// src/pages/PublicProfile.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, UserPlus, MessageCircle, Star } from 'lucide-react';
import { PostCard }from '@/components/dashboard/PostCard';

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  // Check 1: Redirect user if they are trying to view their own public profile
  if (currentUser && userId && currentUser.id === userId) {
   navigate('/profile', { replace: true });
   return;
  }

  if (userId) {
   fetchPublicProfile();
   fetchFriendsCount();
   fetchRatings();
   checkFriendship();
   fetchPosts();
  }
  
  // Add currentUser to the dependency array
 }, [userId, currentUser, navigate]);

  const fetchPublicProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      navigate('/404');
    } else {
      setProfile(data);
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        image_url,
        media_type,
        user_id,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    setPosts(data || []);
  };

  const fetchFriendsCount = async () => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted');

    setFriendsCount(count || 0);
  };

  const fetchRatings = async () => {
    const { data } = await supabase
      .from('task_ratings')
      .select('rating')
      .eq('rated_user_id', userId);

    if (data && data.length > 0) {
      const avg = data.reduce((a, b) => a + b.rating, 0) / data.length;
      setAverageRating(Math.round(avg * 10) / 10);
      setTotalRatings(data.length);
    }
  };

  const checkFriendship = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`)
      .eq('status', 'accepted')
      .maybeSingle();

    setIsFriend(!!data);
  };

  const handleAddFriend = async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: currentUser.id,
        friend_id: userId,
        status: 'pending'
      });

    if (!error) {
      alert('Friend request sent!');
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-12 w-12 border-4 border-[#2ec2b3] rounded-full border-t-transparent" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-[#2ec2b3]">Profile</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Profile Hero */}
      <div className="relative">
        <div className="h-40 bg-gradient-to-br from-[#2ec2b3] to-cyan-500" />
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
          <Avatar className="h-32 w-32 ring-8 ring-white shadow-2xl">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="text-4xl bg-[#2ec2b3] text-white">
              {profile?.full_name[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="pt-20 px-4 text-center">
        <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
        <div className="flex items-center justify-center gap-4 mt-3 text-gray-600">
          <span>{friendsCount} Friends</span>
          {totalRatings > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                {renderStars(Math.round(averageRating))}
                <span className="font-medium">{averageRating} ({totalRatings})</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center mt-6">
          <Button 
            onClick={handleAddFriend}
            className="bg-[#2ec2b3] hover:bg-[#28a399] rounded-full px-8"
            disabled={isFriend}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {isFriend ? 'Friends' : 'Add Friend'}
          </Button>
          <Button variant="outline" className="rounded-full px-8">
            <MessageCircle className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>
      </div>

      {/* Posts Tab */}
      <div className="mt-8 px-4">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-1 bg-transparent border-b">
            <TabsTrigger value="posts" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2ec2b3] rounded-none">
              Posts
            </TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-6 space-y-4">
            {posts.length === 0 ? (
              <Card className="text-center py-16 bg-gray-50 rounded-2xl">
                <p className="text-gray-500">No posts yet</p>
              </Card>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id || ''}
                  onPostUpdate={fetchPosts}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PublicProfile;