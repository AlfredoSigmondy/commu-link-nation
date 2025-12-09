// src/components/VideoCallDialog.tsx
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

export const VideoCallDialog = ({
  open,
  onOpenChange,
  friendName,
  friendId,
  userId,
  userName,
}: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [callStarted, setCallStarted] = useState(false);

  const leaveCall = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }
    setCallStarted(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.leave();
        callFrameRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !frameRef.current) {
      if (callFrameRef.current) leaveCall();
      return;
    }

    let mounted = true;
    let cleanupInterval: NodeJS.Timeout;

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
          const err = await res.text();
          throw new Error(err || 'Failed to create room');
        }

        const { url, token } = await res.json();

        // Destroy existing frame if any
        if (callFrameRef.current) {
          callFrameRef.current.leave();
          callFrameRef.current.destroy();
        }

        // Create new frame
        const callFrame = DailyIframe.createFrame(frameRef.current!, {
          showLeaveButton: false,
          showFullscreenButton: true,
          showParticipantsBar: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '16px',
          },
        });

        callFrameRef.current = callFrame;

        // Event listeners
        callFrame
          .on('joined-meeting', () => {
            if (mounted) {
              setLoading(false);
              setCallStarted(true);
              setMicOn(callFrame.localAudio() ?? true);
              setCamOn(callFrame.localVideo() ?? true);
            }
          })
          .on('participant-joined', (ev: any) => {
            if (mounted) {
              console.log('Participant joined:', ev.participant.user_name);
            }
          })
          .on('participant-left', (ev: any) => {
            if (mounted) {
              console.log('Participant left:', ev.participant.user_name);
              // Auto leave if all other participants left
              if (callFrame.participants()?.local) {
                const participants = Object.values(callFrame.participants());
                if (participants.length <= 1) {
                  leaveCall();
                }
              }
            }
          })
          .on('error', (e: any) => {
            if (mounted) {
              console.error('Daily error:', e);
              setError(e?.error?.message || 'Connection failed');
              setLoading(false);
            }
          });

        // Join the call
        await callFrame.join({
          url,
          token,
          userName: userName || 'User',
          audioSource: micOn,
          videoSource: camOn,
        });

        // Set up cleanup interval to check call state
        cleanupInterval = setInterval(() => {
          if (callFrame.meetingState() === 'left') {
            leaveCall();
          }
        }, 5000);

      } catch (err: any) {
        if (mounted) {
          console.error('Video call error:', err);
          setError(err.message || 'Failed to start call');
          setLoading(false);
        }
      }
    };

    startCall();

    return () => {
      mounted = false;
      if (cleanupInterval) clearInterval(cleanupInterval);
    };
  }, [open, userId, friendId, userName, leaveCall, micOn, camOn]);

  const toggleMic = () => {
    if (callFrameRef.current) {
      const newState = !micOn;
      callFrameRef.current.setLocalAudio(newState);
      setMicOn(newState);
    }
  };

  const toggleCam = () => {
    if (callFrameRef.current) {
      const newState = !camOn;
      callFrameRef.current.setLocalVideo(newState);
      setCamOn(newState);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && leaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden border-0">
        <div ref={frameRef} className="w-full h-full bg-black" />

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center text-white">
              <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6" />
              <p className="text-2xl font-medium">Calling {friendName}...</p>
              <p className="text-gray-400 mt-2">Setting up secure video call</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center text-white max-w-md">
              <div className="bg-red-500/20 border border-red-500 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <PhoneOff className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Call Failed</h3>
              <p className="text-gray-300 mb-6">{error}</p>
              <Button onClick={leaveCall} size="lg" className="bg-red-500 hover:bg-red-600">
                Close Call
              </Button>
            </div>
          </div>
        )}

        {/* Controls - Only show when call is active */}
        {callStarted && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-2xl z-40">
            <Button
              size="icon"
              variant={micOn ? 'default' : 'destructive'}
              className="h-14 w-14 rounded-full"
              onClick={toggleMic}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>

            <Button
              size="icon"
              variant={camOn ? 'default' : 'destructive'}
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
        )}

        {/* Call info */}
        {callStarted && (
          <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white text-lg font-medium z-40">
            ✓ Connected to {friendName}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};