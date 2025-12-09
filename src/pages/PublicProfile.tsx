// src/pages/PublicProfile.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  UserPlus, 
  MessageCircle, 
  Star, 
  Users,
  Image as ImageIcon,
  UserMinus,
  Clock,
  X,
  Mail
} from 'lucide-react';
import { PostCard } from '@/components/dashboard/PostCard';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  contact_number?: string;
  address?: string;
  bio?: string;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  profiles: Profile;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false);
  const [mutualFriends, setMutualFriends] = useState<Profile[]>([]);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; status: string; direction: 'sent' | 'received' } | null>(null);

  // Redirect if viewing own profile
  useEffect(() => {
    if (currentUser?.id === userId) {
      navigate('/profile', { replace: true });
    }
  }, [currentUser, userId, navigate]);

  useEffect(() => {
    if (userId && currentUser) {
      fetchAllData();
    }
  }, [userId, currentUser]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPublicProfile(),
        fetchPosts(),
        fetchMedia(),
        fetchFriends(),
        fetchRatings(),
        fetchFriendsCount(),
        checkFriendship(),
        fetchMutualFriends(),
        checkPendingRequest()
      ]);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      toast({ title: "Not Found", description: "Profile not found", variant: "destructive" });
      navigate('/dashboard');
      return;
    }
    setProfile(data);
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
        profiles:profiles!posts_user_id_fkey(full_name, avatar_url)
      `)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    setPosts(data || []);
  };

  const fetchMedia = async () => {
    const { data } = await supabase
      .from('posts')
      .select('image_url, media_type')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .not('image_url', 'is', null);

    if (!data) return;
    const items = data.map(item => {
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(item.image_url!);
      return { url: publicUrl, type: item.media_type || 'image/jpeg' };
    });
    setMedia(items);
  };

  const fetchFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('friend_id, profiles!friendships_friend_id_fkey(full_name, avatar_url)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    setFriends(data || []);
  };

  const fetchFriendsCount = async () => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');
    setFriendsCount(count || 0);
  };

  const fetchRatings = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('task_ratings')
      .select(`
        id,
        rating,
        comment,
        created_at,
        rater:profiles!rater_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('rated_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ratings:', error);
      toast({ title: "Error", description: "Could not load ratings", variant: "destructive" });
      return;
    }

    if (data && data.length > 0) {
      const avg = data.reduce((sum, r: any) => sum + r.rating, 0) / data.length;
      setAverageRating(Math.round(avg * 10) / 10);
      setTotalRatings(data.length);
      setRatings(data);
    } else {
      setAverageRating(0);
      setTotalRatings(0);
      setRatings([]);
    }
  };

  const checkFriendship = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .or(`
        and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),
        and(user_id.eq.${userId},friend_id.eq.${currentUser.id})
      `)
      .eq('status', 'accepted')
      .maybeSingle();
    setIsFriend(!!data);
  };

  const fetchMutualFriends = async () => {
    if (!currentUser) return;

    // Get current user's friends
    const { data: currentUserFriends } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', currentUser.id)
      .eq('status', 'accepted');

    const currentFriendIds = currentUserFriends?.map(f => f.friend_id) || [];

    // Get profile user's friends
    const { data: profileUserFriends } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const profileFriendIds = profileUserFriends?.map(f => f.friend_id) || [];

    // Find mutual friends
    const mutualIds = currentFriendIds.filter(id => profileFriendIds.includes(id));

    if (mutualIds.length > 0) {
      const { data: mutualProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', mutualIds)
        .limit(5); // Limit to 5 for display

      setMutualFriends(mutualProfiles || []);
    } else {
      setMutualFriends([]);
    }
  };

  const checkPendingRequest = async () => {
    if (!currentUser) return;

    // Check if current user sent a request to profile user
    const { data: sentRequest } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('user_id', currentUser.id)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (sentRequest) {
      setPendingRequest({ id: sentRequest.id, status: 'pending', direction: 'sent' });
      return;
    }

    // Check if profile user sent a request to current user
    const { data: receivedRequest } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('user_id', userId)
      .eq('friend_id', currentUser.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (receivedRequest) {
      setPendingRequest({ id: receivedRequest.id, status: 'pending', direction: 'received' });
      return;
    }

    setPendingRequest(null);
  };

  const handleAddFriend = async () => {
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: currentUser?.id, friend_id: userId, status: 'pending' });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sent!", description: "Friend request sent" });
      checkFriendship();
      checkPendingRequest();
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest || pendingRequest.direction !== 'sent') return;

    try {
      const { error } = await supabase.from('friendships').delete().eq('id', pendingRequest.id);
      if (error) throw error;

      toast({ title: 'Request cancelled' });
      setPendingRequest(null);
      checkPendingRequest(); // Refresh
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const goToChat = () => {
    // Create a consistent chat room ID (sorted to avoid duplicates)
    const roomId = [currentUser?.id, userId].sort().join('_');
    navigate(`/messages/${roomId}`, { state: { recipientId: userId, recipientName: profile?.full_name } });
  };

  const handleUnfriend = async () => {
    if (!currentUser || !userId) return;

    try {
      // Delete both directions of the friendship using an OR condition
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`);

      if (error) throw error;

      toast({
        title: 'Friend removed',
        description: `${profile?.full_name} is no longer your friend.`,
      });

      setIsFriend(false);
      fetchFriendsCount();
      fetchMutualFriends();
      fetchFriends();
      setUnfriendDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove friend.',
        variant: 'destructive',
      });
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#2ec2b3] rounded-full border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-teal-50 rounded-xl">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold text-[#2ec2b3]">Profile</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Hero Card */}
          <Card className="overflow-hidden border border-[#2ec2b3]/20 bg-white rounded-2xl shadow-lg">
            <div className="h-24 bg-gradient-to-r from-[#2ec2b3] to-cyan-500" /> 

            <div className="relative px-6 pb-8">
              {/* Avatar positioned slightly higher */}
              <div className="absolute -top-10 left-6"> 
                <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg border-2 border-white">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback className="bg-[#2ec2b3] text-white text-2xl font-bold">
                    {profile.full_name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Primary Content Container: Flex for alignment on smaller screens */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start pt-16">
                
                {/* Profile Name and Info Block */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900 truncate">{profile.full_name}</h2>
                  
                  {/* Friends Count and Rating */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <p className="text-[#2ec2b3] font-semibold text-base">{friendsCount} Friends</p>
                    
                    {totalRatings > 0 && (
                      <>
                        <span className="text-gray-600">•</span>
                        <div className="flex items-center gap-1 text-gray-700">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-sm">{averageRating} ({totalRatings} reviews)</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Mutual Friends and Pending Request Status */}
                  <div className="mt-4 space-y-2">
                    {mutualFriends.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {mutualFriends.length} mutual friend{mutualFriends.length > 1 ? 's' : ''}: {mutualFriends.map(f => f.full_name).join(', ')}
                        </span>
                      </div>
                    )}
                    {pendingRequest && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          {pendingRequest.direction === 'sent' ? 'Request Sent' : 'Request Received'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4 sm:mt-0">
                  {isFriend ? (
                    <Button
                      onClick={() => setUnfriendDialogOpen(true)}
                      variant="outline"
                      className="rounded-full px-6 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <UserMinus className="h-5 w-5 mr-2" />
                      Unfriend
                    </Button>
                  ) : pendingRequest?.direction === 'sent' ? (
                    <Button
                      onClick={handleCancelRequest}
                      variant="outline"
                      className="rounded-full px-6 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-5 w-5 mr-2" />
                      Cancel Request
                    </Button>
                  ) : pendingRequest?.direction === 'received' ? (
                    <Button
                      disabled
                      className="rounded-full px-6 font-medium shadow-md bg-gray-300 text-gray-600 cursor-not-allowed"
                    >
                      <Clock className="h-5 w-5 mr-2" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleAddFriend()}
                      className="rounded-full px-6 font-medium shadow-md bg-[#2ec2b3] hover:bg-[#28a399] text-white"
                    >
                      <UserPlus className="h-5 w-5 mr-2" />
                      Add Friend
                    </Button>
                  )}

                  <Button
                    onClick={goToChat}
                    variant="outline"
                    className="rounded-full px-6 border-[#2ec2b3] text-[#2ec2b3] hover:bg-teal-50"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Message
                  </Button>
                </div>
              </div>

              {/* Profile Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-gray-700">
                {profile.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </p>
                  </div>
                )}
                {profile.contact_number && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-semibold">{profile.contact_number}</p>
                  </div>
                )}
                {profile.bio && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Bio</p>
                    <p className="font-semibold">{profile.bio}</p>
                  </div>
                )}
                {profile.address && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-semibold">{profile.address}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white rounded-xl shadow p-1 mb-6">
              <TabsTrigger value="posts" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
                Posts
              </TabsTrigger>
              <TabsTrigger value="media" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
                Media
              </TabsTrigger>
              <TabsTrigger value="friends" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
                Friends
              </TabsTrigger>
              <TabsTrigger value="ratings" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
                Ratings
              </TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-5">
              {posts.length === 0 ? (
                <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                  <p className="text-gray-500 text-lg">No posts yet</p>
                </Card>
              ) : (
                posts.map(post => {
                  const url = post.image_url ? supabase.storage.from('posts').getPublicUrl(post.image_url).data.publicUrl : null;
                  
                  return (
                    <Card key={post.id} className="overflow-hidden rounded-xl shadow hover:shadow-lg transition">
                      <CardContent className="p-6">
                        <p className="mb-4">{post.content}</p>
                        {url && (
                          post.media_type?.startsWith('video/') ? (
                            <video controls className="w-full rounded-xl max-h-[30rem] object-contain bg-black">
                              <source src={url} type={post.media_type || 'video/mp4'} />
                            </video>
                          ) : (
                            <img
                              src={url}
                              className="w-full rounded-xl max-h-[30rem] object-cover"
                              loading="lazy"
                              alt="Post"
                            />
                          )
                        )}
                        <p className="text-sm text-gray-500 text-right mt-4">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media">
              {media.length === 0 ? (
                <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                  <p className="text-gray-500 text-lg">No photos or videos yet</p>
                </Card>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {media.map((item, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-black shadow-lg group cursor-pointer">
                      {item.type.startsWith('video/') ? (
                        <video controls className="w-full h-full object-cover">
                          <source src={item.url} type={item.type} />
                        </video>
                      ) : (
                        <img 
                          src={item.url} 
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                          alt="Media" 
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Friends Tab */}
            <TabsContent value="friends">
              {friends.length === 0 ? (
                <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                  <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No friends yet</p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {friends.map(f => (
                    <div key={f.friend_id} className="text-center p-4 bg-white rounded-xl shadow hover:shadow-lg transition">
                      <Avatar className="h-20 w-20 mx-auto mb-3 ring-4 ring-[#2ec2b3]/20">
                        <AvatarImage src={f.profiles.avatar_url} />
                        <AvatarFallback className="bg-[#2ec2b3] text-white">
                          {f.profiles.full_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium truncate">{f.profiles.full_name}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-3 w-full"
                        onClick={() => navigate(`/profile/${f.friend_id}`)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" /> View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Ratings Tab */}
            <TabsContent value="ratings" className="space-y-5">
              {totalRatings === 0 ? (
                <Card className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-0">
                  <Star className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-xl font-medium text-gray-600">No ratings yet</p>
                  <p className="text-sm text-gray-400 mt-2">Ratings will appear when people rate your posts or services</p>
                </Card>
              ) : (
                <>
                  {/* Summary Card */}
                  <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      {renderStars(Math.round(averageRating))}
                      <span className="text-5xl font-bold text-[#2ec2b3]">{averageRating}</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-700">
                      out of 5.0 • {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
                    </p>
                  </Card>

                  {/* Individual Ratings */}
                  <div className="space-y-4">
                    {ratings.map((r) => (
                      <Card key={r.id} className="p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 ring-4 ring-[#2ec2b3]/10">
                              <AvatarImage src={r.rater?.avatar_url || ''} />
                              <AvatarFallback className="bg-[#2ec2b3] text-white">
                                {r.rater?.full_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-gray-900">{r.rater?.full_name || 'Anonymous'}</p>
                              <div className="flex items-center gap-1 mt-1">
                                {renderStars(r.rating)}
                                <span className="text-sm text-gray-600 ml-2">{r.rating}.0</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(r.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>

                        {r.comment && (
                          <p className="text-gray-700 italic pl-16">"{r.comment}"</p>
                        )}
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Unfriend Confirmation Dialog */}
      <AlertDialog open={unfriendDialogOpen} onOpenChange={setUnfriendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{profile?.full_name}</strong> from your friends list?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnfriend} className="bg-red-600 hover:bg-red-700">
              Remove Friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PublicProfile;