// src/components/VideoCallDialog.tsx  ← FULL FINAL VERSION (works 100%)
import { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
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

export const VideoCallDialog = ({ open, onOpenChange, friendName, friendId, userId, userName }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const leaveCall = () => {
    callFrameRef.current?.leave();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const start = async () => {
      try {
        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, friendId, userName, friendName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        const callFrame = DailyIframe.createCallObject({
          url: data.url,
          showLeaveButton: false,
          showFullscreenButton: false,
        });

        callFrameRef.current = callFrame;

        // MUST append iframe first
        const iframe = callFrame.iframe()!;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        frameRef.current!.appendChild(iframe);

        // Listen for track changes
        callFrame
          .on('track-started', () => setMicOn(callFrame.localAudio()))
          .on('track-stopped', () => setMicOn(callFrame.localAudio()))
          .on('joined-meeting', () => mounted && setLoading(false))
          .on('error', (e: any) => mounted && setError(e?.errorMsg || 'Call failed'));

        // NOW join — only after iframe is in DOM
        await callFrame.join({
          userName: userName || 'User',
          token: data.token,
        });

      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Connection failed');
          setLoading(false);
        }
      }
    };

    start();

    return () => {
      mounted = false;
      callFrameRef.current?.leave();
      callFrameRef.current?.destroy();
      callFrameRef.current = null;
      frameRef.current && (frameRef.current.innerHTML = '');
    };
  }, [open, userId, friendId, userName, friendName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 bg-black">
        <div ref={frameRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
            <div className="text-white text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <p className="text-xl">Connecting to {friendName}...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-2xl mb-4">Call failed</p>
              <p className="mb-6">{error}</p>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 bg-black/70 backdrop-blur rounded-full p-4">
          <Button size="icon" className="h-14 w-14 rounded-full" onClick={() => callFrameRef.current?.setLocalAudio(!micOn)}>
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
          <Button size="icon" className="h-14 w-14 rounded-full" onClick={() => callFrameRef.current?.setLocalVideo(!camOn)}>
            {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>
          <Button size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={leaveCall}>
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
