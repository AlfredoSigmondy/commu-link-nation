import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Check, X, Users, Sparkles, LogOut, UserMinus, Search } from 'lucide-react';
import { SignOutDialog } from '@/components/SignOutDialog';
import { NotificationBell } from '@/components/NotificationBell';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  profiles: Profile;
}

const Friends = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false);
  const [userToUnfriend, setUserToUnfriend] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
      fetchSentRequests();

      const channel = supabase
        .channel('friendships-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
          fetchFriends();
          fetchPendingRequests();
          fetchSentRequests();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles!friendships_friend_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', user?.id)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }
    setFriends(data as Friendship[]);
  };

  const fetchPendingRequests = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles!friendships_user_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('friend_id', user?.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending requests:', error);
      return;
    }
    setPendingRequests(data as Friendship[]);
  };

  const fetchSentRequests = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles!friendships_friend_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', user?.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching sent requests:', error);
      return;
    }
    setSentRequests(data as Friendship[]);
  };

  const fetchSuggestions = async () => {
    if (!user?.id) return;

    const { data: outgoing } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'accepted']);

    const outgoingIds = outgoing?.map(o => o.friend_id) || [];
    const incomingIds = pendingRequests.map(r => r.user_id);
    const friendIds = friends.map(f => f.friend_id);

    const excludeIds = new Set([
      user.id,
      ...friendIds,
      ...incomingIds,
      ...outgoingIds,
    ]);

    // Construct the NOT IN query string
    const excludeIdsString = Array.from(excludeIds).join(',');
    const exclusionFilter = excludeIdsString.length > 0 ? `id.not.in.(${excludeIdsString})` : '';

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .limit(8)
      .or(exclusionFilter); // Apply the exclusion filter

    if (error) {
      console.error('Error fetching suggestions:', error);
      return;
    }

    setSuggestions(data || []);
  };

  useEffect(() => {
    fetchSuggestions();
  }, [friends, pendingRequests, sentRequests]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .ilike('full_name', `%${searchQuery}%`)
      .neq('id', user?.id)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return;
    }

    // Filter out users who are already friends or have a pending request
    const existingFriendIds = new Set([
      ...friends.map(f => f.friend_id),
      ...pendingRequests.map(r => r.user_id),
      ...sentRequests.map(r => r.friend_id),
    ]);

    const filteredData = data.filter(profile => !existingFriendIds.has(profile.id));

    setSearchResults(filteredData);
  };

  const handleSendRequest = async (friendId: string) => {
    try {
      const { error } = await supabase.from('friendships').insert({
        user_id: user?.id,
        friend_id: friendId,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Friend request sent!',
        description: 'They’ll be notified.',
      });

      setSearchResults(prevResults => prevResults.filter(p => p.id !== friendId)); // Remove from search results
      setSearchQuery('');
      fetchSuggestions();
      fetchSentRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', requestId);
      if (error) throw error;

      toast({ title: 'Request cancelled' });
      fetchSentRequests();
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      // 1. Update the incoming request's status to accepted
      const { error: updateError } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. Find the request details to create the reciprocal (outgoing) entry
      const request = pendingRequests.find((r) => r.id === requestId);
      if (request) {
        // 3. Create the reciprocal entry (User A -> User B)
        const { error: insertError } = await supabase.from('friendships').insert({
          user_id: user?.id,
          friend_id: request.user_id, // request.user_id is the user who sent the original request
          status: 'accepted',
        });
        if (insertError) throw insertError;
      }

      toast({ title: 'You’re now friends!' });
      // Re-fetch all lists to update UI
      fetchFriends();
      fetchPendingRequests();
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', requestId);
      if (error) throw error;

      toast({ title: 'Request rejected' });
      fetchPendingRequests();
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Unfriend function
  const handleUnfriend = async () => {
    if (!userToUnfriend) return;

    try {
      // Delete both directions of the friendship using an OR condition
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user?.id},friend_id.eq.${userToUnfriend.id}),and(user_id.eq.${userToUnfriend.id},friend_id.eq.${user?.id})`);

      if (error) throw error;

      toast({
        title: 'Friend removed',
        description: `${userToUnfriend.name} is no longer your friend.`,
      });

      fetchFriends();
      fetchSuggestions();
      setUnfriendDialogOpen(false);
      setUserToUnfriend(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove friend.',
        variant: 'destructive',
      });
    }
  };

  const openUnfriendDialog = (friendId: string, friendName: string) => {
    setUserToUnfriend({ id: friendId, name: friendName });
    setUnfriendDialogOpen(true);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
        <p className="mt-3 text-[#2ec2b3] font-semibold text-sm">Loading...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
        {/* Top Navigation */}
        <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-12 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-teal-50 rounded-xl h-9 w-9">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-lg sm:text-2xl font-bold text-[#2ec2b3] flex items-center gap-2">
                  <Users className="h-5 w-5 sm:h-7 sm:w-7" />
                  <span className="hidden sm:inline">Friends</span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors h-9 w-9"
                  onClick={() => setShowSignOutDialog(true)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />

        <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* People You May Know */}
          {suggestions.length > 0 && (
            <Card className="mb-4 sm:mb-6 border border-[#2ec2b3]/20 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-[#2ec2b3] text-base sm:text-lg">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  People You May Know
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Connect with others in your community</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 p-3 sm:p-6 pt-0">
                {suggestions.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Avatar className="h-10 w-10 ring-2 ring-[#2ec2b3]/20 flex-shrink-0">
                        <AvatarImage src={person.avatar_url || ''} />
                        <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">
                          {person.full_name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{person.full_name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">Suggested</p>
                      </div>
                    </div>
                    <Button size="icon" onClick={() => handleSendRequest(person.id)} className="bg-[#2ec2b3] hover:bg-[#28a399] text-white h-8 w-8 flex-shrink-0">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 sm:mb-6 bg-white rounded-xl shadow h-auto p-1">
              <TabsTrigger value="friends" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg text-xs sm:text-sm py-2">
                Friends <Badge className="ml-1 bg-white/20 text-xs hidden sm:inline">{friends.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg text-xs sm:text-sm py-2">
                Sent
                {sentRequests.length > 0 && <Badge className="ml-1 bg-orange-500 text-xs">{sentRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg text-xs sm:text-sm py-2">
                Add
              </TabsTrigger>
              <TabsTrigger value="received" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg text-xs sm:text-sm py-2">
                Received
                {pendingRequests.length > 0 && <Badge className="ml-1 bg-red-500 text-xs">{pendingRequests.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* My Friends */}
            <TabsContent value="friends">
              <Card className="border-gray-100">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Your Friends</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
                  {friends.length === 0 ? (
                    <div className="text-center py-10 sm:py-16 text-gray-500">
                      <Users className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm sm:text-lg">No friends yet. Start connecting!</p>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50/70 rounded-xl hover:bg-teal-50 transition-colors">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={friend.profiles.avatar_url || ''} />
                            <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">
                              {friend.profiles.full_name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-gray-800 text-sm truncate">{friend.profiles.full_name}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate('/messages')} className="text-xs h-8">
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openUnfriendDialog(friend.friend_id, friend.profiles.full_name)}
                            className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sent Requests (Fixed & Completed) */}
            <TabsContent value="requests">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Sent Requests</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Requests you've sent that are pending acceptance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
                  {sentRequests.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <Users className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm">No pending sent requests.</p>
                    </div>
                  ) : (
                    sentRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-xl border border-orange-200">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={request.profiles.avatar_url || ''} />
                            <AvatarFallback className="bg-orange-500 text-white text-sm">
                              {request.profiles.full_name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{request.profiles.full_name}</p>
                            <p className="text-xs text-orange-600">Request Sent</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelRequest(request.id)}
                          className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Cancel
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Add Friend (Completed) */}
            <TabsContent value="add">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Find People</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Search by name to find users.</CardDescription>
                  <form onSubmit={handleSearch} className="flex gap-2 mt-4">
                    <Input
                      type="text"
                      placeholder="Search full name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" className="bg-[#2ec2b3] hover:bg-[#28a399]" size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </form>
                </CardHeader>
                <CardContent className="space-y-3 p-3 sm:p-6 pt-0">
                  {searchQuery && searchResults.length === 0 ? (
                    <p className="text-center py-6 text-gray-500 text-sm">No users found matching "{searchQuery}"</p>
                  ) : (
                    searchResults.map((person) => (
                      <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50/70 rounded-xl hover:bg-teal-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={person.avatar_url || ''} />
                            <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">
                              {person.full_name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-gray-800 text-sm truncate">{person.full_name}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSendRequest(person.id)}
                          className="bg-[#2ec2b3] hover:bg-[#28a399] text-white h-8"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Received Requests */}
            <TabsContent value="received">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Incoming Requests</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">People who want to connect with you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 sm:p-6 pt-0">
                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-16 w-16 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm">No incoming requests</p>
                    </div>
                  ) : (
                    pendingRequests.map((request) => (
                      <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-[#2ec2b3]/20">
                        <div className="flex items-center gap-3 mb-3 sm:mb-0">
                          <Avatar className="h-12 w-12 ring-2 ring-[#2ec2b3]/30">
                            <AvatarImage src={request.profiles.avatar_url || ''} />
                            <AvatarFallback className="bg-[#2ec2b3] text-white">
                              {request.profiles.full_name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-gray-900">{request.profiles.full_name}</p>
                            <p className="text-xs text-gray-600">Wants to be your friend</p>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-stretch sm:justify-end">
                          <Button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="flex-1 sm:flex-initial bg-[#2ec2b3] hover:bg-[#28a399]"
                          >
                            <Check className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Accept</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex-1 sm:flex-initial border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Decline</span>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Unfriend Confirmation Dialog */}
        <AlertDialog open={unfriendDialogOpen} onOpenChange={setUnfriendDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Friend</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{userToUnfriend?.name}</strong> from your friends list?
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
      </div>
    </>
  );
};

export default Friends;