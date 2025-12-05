// src/pages/AdminDashboard.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, X, Send, ClipboardList, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingPost {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string };
}

interface DirectApproach {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  user_id: string;
  profiles: { full_name: string };
}

interface Message {
  id: string;
  approach_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: { full_name: string };
}

const AdminDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [approaches, setApproaches] = useState<DirectApproach[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [newMessage, setNewMessage] = useState<{ [key: string]: string }>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  // Fetch data + real-time
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      await Promise.all([fetchPendingPosts(), fetchApproaches()]);
    };

    fetchData();

    // Realtime: new/changed posts
    const postsChannel = supabase
      .channel('admin-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPendingPosts();
      })
      .subscribe();

    // Realtime: new/changed approaches
    const approachesChannel = supabase
      .channel('admin-approaches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_approaches' }, () => {
        fetchApproaches();
      })
      .subscribe();

    // Realtime: new messages
    const messagesChannel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'approach_messages' },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => ({
            ...prev,
            [msg.approach_id]: [...(prev[msg.approach_id] || []), msg],
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeAllChannels();
    };
  }, [isAdmin]);

  const fetchPendingPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, content, created_at, profiles(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingPosts(data || []);
  };

  const fetchApproaches = async () => {
    const { data } = await supabase
      .from('direct_approaches')
      .select('id, subject, message, status, created_at, user_id, profiles(full_name)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (data) {
      setApproaches(data);
      data.forEach(a => fetchMessages(a.id));
    }
  };

// Replace the old fetchMessages with this version
const fetchMessages = async (approachId: string) => {
  const { data, error } = await supabase
    .from('approach_messages')
    .select('id, message, sender_id, created_at') // ← Remove profiles join
    .eq('approach_id', approachId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  // Now fetch sender names in parallel (fast + reliable)
  const messagesWithNames = await Promise.all(
    data.map(async (msg) => {
      if (msg.sender_id === user?.id) {
        return { ...msg, sender_name: 'You' };
      }

      // Try to get full_name from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', msg.sender_id)
        .single();

      return {
        ...msg,
        sender_name: profile?.full_name || (msg.sender_id === user?.id ? 'You' : 'Barangay'),
      };
    })
  );

  setMessages(prev => ({ ...prev, [approachId]: messagesWithNames }));
};

  // Auto-scroll when new message
  useEffect(() => {
    Object.keys(scrollRefs.current).forEach(id => {
      const el = scrollRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const sendMessage = async (approachId: string) => {
    const text = (newMessage[approachId] || '').trim();
    if (!text) {
      toast({ title: "Empty", description: "Type a message first", variant: "destructive" });
      return;
    }

    setNewMessage(prev => ({ ...prev, [approachId]: '' }));

    const { error } = await supabase
      .from('approach_messages')
      .insert({
        approach_id: approachId,
        sender_id: user!.id,
        message: text,
      });

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      setNewMessage(prev => ({ ...prev, [approachId]: text }));
    } else {
      // Mark as in_progress on first reply
      await supabase
        .from('direct_approaches')
        .update({ status: 'in_progress' })
        .eq('id', approachId)
        .eq('status', 'open');

      toast({ title: "Sent!" });
    }
  };

  const markAsResolved = async (approachId: string) => {
    setIsUpdating(approachId);
    const { error } = await supabase
      .from('direct_approaches')
      .update({ status: 'resolved' })
      .eq('id', approachId);

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Resolved", description: "Request closed." });
    setIsUpdating(null);
  };

  const approvePost = async (id: string) => {
    setIsUpdating(id);
    await supabase.from('posts').update({ status: 'approved' }).eq('id', id);
    toast({ title: "Approved" });
    setIsUpdating(null);
  };

  const rejectPost = async (id: string) => {
    setIsUpdating(id);
    await supabase.from('posts').update({ status: 'rejected' }).eq('id', id);
    toast({ title: "Rejected" });
    setIsUpdating(null);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-[#2ec2b3]">Admin Dashboard</h1>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Posts</p>
              <p className="text-3xl font-bold text-primary">{pendingPosts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Requests</p>
              <p className="text-3xl font-bold text-secondary">{approaches.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="approaches" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts">Posts ({pendingPosts.length})</TabsTrigger>
            <TabsTrigger value="approaches">Requests ({approaches.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6 space-y-4">
            {pendingPosts.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No pending posts</CardContent></Card>
            ) : (
              pendingPosts.map(post => (
                <Card key={post.id}>
                  <CardHeader>
                    <p className="font-medium">{post.profiles.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
                    <div className="flex gap-3">
                      <Button onClick={() => approvePost(post.id)} disabled={isUpdating === post.id}>
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => rejectPost(post.id)} disabled={isUpdating === post.id}>
                        <X className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approaches" className="mt-6 space-y-6">
            {approaches.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No active requests</CardContent></Card>
            ) : (
              approaches.map(approach => {
                const chat = messages[approach.id] || [];

                return (
                  <Card key={approach.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/40">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{approach.subject}</h3>
                          <p className="text-sm text-muted-foreground">
                            {approach.profiles.full_name} · {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {approach.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => markAsResolved(approach.id)}
                            disabled={isUpdating === approach.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      {/* Original Request */}
                      <div className="border-b p-6">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Original Request:</p>
                        <p className="whitespace-pre-wrap">{approach.message}</p>
                      </div>

                      {/* Messages */}
                      <ScrollArea className="h-96 px-6 py-4" ref={el => (scrollRefs.current[approach.id] = el)}>
                        {chat.length === 0 ? (
                          <p className="text-center text-muted-foreground">Start the conversation...</p>
                        ) : (
                          <div className="space-y-4">
                            {chat.map(msg => (
                              <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {msg.profiles?.full_name?.[0] || (msg.sender_id === user?.id ? 'A' : 'R')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`flex max-w-md flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
                                  <p className="text-xs text-muted-foreground">
                                    {msg.profiles?.full_name || (msg.sender_id === user?.id ? 'You' : 'Resident')}
                                  </p>
                                  <div className={`mt-1 rounded-2xl px-4 py-2 ${msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-muted'}`}>
                                    <p className="text-sm">{msg.message}</p>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(msg.created_at))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Input */}
                      <div className="border-t p-4">
                        <div className="flex gap-3">
                          <Textarea
                            placeholder="Type your reply..."
                            value={newMessage[approach.id] || ''}
                            onChange={e => setNewMessage(prev => ({ ...prev, [approach.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(approach.id);
                              }
                            }}
                            className="min-h-20 resize-none"
                          />
                          <Button onClick={() => sendMessage(approach.id)} size="lg">
                            <Send className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;