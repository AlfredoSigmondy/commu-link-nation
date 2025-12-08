// src/pages/DirectApproach.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Image, Video, Phone, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Approach {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
} 

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
}

const DirectApproach = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [newMessage, setNewMessage] = useState<{ [key: string]: string }>({});
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const EMERGENCY_HOTLINE = "09123456789";

  const handleEmergencyCall = () => {
    window.location.href = `tel:${EMERGENCY_HOTLINE}`;
    toast({ title: "Emergency Call", description: `Dialing ${EMERGENCY_HOTLINE}` });
  };

  const fetchApproaches = async () => {
    const { data } = await supabase
      .from('direct_approaches')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    setApproaches(data || []);
    data?.forEach(a => fetchMessages(a.id));
  };

  const fetchMessages = async (approachId: string) => {
    const { data } = await supabase
      .from('approach_messages')
      .select('id, message, sender_id, created_at')
      .eq('approach_id', approachId)
      .order('created_at', { ascending: true });

    if (data) {
      const enriched = await Promise.all(
        data.map(async (msg) => {
          if (msg.sender_id === user?.id) return { ...msg, sender_name: 'You' };
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();
          return { ...msg, sender_name: profile?.full_name || 'Admin' };
        })
      );
      setMessages(prev => ({ ...prev, [approachId]: enriched }));
    }
  };

  useEffect(() => {
    Object.keys(scrollRefs.current).forEach(id => {
      const el = scrollRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const sendMessage = async (approachId: string) => {
    const text = (newMessage[approachId] || '').trim();
    if (!text) return;

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
      await supabase
        .from('direct_approaches')
        .update({ status: 'in_progress' })
        .eq('id', approachId)
        .eq('status', 'open');
    }
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('approach-media').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('approach-media').getPublicUrl(fileName);
      return publicUrl;
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    let mediaUrl = null;
    let mediaType = null;
    if (mediaFile) {
      mediaUrl = await uploadMedia(mediaFile);
      if (!mediaUrl) { setIsSubmitting(false); return; }
      mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
    }

    const { error } = await supabase.from('direct_approaches').insert({
      user_id: user?.id,
      subject,
      message,
      status: 'open',
      media_url: mediaUrl,
      media_type: mediaType,
    });

    if (error) toast({ title: "Error", variant: "destructive" });
    else {
      toast({ title: "Request sent!" });
      setShowForm(false);
      setMediaFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchApproaches();

    const channel = supabase
      .channel('direct-approach-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_approaches', filter: `user_id=eq.${user.id}` }, fetchApproaches)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'approach_messages' }, (payload) => {
        const msg = payload.new as Message;
        const aid = msg.approach_id;
        if (approaches.some(a => a.id === aid)) {
          setMessages(prev => ({
            ...prev,
            [aid]: [...(prev[aid] || []), { ...msg, sender_name: msg.sender_id === user?.id ? 'You' : 'Admin' }],
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, approaches]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-yellow-500',
      in_progress: 'bg-blue-600',
      resolved: 'bg-green-600',
    };
    return <Badge className={`${map[status] || 'bg-muted'} text-white`}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-white">
      {/* Header */}
     <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b shadow-sm">
      {/* Reduced vertical padding (py-3) on mobile, maintains max-w-7xl */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Button remains the same size */}
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {/* Smaller text size (text-xl) and ensures text truncates if needed */}
          <h1 className="text-xl font-bold text-[#2ec2b3] truncate">Contact Barangay</h1>
        </div>
        {/* Smaller gap (gap-2) between buttons on mobile */}
        <div className="flex gap-2">
          {/* EMERGENCY CALL BUTTON: Compacted to icon-only on small screens */}
          <Button onClick={handleEmergencyCall} className="bg-red-600 hover:bg-red-700 h-9 px-3 sm:h-10 sm:px-4">
            <Phone className="h-4 w-4 mr-0 sm:mr-2" />
            <span className="hidden sm:inline">Call</span> {/* Hides "Call" text on mobile */}
          </Button>
          {/* NEW REQUEST BUTTON: Compacted to icon-only on small screens */}
          <Button onClick={() => setShowForm(!showForm)} variant="outline" className="border-[#2ec2b3] text-[#2ec2b3] h-9 px-3 sm:h-10 sm:px-4">
            <Send className="h-4 w-4 mr-0 sm:mr-2" />
            <span className="hidden sm:inline">New Request</span> {/* Hides "New Request" text on mobile */}
          </Button>
        </div>
      </div>
    </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* New Request Form */}
        {showForm && (
          <Card className="mb-8 shadow-lg border-[#2ec2b3]/20">
            <CardHeader className="bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-500/10">
              <CardTitle className="text-xl">Submit New Request</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label>Subject</Label>
                  <Input name="subject" required placeholder="Brief title of your concern" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea name="message" required rows={5} placeholder="Describe your concern in detail..." />
                </div>
                <div>
                  <Label>Attach Photo/Video (Optional)</Label>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e => setMediaFile(e.target.files?.[0] || null)} className="hidden" />
                  {mediaFile ? (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <span className="truncate max-w-xs">{mediaFile.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setMediaFile(null)}>Remove</Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                      <Image className="h-4 w-4 mr-2" /> Choose File
                    </Button>
                  )}
                </div>
                <Button type="submit" className="w-full bg-[#2ec2b3] hover:bg-[#26a69a]" disabled={isSubmitting || isUploading}>
                  {isSubmitting || isUploading ? 'Sending...' : 'Submit Request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        <h2 className="mb-6 text-2xl font-bold text-gray-800">Your Requests</h2>
        {approaches.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent className="text-muted-foreground">No requests yet. Click "New Request" to get started.</CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {approaches.map(approach => {
              const chat = messages[approach.id] || [];

              return (
                <Card key={approach.id} className="overflow-hidden shadow-xl border-[#2ec2b3]/10">
                  <CardHeader className="bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-500/5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{approach.subject}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {getStatusBadge(approach.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* Original Message */}
                    <div className="border-b bg-gray-50/50 p-6">
                      <p className="font-medium text-gray-700 mb-3">Your Original Request:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{approach.message}</p>
                      {approach.media_url && (
                        <div className="mt-4 rounded-lg overflow-hidden shadow-md">
                          {approach.media_type === 'image' ? (
                            <img src={approach.media_url} alt="Attached" className="w-full max-h-96 object-cover" />
                          ) : (
                            <video src={approach.media_url} controls className="w-full max-h-96" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Chat Messages */}
                    <ScrollArea className="h-96 px-6 py-4" ref={el => scrollRefs.current[approach.id] = el}>
                      {chat.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No replies yet. Barangay officials will respond soon.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {chat.map(msg => (
                            <div
                              key={msg.id}
                              className={`flex gap-4 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}
                            >
                              <Avatar className="h-10 w-10 ring-2 ring-white shadow-lg">
                                <AvatarFallback className={msg.sender_id === user?.id ? 'bg-[#2ec2b3] text-white' : 'bg-gray-600 text-white'}>
                                  {msg.sender_id === user?.id ? 'Y' : 'A'}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'} max-w-[75%]`}>
                                <span className="text-xs font-medium text-muted-foreground mb-1">
                                  {msg.sender_name || (msg.sender_id === user?.id ? 'You' : 'Admin')}
                                </span>
                                <div className={`rounded-2xl px-5 py-3 shadow-md ${msg.sender_id === user?.id
                                  ? 'bg-[#2ec2b3] text-white rounded-tr-none'
                                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                  }`}>
                                  <p className="text-sm leading-relaxed">{msg.message}</p>
                                </div>
                                <span className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Input Box */}
                    {approach.status !== 'resolved' ? (
                      <div className="border-t bg-gray-50/80 p-4">
                        <div className="flex gap-3 max-w-4xl mx-auto">
                          <Textarea
                            placeholder="Type your message..."
                            value={newMessage[approach.id] || ''}
                            onChange={e => setNewMessage(prev => ({ ...prev, [approach.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(approach.id);
                              }
                            }}
                            className="min-h-24 resize-none border-gray-300 focus:border-[#2ec2b3]"
                          />
                          <Button
                            onClick={() => sendMessage(approach.id)}
                            size="lg"
                            className="bg-[#2ec2b3] hover:bg-[#26a69a] self-end"
                          >
                            <Send className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t bg-green-50 p-6 text-center">
                        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
                        <p className="text-green-700 font-semibold">This request has been resolved</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectApproach;