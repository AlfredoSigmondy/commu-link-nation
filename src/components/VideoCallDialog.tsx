import { useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
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
  const callFrameRef = useRef<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (!open || !frameRef.current) return;

    const startCall = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            friendId,
            userName,
            friendName,
          }),
        });

        // Debug: Log everything before parsing
        console.log('API Response Status:', res.status);
        console.log('API Response Headers:', Object.fromEntries(res.headers.entries()));
        const rawText = await res.text();
        console.log('Raw Response Body:', rawText);

        if (!res.ok) {
          console.error('API failed with status:', res.status);
          throw new Error(`Server error ${res.status}: ${rawText.substring(0, 200)}`);
        }

        // Parse JSON safely
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          console.error('Invalid JSON received:', rawText.substring(0, 500));
          throw new Error('Invalid response from server (not JSON)');
        }

        // Success: Create Daily.co call
        const callFrame = DailyIframe.createCallObject({
          url: data.url,
          token: data.token,
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

        await callFrame.join({ userName });
        setLoading(false);
      } catch (err: any) {
        console.error('Video call error:', err);
        setError(err.message || 'Failed to start video call');
        setLoading(false);
      }
    };

    startCall();

    // Cleanup
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
      if (frameRef.current) {
        frameRef.current.innerHTML = '';
      }
    };
  }, [open, userId, friendId, userName, friendName]);

  const toggleMic = () => {
    callFrameRef.current?.setLocalAudio(!micOn);
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    callFrameRef.current?.setLocalVideo(!camOn);
    setCamOn(!camOn);
  };

  const leaveCall = () => {
    callFrameRef.current?.leave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden h-[85vh] bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Daily.co iframe container */}
          <div ref={frameRef} className="flex-1 relative bg-black" />

          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p className="text-lg">Connecting to {friendName}...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <p className="text-lg mb-6">{error}</p>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md rounded-full px-8 py-4 flex items-center gap-6">
            <Button
              size="icon"
              variant={micOn ? 'secondary' : 'destructive'}
              className="rounded-full h-14 w-14"
              onClick={toggleMic}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>

            <Button
              size="icon"
              variant={camOn ? 'secondary' : 'destructive'}
              className="rounded-full h-14 w-14"
              onClick={toggleCam}
            >
              {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>

            <Button
              size="icon"
              variant="destructive"
              className="rounded-full h-16 w-16"
              onClick={leaveCall}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
          </div>

          <div className="absolute top-4 left-4 bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur">
            Calling {friendName}...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};