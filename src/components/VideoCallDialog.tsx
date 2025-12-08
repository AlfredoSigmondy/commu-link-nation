// components/VideoCallDialog.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  friendId: string;
  userId: string;
  userName: string;
  callId?: string;
}

export const VideoCallDialog = ({
  open,
  onOpenChange,
  friendName,
  friendId,
  userId,
  userName,
  callId: incomingCallId,
}: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>('ringing');

  const leaveCall = useCallback(async () => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
      callFrameRef.current.destroy();
    }
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      leaveCall();
      return;
    }

    let mounted = true;

    const startCall = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            friendId,
            userName,
            callId: incomingCallId,
          }),
        });

        if (!res.ok) throw new Error('Failed to join call');

        const { url, token } = await res.json();

        const callFrame = DailyIframe.createFrame(frameRef.current!, {
          showLeaveButton: false,
          showFullscreenButton: true,
          iframeStyle: { width: '100%', height: '100%', borderRadius: '16px' },
        });

        callFrameRef.current = callFrame;

        callFrame
          .on('joined-meeting', () => {
            if (mounted) setLoading(false);
          })
          .on('participant-joined', () => {
            if (mounted) setCallStatus('connected');
          })
          .on('participant-left', () => {
            if (mounted) leaveCall();
          })
          .on('error', (e: any) => {
            setError('Call failed: ' + (e.error?.message || 'Unknown'));
            setLoading(false);
          });

        await callFrame.join({ url, token });
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    startCall();

    return () => {
      mounted = false;
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, [open, userId, friendId, userName, incomingCallId, leaveCall]);

  const toggleMic = () => callFrameRef.current?.setLocalAudio(!micOn) && setMicOn(!micOn);
  const toggleCam = () => callFrameRef.current?.setLocalVideo(!camOn) && setCamOn(!camOn);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && leaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden">
        <div ref={frameRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50">
            <Loader2 className="h-16 w-16 animate-spin mb-4" />
            <p className="text-2xl">{callStatus === 'ringing' ? `Calling ${friendName}...` : 'Connecting...'}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50">
            <PhoneOff className="h-16 w-16 mb-4" />
            <p className="text-xl mb-8">{error}</p>
            <Button onClick={leaveCall} variant="destructive">End Call</Button>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/70 backdrop-blur rounded-full px-6 py-4 z-10">
          <Button size="icon" variant={micOn ? 'default' : 'secondary'} onClick={toggleMic} className="h-14 w-14 rounded-full">
            {micOn ? <Mic /> : <MicOff />}
          </Button>
          <Button size="icon" variant={camOn ? 'default' : 'secondary'} onClick={toggleCam} className="h-14 w-14 rounded-full">
            {camOn ? <Video /> : <VideoOff />}
          </Button>
          <Button size="icon" variant="destructive" onClick={leaveCall} className="h-16 w-16 rounded-full">
            <PhoneOff className="h-8 w-8" />
          </Button>
        </div>

        <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white z-10">
          {friendName} {callStatus === 'connected' && '• Connected'}
        </div>
      </DialogContent>
    </Dialog>
  );
};