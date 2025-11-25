import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Friend {
  id: string;
  friend_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

const Messages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  useEffect(() => {
    if (selectedFriend) {
      fetchMessages();

      const channel = supabase
        .channel(`messages-${selectedFriend.profiles.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${selectedFriend.profiles.id},receiver_id=eq.${user?.id}`,
          },
          () => {
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedFriend, user]);

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
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

    setFriends(data as Friend[]);
  };

  const fetchMessages = async () => {
    if (!selectedFriend) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${selectedFriend.profiles.id}),and(sender_id.eq.${selectedFriend.profiles.id},receiver_id.eq.${user?.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user?.id,
        receiver_id: selectedFriend.profiles.id,
        content: newMessage,
      });

      if (error) throw error;

      setNewMessage('');
      fetchMessages();
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
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Messages</h1>
            <Button variant="outline" className="ml-auto" onClick={() => navigate('/friends')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Manage Friends
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Friends List */}
          <Card className="lg:col-span-1 shadow-soft overflow-auto">
            <CardHeader>
              <CardTitle className="text-lg">Friends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No friends yet. Add friends to start chatting!
                </p>
              ) : (
                friends.map((friend) => (
                  <Button
                    key={friend.id}
                    variant={selectedFriend?.id === friend.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarImage src={friend.profiles.avatar_url || ''} />
                      <AvatarFallback>{friend.profiles.full_name[0]}</AvatarFallback>
                    </Avatar>
                    {friend.profiles.full_name}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="lg:col-span-3 shadow-soft flex flex-col">
            {selectedFriend ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedFriend.profiles.avatar_url || ''} />
                      <AvatarFallback>{selectedFriend.profiles.full_name[0]}</AvatarFallback>
                    </Avatar>
                    <CardTitle>{selectedFriend.profiles.full_name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_id === user.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardContent className="border-t p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <Button type="submit" size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Select a friend to start chatting</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;
