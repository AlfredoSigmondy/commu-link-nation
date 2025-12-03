import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  MessageCircle,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';
import { VideoCallDialog } from '@/components/VideoCallDialog';
import { format } from 'date-fns';

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
  receiver_id: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  delivered_at: string | null;
  // Local state for sending animation
  isSending?: boolean;
}

const Messages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchFriends();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, friend_id,
        profiles!friendships_friend_id_fkey (id, full_name, avatar_url)
      `)
      .eq('user_id', user?.id)
      .eq('status', 'accepted');

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setFriends(data || []);
  };

  const fetchMessages = async () => {
    if (!selectedFriend || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriend.profiles.id}),and(sender_id.eq.${selectedFriend.profiles.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setMessages(data || []);
  };

  // Real-time: New messages + Delivery updates
  useEffect(() => {
    if (!selectedFriend || !user) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat:${[user.id, selectedFriend.profiles.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const isFromFriend = newMsg.sender_id === selectedFriend.profiles.id;
          const isToMe = newMsg.receiver_id === user.id;

          if ((isFromFriend && isToMe) || newMsg.sender_id === user.id) {
            setMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === updated.id ? { ...msg, delivered_at: updated.delivered_at } : msg
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedFriend, user]);

  // Mark messages as delivered when user views chat
  useEffect(() => {
    if (!selectedFriend || !user) return;

    const markDelivered = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('sender_id', selectedFriend.profiles.id)
        .is('delivered_at', null);

      if (data && data.length > 0) {
        const ids = data.map(m => m.id);
        await supabase
          .from('messages')
          .update({ delivered_at: new Date().toISOString() })
          .in('id', ids);
      }
    };

    markDelivered();
  }, [selectedFriend, user]);

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const path = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage.from('message-media').upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage.from('message-media').getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !selectedFriend) return;

    const tempId = Date.now().toString();
    
    // Prepare media info for temp message
    let tempMediaType = null;
    let tempMediaUrl = null;
    
    if (mediaFile) {
      tempMediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
      // Create a preview URL for immediate display
      tempMediaUrl = URL.createObjectURL(mediaFile);
    }

    const tempMessage: Message = {
      id: tempId,
      sender_id: user!.id,
      receiver_id: selectedFriend.profiles.id,
      content: newMessage.trim() || (mediaFile ? '[Media]' : ''),
      media_url: tempMediaUrl,
      media_type: tempMediaType,
      created_at: new Date().toISOString(),
      delivered_at: null,
      isSending: true,
    };

    // Optimistically add message
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    const fileToUpload = mediaFile;
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (fileToUpload) {
        mediaUrl = await uploadMedia(fileToUpload);
        if (!mediaUrl) throw new Error('Upload failed');
        mediaType = fileToUpload.type.startsWith('image/') ? 'image' : 'video';
        // Clean up blob URL
        if (tempMediaUrl) URL.revokeObjectURL(tempMediaUrl);
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: selectedFriend.profiles.id,
          content: newMessage.trim() || (mediaUrl ? '[Media]' : ''),
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (error) throw error;

      // Remove temp message and add real one (prevents duplicates)
      setMessages(prev => [...prev.filter(m => m.id !== tempId), data]);
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
      // Clean up blob URL on error
      if (tempMediaUrl) URL.revokeObjectURL(tempMediaUrl);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const getMessageStatus = (msg: Message) => {
    if (msg.isSending) {
      return <Clock className="h-3.5 w-3.5 animate-spin" />;
    }
    if (!msg.delivered_at) {
      return <Check className="h-3.5 w-3.5" />;
    }
    return <CheckCheck className="h-4 w-4" />;
  };

  const formatTime = (date: string) => {
    return format(new Date(date), 'h:mm a');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-[#2ec2b3] rounded-full border-t-transparent"></div></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold text-[#2ec2b3] flex items-center gap-2">
              <MessageCircle className="h-5 w-5 sm:h-7 sm:w-7" />
              <span className="hidden sm:inline">Messages</span>
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6">
        {/* Mobile */}
        <div className="lg:hidden">
          {!selectedFriend ? (
            /* Friends list */
            <Card className="bg-white rounded-xl shadow-md overflow-hidden">/* ... your list ... */</Card>
          ) : (
            <Card className="bg-white rounded-xl shadow-md flex flex-col h-[calc(100vh-140px)] overflow-hidden">
              <div className="border-b p-3 flex items-center justify-between bg-gradient-to-r from-[#2ec2b3]/5 to-white">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedFriend(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={selectedFriend.profiles.avatar_url || ''} />
                    <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">
                      {selectedFriend.profiles.full_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{selectedFriend.profiles.full_name}</p>
                    <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">Online</Badge>
                  </div>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setVideoCallOpen(true)}>
                  <VideoIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* VIDEO CALL — ALL PROPS PASSED */}
              <VideoCallDialog
                open={videoCallOpen}
                onOpenChange={setVideoCallOpen}
                friendName={selectedFriend.profiles.full_name}
                friendId={selectedFriend.profiles.id}
                userId={user!.id}
                userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
              />

              {/* Chat messages & input — unchanged */}
              <ScrollArea className="flex-1 p-3">/* ... your messages ... */</ScrollArea>
              <div className="border-t bg-gray-50 p-2">/* ... your input ... */</div>
            </Card>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* Friends list */}
          <Card className="lg:col-span-1 bg-white/90 rounded-2xl shadow-lg flex flex-col overflow-hidden">
            {/* ... your list ... */}
          </Card>

          <Card className="lg:col-span-3 bg-white/95 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            {selectedFriend ? (
              <>
                {/* VIDEO CALL — DESKTOP */}
                <VideoCallDialog
                  open={videoCallOpen}
                  onOpenChange={setVideoCallOpen}
                  friendName={selectedFriend.profiles.full_name}
                  friendId={selectedFriend.profiles.id}
                  userId={user!.id}
                  userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                />

                <div className="border-b p-3 sm:p-5 flex items-center justify-between bg-gradient-to-r from-[#2ec2b3]/5">
                  {/* Friend info + Call button */}
                  <Button onClick={() => setVideoCallOpen(true)}>
                    <VideoIcon className="h-4 w-4 mr-2" /> Call
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-3 sm:p-6">/* messages */</ScrollArea>
                <div className="border-t bg-gray-50 p-4">/* input */</div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <MessageCircle className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a chat to start messaging</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;