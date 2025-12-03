// components/VideoCallDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  friendId: string;
  userId: string;
  userName: string;
}

export function VideoCallDialog({
  open,
  onOpenChange,
  friendName,
  friendId,
  userId,
  userName,
}: VideoCallDialogProps) {
  const { toast } = useToast();
  const [roomUrl, setRoomUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const startCall = async () => {
      const roomName = `call-${userId}-${friendId}-${Date.now()}`;

      try {
        const res = await fetch('/api/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            userName: userName || 'User',
            isOwner: true,
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setRoomUrl(data.url);
        setToken(data.token);

        toast({
          title: 'Calling...',
          description: `Connecting to ${friendName}`,
        });
      } catch (err: any) {
        toast({
          title: 'Call failed',
          description: err.message || 'Could not start video call',
          variant: 'destructive',
        });
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    startCall();
  }, [open, userId, friendId, userName, friendName, toast, onOpenChange]);

  const handleEndCall = () => {
    setRoomUrl('');
    setToken('');
    onOpenChange(false);
    toast({
      title: 'Call ended',
      description: 'Video call disconnected',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Video Call with {friendName}</DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-gray-900">
          {/* Daily.co iframe — full video call */}
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-white text-2xl animate-pulse">Ringing...</p>
            </div>
          ) : (
            <iframe
              src={`${roomUrl}?t=${token}`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full"
              title="Video Call"
            />
          )}

          {/* Your beautiful remote placeholder (only shows while connecting) */}
          {loading && (
            <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="w-12 h-12 bg-[#2ec2b3] rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    {friendName[0]}
                  </div>
                  <p className="text-xs">Connecting...</p>
                </div>
              </div>
            </div>
          )}

          {/* Your exact control bar — unchanged */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            {/* Daily.co handles mute/video internally, but we keep your buttons for style */}
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full w-14 h-14"
              onClick={() => toast({ description: 'Use Daily.co controls in the call' })}
            >
              <Video className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full w-14 h-14"
              onClick={() => toast({ description: 'Use Daily.co controls in the call' })}
            >
              <Mic className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={handleEndCall}
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}