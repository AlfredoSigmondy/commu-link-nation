// src/components/VideoCallDialog.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [, forceUpdate] = useState<{}>({}); // For mic/cam reactivity

  // Toggle functions with proper current state
  const toggleMic = useCallback(() => {
    const enabled = callFrameRef.current?.localAudio() ?? false;
    callFrameRef.current?.setLocalAudio(!enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const enabled = callFrameRef.current?.localVideo() ?? false;
    callFrameRef.current?.setLocalVideo(!enabled);
  }, []);

  const leaveCall = useCallback(() => {
    callFrameRef.current?.leave();
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const startCall = async () => {
      if (!mounted) return;

      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            friendId,
            userName: userName || 'User',
            friendName,
          }),
        });

        const rawText = await res.text();
        if (!res.ok) throw new Error(rawText || 'Failed to create room');

        const data = JSON.parse(rawText);

        const callFrame = DailyIframe.createCallObject({
          url: data.url,
          showLeaveButton: false,
          showFullscreenButton: true,
          showParticipantsBar: false,
        });

        callFrameRef.current = callFrame;

        // Append iframe
        const iframe = callFrame.iframe();
        if (iframe && frameRef.current) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          frameRef.current.appendChild(iframe);
        }

        // Listen to events for reactive UI
        callFrame
          .on('joined-meeting', () => {
            if (mounted) setLoading(false);
          })
          .on('left-meeting', () => {
            if (mounted) onOpenChange(false);
          })
          .on('error', (e) => {
            if (mounted) {
              setError(e?.errorMsg || 'Connection failed');
              setLoading(false);
            }
          })
          .on('track-started', () => forceUpdate({}))
          .on('track-stopped', () => forceUpdate({}))
          .on('participant-updated', () => forceUpdate({}));

        // Join with secure token
        await callFrame.join({
          userName: userName || 'User',
          token: data.token,
        });

      } catch (err: any) {
        if (mounted) {
          console.error('Video call error:', err);
          setError(err.message || 'Failed to connect to call');
          setLoading(false);
        }
      }
    };

    startCall();

    return () => {
      mounted = false;

      if (callFrameRef.current) {
        callFrameRef.current
          .off('joined-meeting')
          .off('left-meeting')
          .off('error')
          .off('track-started')
          .off('track-stopped')
          .off('participant-updated');

        callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }

      if (frameRef.current) {
        frameRef.current.innerHTML = '';
      }
    };
  }, [open, userId, friendId, userName, friendName, toggleMic, toggleCam, leaveCall, onOpenChange]);

  const isMicOn = callFrameRef.current?.localAudio() ?? false;
  const isCamOn = callFrameRef.current?.localVideo() ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden h-[90vh] bg-black rounded-2xl">
        <div className="relative w-full h-full flex flex-col">
          {/* Daily.co iframe container */}
          <div ref={frameRef} className="flex-1 bg-black relative" />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
              <div className="text-white text-center">
                <Loader2 className="h-14 w-14 animate-spin mx-auto mb-6" />
                <p className="text-2xl font-medium">Connecting to {friendName}...</p>
                <p className="text-sm text-gray-400 mt-2">Setting up secure video call</p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
              <div className="text-white text-center max-w-md">
                <p className="text-xl mb-6">Call failed</p>
                <p className="text-gray-300 mb-8">{error}</p>
                <Button onClick={() => onOpenChange(false)} size="lg">
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Control Bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-10 py-5 flex gap-8 shadow-2xl">
            <Button
              size="icon"
              className={`h-16 w-16 rounded-full transition-all ${isMicOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={toggleMic}
            >
              {isMicOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
            </Button>

            <Button
              size="icon"
              className={`h-16 w-16 rounded-full transition-all ${isCamOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={toggleCam}
            >
              {isCamOn ? <Video className="h-7 w-7" /> : <VideoOff className="h-7 w-7" />}
            </Button>

            <Button
              size="icon"
              variant="destructive"
              className="h-18 w-18 rounded-full hover:scale-110 transition-transform"
              onClick={leaveCall}
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
          </div>

          {/* Top Status */}
          <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-md text-white px-5 py-3 rounded-full text-lg font-medium border border-white/20">
            Calling {friendName}...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};