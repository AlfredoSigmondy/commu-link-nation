// src/components/VideoCallDialog.tsx
import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [callUrl, setCallUrl] = useState<string>('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [apiStatus, setApiStatus] = useState<'pending' | 'success' | 'error'>('pending');

  const setupCall = async () => {
    try {
      setLoading(true);
      setError('');
      setApiStatus('pending');
      
      console.log('🔄 Starting video call setup...');

      // Use the backend server
      const BACKEND_URL = 'https://communitymatch.vercel.app';
      
      console.log('Calling backend:', `${BACKEND_URL}/api/create-daily-room`);
      console.log('Request data:', { userId, friendId, userName });

      const response = await fetch(`${BACKEND_URL}/api/create-daily-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          friendId, 
          userName: userName || 'User' 
        }),
      });

      console.log('Backend response status:', response.status, response.statusText);

      // Get response as text first
      const responseText = await response.text();
      console.log('Backend response text:', responseText);

      if (!response.ok) {
        let errorDetails = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetails = errorJson.error || errorJson.message || responseText;
        } catch {
          // Not JSON
        }
        
        setApiStatus('error');
        throw new Error(`Backend error ${response.status}: ${errorDetails}`);
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('✅ Backend success:', data);
        setApiStatus('success');
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        setApiStatus('error');
        throw new Error('Invalid JSON response from backend');
      }

      if (!data.url || !data.token) {
        console.error('Missing URL or token:', data);
        setApiStatus('error');
        throw new Error(data.error || 'Invalid response from backend');
      }

      // Create the Daily.co URL
      const dailyUrl = `${data.url}?t=${data.token}`;
      console.log('🔗 Daily.co URL:', dailyUrl);
      
      setCallUrl(dailyUrl);
      
      // Show iframe
      setTimeout(() => {
        console.log('✅ Call setup complete');
        setLoading(false);
      }, 2000);

    } catch (err: any) {
      console.error('❌ Call setup failed:', err);
      setError(err.message || 'Failed to set up call. Make sure backend server is running.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    console.log('VideoCallDialog opened, calling setupCall...');
    setupCall();
  }, [open, userId, friendId, userName]);

  const handleLeaveCall = () => {
    onOpenChange(false);
    setCallUrl('');
    setError('');
    setApiStatus('pending');
  };

  const retrySetup = async () => {
    setError('');
    setLoading(true);
    setApiStatus('pending');
    
    try {
      const BACKEND_URL = 'https://communitymatch.vercel.app';
      const response = await fetch(`${BACKEND_URL}/api/create-daily-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendId, userName }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      if (data.url && data.token) {
        setCallUrl(`${data.url}?t=${data.token}`);
        setApiStatus('success');
        setTimeout(() => setLoading(false), 2000);
      } else {
        throw new Error('Missing URL or token in response');
      }
    } catch (err: any) {
      setError(err.message);
      setApiStatus('error');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleLeaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden border-0">
        
        {/* Daily.co iframe - only show when we have a URL */}
        {callUrl && (
          <iframe
            src={callUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture"
            title={`Video call with ${friendName}`}
            allowFullScreen
            onLoad={() => {
              console.log('Daily.co iframe loaded');
              setLoading(false);
            }}
            onError={() => {
              console.error('Daily.co iframe failed to load');
              setError('Failed to load video call interface');
              setLoading(false);
            }}
          />
        )}

        {/* Debug info overlay - shows API status */}
        <div className="absolute top-4 right-4 bg-black/70 text-white text-xs p-2 rounded z-50">
          API: {apiStatus} | Loading: {loading.toString()}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-40">
            <Loader2 className="h-16 w-16 animate-spin text-[#2ec2b3] mb-6" />
            <p className="text-2xl font-medium text-white mb-2">
              {apiStatus === 'pending' ? 'Connecting...' : 'Starting call...'}
            </p>
            <p className="text-gray-400 mb-4">with {friendName}</p>
            <div className="text-sm text-gray-500 mt-4">
              <p>User ID: {userId?.substring(0, 8)}...</p>
              <p>Friend ID: {friendId?.substring(0, 8)}...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-40">
            <div className="text-center text-white max-w-md p-6">
              <div className="bg-red-500/20 border border-red-500 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <PhoneOff className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Call Setup Failed</h3>
              <p className="text-gray-300 mb-4 p-3 bg-red-900/30 rounded break-words">{error}</p>
              
              <div className="mt-6 p-4 bg-gray-800/50 rounded">
                <h4 className="font-bold mb-2">Troubleshooting:</h4>
                <ul className="text-sm text-gray-300 text-left space-y-1">
                  <li>1. Check if API endpoint is deployed: <code>https://communitymatch.vercel.app/api/create-daily-room</code></li>
                  <li>2. Verify DAILY_API_KEY in Vercel environment variables</li>
                  <li>3. Check browser console for detailed error</li>
                </ul>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button onClick={retrySetup} variant="outline" className="flex-1">
                  Retry
                </Button>
                <Button onClick={handleLeaveCall} className="flex-1 bg-red-500 hover:bg-red-600">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Simple fallback if everything fails */}
        {!callUrl && !loading && !error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
            <p className="text-white text-xl mb-4">Could not start video call</p>
            <Button onClick={retrySetup} className="mb-4">
              Try Again
            </Button>
            <Button onClick={handleLeaveCall} variant="outline">
              Cancel
            </Button>
          </div>
        )}

        {/* Controls */}
        {!loading && !error && callUrl && (
          <>
            <div className="absolute top-6 left-6 bg-black/70 backdrop-blur rounded-full px-5 py-2 text-white text-lg font-medium z-40">
              Call with {friendName}
            </div>
            
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-2xl z-40">
              <Button
                size="icon"
                variant={micOn ? "default" : "destructive"}
                className="h-12 w-12 rounded-full"
                onClick={() => setMicOn(!micOn)}
              >
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>

              <Button
                size="icon"
                variant={camOn ? "default" : "destructive"}
                className="h-12 w-12 rounded-full"
                onClick={() => setCamOn(!camOn)}
              >
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>

              <Button
                size="icon"
                variant="destructive"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={handleLeaveCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};