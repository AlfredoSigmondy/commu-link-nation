import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
    ArrowLeft, Send, Image, Video, 
    MessageCircle, Check, CheckCheck, Clock, X, Settings
} from 'lucide-react';
import { VideoCallDialog } from '@/components/VideoCallDialog';
import IncomingCallDialog from '@/components/IncomingCallDialog';
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
    isSending?: boolean;
}

const Messages = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [videoCallOpen, setVideoCallOpen] = useState(false);
    const [tempMediaBlobUrl, setTempMediaBlobUrl] = useState<string | null>(null);
    const [incomingCallData, setIncomingCallData] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && !user) navigate('/auth');
    }, [user, loading, navigate]);

    useEffect(() => {
        if (user) fetchFriends();
    }, [user]);

    useEffect(() => {
        if (location.state?.selectedUserId && friends.length > 0) {
            const friend = friends.find(f => f.profiles.id === location.state.selectedUserId);
            if (friend) {
                setSelectedFriend(friend);
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, friends]);

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

    useEffect(() => {
        if (!selectedFriend || !user) return;
        fetchMessages();
        
        const channel = supabase
            .channel(`chat:${[user.id, selectedFriend.profiles.id].sort().join('-')}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMsg = payload.new as Message;
                const isFromFriend = newMsg.sender_id === selectedFriend.profiles.id;
                const isToMe = newMsg.receiver_id === user.id;

                if ((isFromFriend && isToMe) || newMsg.sender_id === user.id) {
                    setMessages(prev => [...prev.filter(m => m.id !== newMsg.id), newMsg]);
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (payload) => {
                const updated = payload.new as Message;
                setMessages(prev => prev.map(msg => msg.id === updated.id ? { ...msg, delivered_at: updated.delivered_at } : msg));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedFriend, user]);

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
                await supabase.from('messages').update({ delivered_at: new Date().toISOString() }).in('id', ids);
            }
        };

        markDelivered();
    }, [selectedFriend, user]);

    const handleIncomingCall = (call: any, callerProfile: any) => {
        const friend = friends.find(f => f.profiles.id === call.caller_id);
        if (friend) {
            setSelectedFriend(friend);
            setIncomingCallData({ call, callerProfile });
            setVideoCallOpen(true);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (tempMediaBlobUrl) URL.revokeObjectURL(tempMediaBlobUrl);
        setMediaFile(file);
        setTempMediaBlobUrl(URL.createObjectURL(file));
        e.target.value = '';
    };

    const handleRemoveMedia = () => {
        if (tempMediaBlobUrl) URL.revokeObjectURL(tempMediaBlobUrl);
        setMediaFile(null);
        setTempMediaBlobUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadMedia = async (file: File): Promise<string | null> => {
        try {
            setIsUploading(true);
            const ext = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
            const path = `${user?.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('message-media').upload(path, file, { upsert: false });
            if (uploadError) throw uploadError;

            const { data, error: signError } = await supabase.storage.from('message-media').createSignedUrl(path, 60 * 60 * 24 * 365 * 2);
            if (signError) throw signError;

            return data.signedUrl;
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
        const fileToUpload = mediaFile;
        const tempUrl = tempMediaBlobUrl; 
        
        const tempMessage: Message = {
            id: tempId,
            sender_id: user!.id,
            receiver_id: selectedFriend.profiles.id,
            content: newMessage.trim() || (fileToUpload ? '[Media]' : ''),
            media_url: tempUrl, 
            media_type: fileToUpload?.type.startsWith('image/') ? 'image' : (fileToUpload?.type.startsWith('video/') ? 'video' : null),
            created_at: new Date().toISOString(),
            delivered_at: null,
            isSending: true,
        };

        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');
        handleRemoveMedia(); 
        
        try {
            let mediaUrl = null;
            let mediaType = null;

            if (fileToUpload) {
                mediaUrl = await uploadMedia(fileToUpload);
                if (!mediaUrl) throw new Error('Upload failed');
                mediaType = fileToUpload.type.startsWith('image/') ? 'image' : 'video';
            }
            
            const contentToSend = newMessage.trim() || (mediaUrl ? '[Media]' : '');

            const { data, error } = await supabase.from('messages').insert({
                sender_id: user?.id,
                receiver_id: selectedFriend.profiles.id,
                content: contentToSend,
                media_url: mediaUrl,
                media_type: mediaType,
            }).select().single();

            if (error) throw error;
            setMessages(prev => [...prev.filter(m => m.id !== tempId), data]);
        } catch (err: any) {
            toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const getMessageStatus = (msg: Message) => {
        if (msg.isSending) return <Clock className="h-3.5 w-3.5 text-white/80" />;
        if (!msg.delivered_at) return <Check className="h-3.5 w-3.5" />;
        return <CheckCheck className="h-4 w-4" />;
    };

    const formatTime = (date: string) => format(new Date(date), 'h:mm a');

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-[#2ec2b3] rounded-full border-t-transparent"></div></div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
            <IncomingCallDialog userId={user.id} onAccept={handleIncomingCall} />

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
                <div className="lg:hidden">
                    {!selectedFriend ? (
                        <Card className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="p-3 bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-50 border-b">
                                <h3 className="font-semibold text-[#2ec2b3] text-sm">Select a chat</h3>
                            </div>
                            <div className="divide-y">
                                {friends.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No friends yet</p>
                                    </div>
                                ) : (
                                    friends.map(friend => (
                                        <button key={friend.id} onClick={() => setSelectedFriend(friend)} className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 transition-colors text-left">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={friend.profiles.avatar_url || ''} />
                                                <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">{friend.profiles.full_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium text-sm">{friend.profiles.full_name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </Card>
                    ) : (
                        <Card className="bg-white rounded-xl shadow-md flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                            <div className="border-b p-3 flex items-center justify-between bg-gradient-to-r from-[#2ec2b3]/5 to-white">
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedFriend(null)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={selectedFriend.profiles.avatar_url || ''} />
                                        <AvatarFallback className="bg-[#2ec2b3] text-white text-sm">{selectedFriend.profiles.full_name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-sm">{selectedFriend.profiles.full_name}</p>
                                        <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">Online</Badge>
                                    </div>
                                </div>
                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setVideoCallOpen(true)}>
                                    <Video className="h-4 w-4" />
                                </Button>
                            </div>

                            <VideoCallDialog
                                open={videoCallOpen}
                                onOpenChange={setVideoCallOpen}
                                friendName={selectedFriend.profiles.full_name}
                                friendId={selectedFriend.profiles.id}
                                userId={user!.id}
                                userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                                callId={incomingCallData?.call?.id}
                            />

                            <ScrollArea className="flex-1 p-3">
                                <div className="space-y-2">
                                    {messages.map((msg, idx) => (
                                        <div key={`${msg.id}-${idx}`} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${msg.sender_id === user?.id ? 'bg-[#2ec2b3] text-white' : 'bg-gray-100 text-gray-800'}`}>
                                                {msg.media_url && (
                                                    <div className="mb-2 rounded-lg overflow-hidden max-h-64">
                                                        {msg.media_type === 'image' ? (
                                                            <img src={msg.media_url} className="rounded-lg max-w-full h-auto object-cover" alt="Chat media" />
                                                        ) : (
                                                            <video src={msg.media_url} controls className="rounded-lg max-w-full h-auto object-cover" />
                                                        )}
                                                    </div>
                                                )}
                                                {msg.content && <p className="break-words text-sm">{msg.content}</p>}
                                                <div className="flex items-center gap-1.5 mt-1 text-[10px] opacity-70">
                                                    <span>{formatTime(msg.created_at)}</span>
                                                    {msg.sender_id === user?.id && <span className="flex items-center">{getMessageStatus(msg)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </ScrollArea>

                            <div className="border-t bg-gray-50 p-2">
                                <div className="flex gap-2">
                                    <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                                    <Button size="icon" variant="outline" className="h-9 w-9 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                        <Image className="h-4 w-4" />
                                    </Button>
                                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Message..." className="flex-1 h-9 text-sm" disabled={isUploading} />
                                    <Button onClick={handleSendMessage} size="icon" className="h-9 w-9 bg-[#2ec2b3] hover:bg-[#28a399] flex-shrink-0" disabled={!newMessage.trim() && !mediaFile}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;