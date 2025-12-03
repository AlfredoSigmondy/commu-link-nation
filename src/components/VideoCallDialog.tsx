// src/components/VideoCallDialog.tsx
import { useEffect, useState } from 'react';
import {
  useHMSActions,
  useHMSStore,
  selectIsConnectedToRoom,
  selectLocalPeer,
  selectPeers,
  HMSNotificationTypes,
} from '@100mslive/react-sdk';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
} from 'lucide-react';

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
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const localPeer = useHMSStore(selectLocalPeer);
  const peers = useHMSStore(selectPeers);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const startCall = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/create-100ms-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, friendId, userName }),
        });

        const { token } = await res.json();

        await hmsActions.join({
          userName: userName || 'User',
          authToken: token,
          settings: {
            isAudioMuted: false,
            isVideoMuted: false,
          },
        });

        if (mounted) setLoading(false);
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to join call');
          setLoading(false);
        }
      }
    };

    startCall();

    return () => {
      mounted = false;
      hmsActions.leave();
    };
  }, [open, userId, friendId, userName, hmsActions]);

  const toggleMic = () => hmsActions.setLocalAudioEnabled(!localPeer?.audioTrack?.enabled);
  const toggleCam = () => hmsActions.setLocalVideoEnabled(!localPeer?.videoTrack?.enabled);
  const toggleScreen = () => hmsActions.setScreenShareEnabled(!localPeer?.auxiliaryTracks?.[0]?.enabled);

  const leaveCall = () => {
    hmsActions.leave();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && leaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden">
        <div className="relative w-full h-full flex flex-col">
          {/* Remote Video Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {peers
              .filter((p) => p.id !== localPeer?.id)
              .map((peer) => (
                <div key={peer.id} className="relative rounded-2xl overflow-hidden bg-gray-900">
                  <hmsVideoTile peer={peer} />
                  <div className="absolute bottom-4 left-4 text-white bg-black/60 px-3 py-1 rounded">
                    {peer.name}
                  </div>
                </div>
              ))}
          </div>

          {/* Local Video */}
          {localPeer && (
            <div className="absolute bottom-28 left-6 w-64 h-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
              <hmsVideoTile peer={localPeer} isLocal />
            </div>
          )}

          {/* Loading / Error */}
          {loading && (
            <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
              <div className="text-center text-white">
                <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6" />
                <p className="text-2xl font-medium">Connecting to {friendName}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
              <div className="text-center text-white">
                <p className="text-2xl mb-6">{error}</p>
                <Button onClick={leaveCall} size="lg">Close</Button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/80 backdrop-blur-xl rounded-full px-8 py-5 z-40">
            <Button size="icon" className="h-14 w-14 rounded-full" onClick={toggleMic}>
              {localPeer?.audioTrack?.enabled ? <Mic /> : <MicOff />}
            </Button>
            <Button size="icon" className="h-14 w-14 rounded-full" onClick={toggleCam}>
              {localPeer?.videoTrack?.enabled ? <Video /> : <VideoOff />}
            </Button>
            <Button size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={leaveCall}>
              <PhoneOff className="h-8 w-8" />
            </Button>
          </div>

          <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white text-lg font-medium">
            Calling {friendName}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Tiny helper component
function hmsVideoTile({ peer, isLocal = false }: { peer: any; isLocal?: boolean }) {
  const videoRef = (node: HTMLVideoElement) => {
    if (node && peer?.videoTrack) {
      hmsActions.attachVideo(peer.videoTrack, node);
    }
  };

  const hmsActions = useHMSActions();

  useEffect(() => {
    return () => {
      if (peer?.videoTrack) hmsActions.detachVideo(peer.videoTrack);
    };
  }, [peer?.videoTrack]);

  return peer?.videoTrack ? (
    <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-4xl">
      {peer.name[0]}
    </div>
  );
}