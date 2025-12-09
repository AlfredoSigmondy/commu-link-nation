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

  useEffect(() => {
    if (!open) {
      if (callFrameRef.current) {
        leaveCall();
      }
      return;
    }

    let mounted = true;
    let joinAttempts = 0;
    const maxAttempts = 3;

    const startCall = async () => {
      if (!frameRef.current) return;
      
      try {
        setLoading(true);
        setError('');

        // Try to get room URL and token
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
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to create room');
        }

        const { url, token } = await res.json();

        // Clean up existing frame
        if (callFrameRef.current) {
          callFrameRef.current.leave();
          callFrameRef.current.destroy();
          callFrameRef.current = null;
        }

        // Create new Daily iframe
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

        // Set up event listeners
        callFrame
          .on('loaded', () => {
            console.log('Daily iframe loaded');
          })
          .on('joining-meeting', () => {
            console.log('Joining meeting...');
          })
          .on('joined-meeting', (event) => {
            console.log('Successfully joined meeting:', event);
            if (mounted) {
              setLoading(false);
              setCallStarted(true);
              setMicOn(callFrame.localAudio());
              setCamOn(callFrame.localVideo());
            }
          })
          .on('participant-joined', (event) => {
            console.log('Participant joined:', event?.participant?.user_name);
          })
          .on('participant-left', (event) => {
            console.log('Participant left:', event?.participant?.user_name);
          })
          .on('error', (errorEvent) => {
            console.error('Daily error:', errorEvent);
            if (mounted) {
              setError(errorEvent?.errorMsg || 'Connection failed');
              setLoading(false);
            }
          })
          .on('left-meeting', () => {
            console.log('Left meeting');
            if (mounted) {
              leaveCall();
            }
          });

        // Join the call
        console.log('Attempting to join call with token...');
        await callFrame.join({
          url,
          token,
          userName: userName || 'User',
        });

      } catch (err: any) {
        console.error('Failed to start call:', err);
        if (mounted) {
          setError(err.message || 'Failed to start video call');
          setLoading(false);
          
          // Retry logic
          if (joinAttempts < maxAttempts) {
            joinAttempts++;
            setTimeout(startCall, 1000 * joinAttempts); // Exponential backoff
          }
        }
      }
    };

    if (open) {
      startCall();
    }

    return () => {
      mounted = false;
    };
  }, [open, userId, friendId, userName, leaveCall]);

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

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
            <Loader2 className="h-16 w-16 animate-spin text-[#2ec2b3] mb-6" />
            <p className="text-2xl font-medium text-white mb-2">Setting up call with {friendName}...</p>
            <p className="text-gray-400">This may take a few seconds</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center text-white max-w-md p-6">
              <div className="bg-red-500/20 border border-red-500 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <PhoneOff className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Call Failed</h3>
              <p className="text-gray-300 mb-4">{error}</p>
              <div className="flex gap-3">
                <Button onClick={() => setError('')} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={leaveCall} className="flex-1 bg-red-500 hover:bg-red-600">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {callStarted && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-2xl z-40">
            <Button
              size="icon"
              variant={micOn ? "default" : "destructive"}
              className="h-14 w-14 rounded-full"
              onClick={toggleMic}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>

            <Button
              size="icon"
              variant={camOn ? "default" : "destructive"}
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

        {/* Call Status */}
        <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white text-lg font-medium z-40">
          {callStarted ? `Call with ${friendName}` : `Connecting to ${friendName}...`}
        </div>
      </DialogContent>
    </Dialog>
  );
};