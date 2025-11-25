import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Check, X } from 'lucide-react';

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();

      const channel = supabase
        .channel('friendships-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
          fetchFriends();
          fetchPendingRequests();
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('full_name', `%${searchQuery}%`)
      .neq('id', user?.id)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return;
    }

    setSearchResults(data);
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
        description: 'Waiting for them to accept.',
      });
      setSearchResults([]);
      setSearchQuery('');
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
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      // Create reverse friendship
      const request = pendingRequests.find((r) => r.id === requestId);
      if (request) {
        await supabase.from('friendships').insert({
          user_id: user?.id,
          friend_id: request.user_id,
          status: 'accepted',
        });
      }

      toast({
        title: 'Friend request accepted!',
      });
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

      toast({
        title: 'Friend request rejected',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/messages')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Friends</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">My Friends</TabsTrigger>
            <TabsTrigger value="requests">
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="add">Add Friends</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Friends List</CardTitle>
                <CardDescription>Your current friends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No friends yet</p>
                ) : (
                  friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={friend.profiles.avatar_url || ''} />
                          <AvatarFallback>{friend.profiles.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{friend.profiles.full_name}</span>
                      </div>
                      <Button variant="outline" onClick={() => navigate('/messages')}>
                        Message
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Friend Requests</CardTitle>
                <CardDescription>People who want to be your friend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending requests</p>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.profiles.avatar_url || ''} />
                          <AvatarFallback>{request.profiles.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{request.profiles.full_name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAcceptRequest(request.id)}>
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
                <CardDescription>Search for people in your community</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                <div className="space-y-3">
                  {searchResults.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback>{profile.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{profile.full_name}</span>
                      </div>
                      <Button onClick={() => handleSendRequest(profile.id)}>Send Request</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Friends;
