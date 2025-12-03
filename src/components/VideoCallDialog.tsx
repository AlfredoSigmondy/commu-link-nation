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
        // In VideoCallDialog.tsx, inside the `startCall` function:
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

// NEW: Log raw response for debugging
                console.log('API Status:', res.status);
                console.log('API Headers:', [...res.headers.entries()]);
                const rawText = await res.text();  // Get raw text first
                console.log('Raw Response Body:', rawText);  // This will reveal HTML or error

                if (!res.ok) {
                  console.error('API Error Status:', res.status, 'Body:', rawText);
                  throw new Error(`API failed: ${res.status} - ${rawText.substring(0, 200)}...`);  // Truncate for console
                }

                let data;
                try {
                  data = JSON.parse(rawText);  // Parse manually after logging
                } catch (parseErr) {
                  console.error('JSON Parse Error:', parseErr);
                  console.error('Failed to parse:', rawText.substring(0, 500));  // Show first 500 chars
                  throw new Error('Invalid JSON from API: ' + rawText.substring(0, 200));
                }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start call');

        // Create Daily call object
        const callFrame = DailyIframe.createCallObject({
          url: data.url,
          token: data.token,
          showLeaveButton: false,
          showFullscreenButton: true,
        });

        callFrameRef.current = callFrame;

        // Fix: Set iframe style safely
        const iframe = callFrame.iframe();
        if (iframe) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
        }

        // Append iframe to container
        if (frameRef.current && iframe) {
          frameRef.current.appendChild(iframe);
        }

        await callFrame.join({ userName });

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to start video call');
        setLoading(false);
      }
    };

    startCall();

    // Cleanup on unmount or close
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

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p className="text-lg">Connecting to {friendName}...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <p className="text-lg mb-6">{error}</p>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}

          {/* Call controls */}
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

          {/* Top label */}
          <div className="absolute top-4 left-4 bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur">
            Calling {friendName}...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};