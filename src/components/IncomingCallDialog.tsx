// components/IncomingCallDialog.tsx
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface Props {
  userId: string;
  onAccept: (call: any, profile: any) => void;
}

export default function IncomingCallDialog({ userId, onAccept }: Props) {
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
          const call = payload.new;
          if (call.status !== 'ringing') return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', call.caller_id)
            .single();

          const notification = new Audio('/notification.mp3');
          notification.play().catch(() => {});

          // Auto reject after 30 seconds
          const timer = setTimeout(() => {
            supabase.from('calls').update({ status: 'missed' }).eq('id', call.id);
          }, 30000);

          const accept = () => {
            clearTimeout(timer);
            onAccept(call, profile);
          };

          const reject = () => {
            clearTimeout(timer);
            supabase.from('calls').update({ status: 'declined' }).eq('id', call.id);
          };

          // Use native alert or custom modal
          const result = confirm(`${profile?.full_name || 'Someone'} is calling you...`);
          if (result) accept();
          else reject();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onAccept]);

  return null; // Invisible component, uses native alert for simplicity
}