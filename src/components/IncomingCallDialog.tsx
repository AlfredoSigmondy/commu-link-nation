// components/IncomingCallDialog.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

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

interface Props {
  userId: string;
  onAccept: (call: Call, profile: CallerProfile) => void;
}

export default function IncomingCallDialog({ userId, onAccept }: Props) {
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [callerProfile, setCallerProfile] = useState<CallerProfile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as Call;
          if (call.status !== 'ringing') return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', call.caller_id)
            .single();

          setIncomingCall(call);
          setCallerProfile(profile);
          setOpen(true);

          // Play notification sound
          try {
            const notification = new Audio('/notification.mp3');
            notification.play().catch(() => {});
          } catch {}

          // Auto reject after 30 seconds
          setTimeout(async () => {
            const { data } = await supabase
              .from('calls')
              .select('status')
              .eq('id', call.id)
              .single();
            
            if (data?.status === 'ringing') {
              await supabase.from('calls').update({ status: 'missed' }).eq('id', call.id);
              setOpen(false);
              setIncomingCall(null);
            }
          }, 30000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleAccept = async () => {
    if (!incomingCall || !callerProfile) return;
    
    await supabase.from('calls').update({ status: 'accepted' }).eq('id', incomingCall.id);
    onAccept(incomingCall, callerProfile);
    setOpen(false);
    setIncomingCall(null);
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    
    await supabase.from('calls').update({ status: 'declined' }).eq('id', incomingCall.id);
    setOpen(false);
    setIncomingCall(null);
  };

  if (!incomingCall || !callerProfile) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleReject()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-[#2ec2b3] to-cyan-600 border-0 text-white">
        <DialogHeader>
          <DialogTitle className="text-center text-white text-xl">Incoming Call</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-8 space-y-6">
          <Avatar className="h-24 w-24 ring-4 ring-white/30">
            <AvatarImage src={callerProfile.avatar_url || ''} />
            <AvatarFallback className="bg-white/20 text-white text-3xl">
              {callerProfile.full_name[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center">
            <p className="text-2xl font-bold">{callerProfile.full_name}</p>
            <p className="text-white/80 animate-pulse">is calling you...</p>
          </div>
          
          <div className="flex items-center gap-8 pt-4">
            <Button
              onClick={handleReject}
              size="lg"
              className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
            
            <Button
              onClick={handleAccept}
              size="lg"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg animate-pulse"
            >
              <Phone className="h-8 w-8" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}