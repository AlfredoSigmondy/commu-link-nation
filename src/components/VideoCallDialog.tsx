// src/components/VideoCallDialog.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface Props {
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
}: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const leaveCall = useCallback(() => {
    callFrameRef.current?.leave();
    callFrameRef.current?.destroy();
    onOpenChange(false);
  }, [onOpenChange]);

  // Cleanup on unmount or dialog close
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !frameRef.current) return;

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
            userName: userName || 'User',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create call room');
        }

        const { url, token } = await res.json();

        // Create Daily call object
        const callFrame = DailyIframe.createCallObject({
          url,
          showLeaveButton: false,
          showFullscreenButton: true,
          showParticipantsBar: false,
        });

        callFrameRef.current = callFrame;

        // Append iframe
        const iframe = callFrame.iframe()!;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        frameRef.current!.innerHTML = '';
        frameRef.current!.appendChild(iframe);

        // Sync mic/cam state
        const syncMediaState = () => {
          if (!mounted) return;
          setMicOn(callFrame.localAudio() ?? true);
          setCamOn(callFrame.localVideo() ?? true);
        };

        callFrame
          .on('joined-meeting', () => {
            if (mounted) {
              setLoading(false);
              syncMediaState();
            }
          })
          .on('track-started', syncMediaState)
          .on('track-stopped', syncMediaState)
          .on('left-meeting', leaveCall)
          .on('error', (e) => {
            if (mounted) {
              setError(e?.error?.message || 'Call error');
              setLoading(false);
            }
          });

        await callFrame.join({ token });

      } catch (err: any) {
        if (mounted) {
          console.error('Video call failed:', err);
          setError(err.message || 'Failed to connect');
          setLoading(false);
        }
      }
    };

    startCall();

    return () => {
      mounted = false;
    };
  }, [open, userId, friendId, userName, leaveCall]);

  const toggleMic = () => callFrameRef.current?.setLocalAudio(!micOn);
  const toggleCam = () => callFrameRef.current?.setLocalVideo(!camOn);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && leaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden">
        <div ref={frameRef} className="relative w-full h-full" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center text-white">
              <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6" />
              <p className="text-2xl font-medium">Connecting to {friendName}...</p>
              <p className="text-gray-400 mt-2">Setting up secure video call</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center text-white max-w-md">
              <div className="bg-red-500/20 border border-red-500 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <PhoneOff className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Call Failed</h3>
              <p className="text-gray-300 mb-6">{error}</p>
              <Button onClick={leaveCall} size="lg">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Control Bar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-2xl z-40">
          <Button
            size="icon"
            variant={micOn ? 'default' : 'secondary'}
            className="h-14 w-14 rounded-full"
            onClick={toggleMic}
          >
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>

          <Button
            size="icon"
            variant={camOn ? 'default' : 'secondary'}
            className="h-14 w-14 rounded-full"
            onClick={toggleCam}
          >
            {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <Button
            size="icon"
            variant="destructive"
            className="h-16 w-16 rounded-full shadow-lg"
            onClick={leaveCall}
          >
            <PhoneOff className="h-8 w-8" />
          </Button>
        </div>

        {/* Top bar: Friend name */}
        <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white text-lg font-medium z-40">
          Calling {friendName}
        </div>
      </DialogContent>
    </Dialog>
  );
};