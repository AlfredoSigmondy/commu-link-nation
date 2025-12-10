import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    Clock,
    X,
    Settings,
    Phone
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

interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  room_name: string;
  status: string;
  created_at: string;
}

interface CallerProfile {
  full_name: string;
  avatar_url: string | null;
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
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [callerProfile, setCallerProfile] = useState<CallerProfile | null>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'ongoing'>('idle');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && !user) navigate('/auth');
    }, [user, loading, navigate]);

    useEffect(() => {
        if (user) {
            fetchFriends();
            setupIncomingCallListener();
        }
    }, [user]);

    // Auto-select friend from navigation state
    useEffect(() => {
        if (location.state?.selectedUserId && friends.length > 0) {
            const friend = friends.find(f => f.profiles.id === location.state.selectedUserId);
            if (friend) {
                setSelectedFriend(friend);
                // Clear the state to prevent re-selection on component updates
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

    const setupIncomingCallListener = () => {
        const channel = supabase
            .channel('incoming-calls-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'calls',
                    filter: `receiver_id=eq.${user?.id}`,
                },
                async (payload) => {
                    const call = payload.new as Call;
                    if (call.status !== 'ringing') return;

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', call.caller_id)
                        .single();

                    setActiveCall(call);
                    setCallerProfile(profile);
                    setCallStatus('incoming');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
                        setMessages(prev => [...prev.filter(m => m.id !== newMsg.id), newMsg]);
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

        const { error: uploadError } = await supabase.storage
            .from('message-media')
            .upload(path, file, {
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // Generate a SIGNED URL (valid for 2+ years)
        const { data, error: signError } = await supabase.storage
            .from('message-media')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 2); // 2 years

        if (signError) throw signError;

        return data.signedUrl;
    } catch (err: any) {
        toast({ 
            title: 'Upload failed', 
            description: err.message, 
            variant: 'destructive' 
        });
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

            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user?.id,
                    receiver_id: selectedFriend.profiles.id,
                    content: contentToSend,
                    media_url: mediaUrl,
                    media_type: mediaType,
                })
                .select()
                .single();

            if (error) throw error;

            setMessages(prev => [...prev.filter(m => m.id !== tempId), data]);

        } catch (err: any) {
            toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const initiateVideoCall = async () => {
    if (!selectedFriend || !user) {
        toast({ title: 'Error', description: 'Please select a friend to call', variant: 'destructive' });
        return;
    }
    
    console.log('=== STARTING VIDEO CALL ===');
    console.log('Caller:', user.id);
    console.log('Receiver:', selectedFriend.profiles.id);
    console.log('Friend Name:', selectedFriend.profiles.full_name);
    
    setCallStatus('calling');
    
    try {
        const roomName = [user.id, selectedFriend.profiles.id].sort().join('-') + '-private';
        console.log('Room Name:', roomName);
        
        const { data: call, error } = await supabase
            .from('calls')
            .insert({
                caller_id: user.id,
                receiver_id: selectedFriend.profiles.id,
                room_name: roomName,
                room_url: `https://communitymatch.daily.co/${roomName}`,
                status: 'ringing'
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            setCallStatus('idle');
            toast({ title: 'Call failed', description: error.message, variant: 'destructive' });
            return;
        }

        console.log('Call Record Created:', call);
        setActiveCall(call);
        
        console.log('Opening VideoCallDialog...');
        setVideoCallOpen(true);

    } catch (err: any) {
        console.error('Video Call Initiation Error:', err);
        setCallStatus('idle');
        toast({ title: 'Call failed', description: err.message, variant: 'destructive' });
    }
};

    const handleIncomingCallAccept = async (call: Call, profile: CallerProfile) => {
        setCallStatus('ongoing');
        setActiveCall(call);
        setVideoCallOpen(true);
        
        // Update call status to accepted
        await supabase
            .from('calls')
            .update({ status: 'accepted' })
            .eq('id', call.id);
    };

    const handleVideoCallClose = () => {
        setVideoCallOpen(false);
        setCallStatus('idle');
        setActiveCall(null);
        
        if (activeCall) {
            // Update call status to ended
            supabase
                .from('calls')
                .update({ status: 'ended' })
                .eq('id', activeCall.id)
                .then(() => {
                    console.log('Call ended');
                });
        }
    };

    const getMessageStatus = (msg: Message) => {
        if (msg.isSending) {
            return <Clock className="h-3.5 w-3.5 text-white/80" />;
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

    const renderMediaPreview = (file: File | null, url: string | null, isDesktop: boolean) => {
        if (!file || !url) return null;

        const isImage = file.type.startsWith('image/');
        const mediaElement = isImage ? (
            <img src={url} alt="Media Preview" className="h-16 w-16 object-cover rounded-lg" />
        ) : (
            <div className="h-16 w-16 flex items-center justify-center bg-black/80 rounded-lg">
                <VideoIcon className="h-6 w-6 text-white" />
            </div>
        );
        
        return (
            <div className={`
                ${isDesktop ? 'mb-3 p-3 rounded-xl' : 'mb-2 p-2 rounded-lg'}
                bg-white/70 backdrop-blur-sm border border-gray-200 flex items-center gap-3
            `}>
                {mediaElement}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{isImage ? 'Image' : 'Video'}</p>
                </div>
                
                <Button 
                    size={isDesktop ? "sm" : "icon"} 
                    variant="outline" 
                    className={isDesktop ? 'h-8 text-xs' : 'h-8 w-8'}
                    onClick={() => toast({
                        title: "Media Management",
                        description: "This is where the image resizing/cropping dialog would open.",
                        duration: 3000
                    })}
                >
                    <Settings className="h-4 w-4" />
                    {isDesktop && <span className="ml-2">Manage</span>}
                </Button>
                
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={handleRemoveMedia}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
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
                
                {/* Incoming Call Dialog */}
                <IncomingCallDialog
                    userId={user?.id || ''}
                    onAccept={handleIncomingCallAccept}
                />

                {/* Video Call Dialog */}
                {selectedFriend && (
                    
                <VideoCallDialog
                    open={videoCallOpen}
                    onOpenChange={(open) => {
                        if (!open) handleVideoCallClose();
                        setVideoCallOpen(open);
                    }}
                    friendName={selectedFriend.profiles.full_name}
                    friendId={selectedFriend.profiles.id}
                    userId={user.id}
                    userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                    roomUrl={activeCall?.room_url} // PASS THE EXISTING ROOM URL
                    skipApiCall={true} // TELL IT TO SKIP THE API CALL
                />
                )}

                {/* Mobile Layout */}
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
                                         <button
                                             key={friend.id}
                                             onClick={() => setSelectedFriend(friend)}
                                             className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 transition-colors text-left"
                                         >
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
                                <div className="flex gap-2">
                                    {callStatus === 'calling' ? (
                                        <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500 text-white hover:bg-green-600">
                                            <Phone className="h-4 w-4 animate-pulse" />
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="icon" 
                                            variant="outline" 
                                            className="h-8 w-8" 
                                            onClick={initiateVideoCall}
                                            disabled={callStatus !== 'idle'}
                                        >
                                            <VideoIcon className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

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
                                {mediaFile && renderMediaPreview(mediaFile, tempMediaBlobUrl, false)}
                                
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                                    <Button size="icon" variant="outline" className="h-9 w-9 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                        <ImageIcon className="h-4 w-4" />
                                    </Button>
                                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Message..." className="flex-1 h-9 text-sm" disabled={isUploading} />
                                    <Button type="submit" size="icon" className="h-9 w-9 bg-[#2ec2b3] hover:bg-[#28a399] flex-shrink-0" disabled={!newMessage.trim() && !mediaFile}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:grid lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
                    
                    <Card className="lg:col-span-1 bg-white/90 rounded-2xl shadow-lg flex flex-col overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-50 border-b">
                            <h3 className="font-semibold text-[#2ec2b3]">Chats</h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-2">
                                {friends.map(friend => (
                                    <button
                                        key={friend.id}
                                        onClick={() => setSelectedFriend(friend)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${selectedFriend?.id === friend.id ? 'bg-[#2ec2b3] text-white' : 'hover:bg-teal-50'}`}
                                    >
                                        <Avatar>
                                            <AvatarImage src={friend.profiles.avatar_url || ''} />
                                            <AvatarFallback>{friend.profiles.full_name[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{friend.profiles.full_name}</span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>

                    <Card className="lg:col-span-3 bg-white/95 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                        {selectedFriend ? (
                            <>
                                <div className="border-b p-3 sm:p-5 flex items-center justify-between bg-gradient-to-r from-[#2ec2b3]/5">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                                            <AvatarImage src={selectedFriend.profiles.avatar_url || ''} />
                                            <AvatarFallback className="bg-[#2ec2b3] text-white">
                                                {selectedFriend.profiles.full_name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold text-sm sm:text-base">{selectedFriend.profiles.full_name}</p>
                                            <Badge className="bg-green-100 text-green-700 text-xs">Online</Badge>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {callStatus === 'calling' ? (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="bg-green-500 hover:bg-green-600 flex items-center gap-2 animate-pulse"
                                                disabled
                                            >
                                                <Phone className="h-4 w-4" />
                                                <span>Calling...</span>
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={initiateVideoCall}
                                                className="flex items-center gap-2"
                                                disabled={callStatus !== 'idle'}
                                            >
                                                <VideoIcon className="h-4 w-4" />
                                                <span>Video Call</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 p-3 sm:p-6">
                                    <div className="space-y-3 sm:space-y-4">
                                        {messages.map((msg, idx) => (
                                            <div key={`${msg.id}-${idx}`} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md rounded-2xl p-3 sm:p-4 shadow-md relative ${
                                                    msg.sender_id === user?.id ? 'bg-[#2ec2b3] text-white' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {msg.media_url && (
                                                <div className="mb-3 rounded-xl overflow-hidden bg-black/10">
                                                    {msg.media_type === 'image' ? (
                                                        <img
                                                            src={msg.media_url}
                                                            alt="Sent media"
                                                            className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl object-contain bg-black/20"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <video
                                                            src={msg.media_url}
                                                            controls
                                                            className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl rounded-xl"
                                                            preload="metadata"
                                                        >
                                                            <track kind="captions" />
                                                        </video>
                                                    )}
                                                </div>
                                            )}
                                                    {msg.content && <p className="break-words">{msg.content}</p>}
                                                    <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                                                        <span>{formatTime(msg.created_at)}</span>
                                                        {msg.sender_id === user?.id && (
                                                            <span className="flex items-center">
                                                                {getMessageStatus(msg)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </ScrollArea>

                                <div className="border-t bg-gray-50 p-4">
                                    {mediaFile && renderMediaPreview(mediaFile, tempMediaBlobUrl, true)}

                                    <form onSubmit={handleSendMessage} className="flex gap-3">
                                        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                            <ImageIcon className="h-5 w-5" />
                                        </Button>
                                        <Input
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            placeholder="Type a message..."
                                            className="flex-1"
                                            disabled={isUploading}
                                        />
                                        <Button type="submit" disabled={!newMessage.trim() && !mediaFile} className="bg-[#2ec2b3] hover:bg-[#28a399]">
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <MessageCircle className="h-20 w-20 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">Select a chat to start messaging</p>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Messages;