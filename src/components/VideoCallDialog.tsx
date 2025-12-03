// src/components/VideoCallDialog.tsx
import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  friendId: string;
  userId: string;
  userName: string;
}

export const VideoCallDialog = ({
  open,
  onOpenChange,
  friendName,
  friendId,
  userId,
  userName,
}: VideoCallDialogProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    const startCall = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, friendId, userName, friendName }),
        });

        const rawText = await res.text();
        console.log('Daily API raw response:', rawText);

        if (!res.ok) throw new Error(rawText || 'Failed to create room');

        const data = JSON.parse(rawText);

        // CRITICAL FIX: Use url ONLY here
        const callFrame = DailyIframe.createCallObject({
          url: data.url,           // only url
          showLeaveButton: false,
          showFullscreenButton: true,
        });

        callFrameRef.current = callFrame;

        const iframe = callFrame.iframe();
        if (iframe && frameRef.current) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          frameRef.current.appendChild(iframe);
        }

        // Join with token + name here
        await callFrame.join({
          userName,
          token: data.token,       // token goes here
        });

        setLoading(false);
      } catch (err: any) {
        console.error('Video call failed:', err);
        setError(err.message || 'Failed to connect');
        setLoading(false);
      }
    };

    startCall();

    return () => {
      callFrameRef.current?.destroy();
      callFrameRef.current = null;
      frameRef.current && (frameRef.current.innerHTML = '');
    };
  }, [open, userId, friendId, userName, friendName]);

  const toggleMic = () => callFrameRef.current?.setLocalAudio(callFrameRef.current?.localAudio() === false);
  const toggleCam = () => callFrameRef.current?.setLocalVideo(callFrameRef.current?.localVideo() === false);
  const leaveCall = () => {
    callFrameRef.current?.leave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden h-[85vh] bg-black">
        <div className="relative w-full h-full flex flex-col">
          <div ref={frameRef} className="flex-1 bg-black" />

          {loading && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p className="text-xl">Connecting to {friendName}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <p className="text-xl mb-6">{error}</p>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md rounded-full px-8 py-4 flex gap-6">
            <Button size="icon" className="h-14 w-14 rounded-full" onClick={toggleMic}>
              {callFrameRef.current?.localAudio() ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>
            <Button size="icon" className="h-14 w-14 rounded-full" onClick={toggleCam}>
              {callFrameRef.current?.localVideo() ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <Button size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={leaveCall}>
              <PhoneOff className="h-7 w-7" />
            </Button>
          </div>

          <div className="absolute top-4 left-4 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
            Calling {friendName}...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ); 
}; 