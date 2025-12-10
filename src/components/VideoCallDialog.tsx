// src/components/VideoCallDialog.tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'; // Added DialogTitle
import { Button } from '@/components/ui/button';
import { Loader2, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  friendId: string;
  userId: string;
  userName: string;
  roomUrl?: string; // Add this
  skipApiCall?: boolean; // Add this
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

// Update the Props interface:
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  friendId: string;
  userId: string;
  userName: string;
  roomUrl?: string; // Add this
  skipApiCall?: boolean; // Add this
}

// In the component, modify setupCall:
const setupCall = async () => {
  try {
    setLoading(true);
    setError('');
    setApiStatus('pending');
    
    console.log('🔄 Starting video call setup...');
    
    // OPTION 1: Use provided roomUrl and skip API
    if (roomUrl && skipApiCall) {
      console.log('🚀 Using provided room URL (skipping API):', roomUrl);
      setCallUrl(roomUrl);
      setApiStatus('success');
      setTimeout(() => {
        console.log('✅ Call setup complete using existing room');
        setLoading(false);
      }, 1000);
      return;
    }
    
    // OPTION 2: Try the API (will fail until deployed)
    console.log('⚠️ No room URL provided, trying API...');
    const BACKEND_URL = 'https://communitymatch.vercel.app';
    
    console.log('Calling backend:', `${BACKEND_URL}/api/create-daily-room`);
    console.log('Request data:', { userId, friendId, userName });

    const response = await fetch(`${BACKEND_URL}/api/create-daily-room`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ 
        userId, 
        friendId, 
        userName: userName || 'User' 
      }),
    });

    // ... rest of your API call code
  } catch (err: any) {
    console.error('❌ Call setup failed:', err)
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
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ userId, friendId, userName }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Retry error:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.url) {
        const dailyUrl = data.token ? `${data.url}?t=${data.token}` : data.url;
        setCallUrl(dailyUrl);
        setApiStatus('success');
        setTimeout(() => setLoading(false), 2000);
      } else {
        throw new Error('Missing URL in response');
      }
    } catch (err: any) {
      setError(err.message);
      setApiStatus('error');
      setLoading(false);
    }
  };

  // Test API endpoint directly (for debugging)
  const testApiEndpoint = async () => {
    try {
      console.log('🧪 Testing API endpoint...');
      const BACKEND_URL = 'https://communitymatch.vercel.app';
      
      // Test with GET first to see if endpoint exists
      const testResponse = await fetch(`${BACKEND_URL}/api/create-daily-room`, {
        method: 'GET',
      });
      
      console.log('Test GET response:', testResponse.status, testResponse.statusText);
      
      // Test with POST
      const postResponse = await fetch(`${BACKEND_URL}/api/create-daily-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'test-user-id', 
          friendId: 'test-friend-id', 
          userName: 'Test User' 
        }),
      });
      
      console.log('Test POST response:', postResponse.status, postResponse.statusText);
      const text = await postResponse.text();
      console.log('Test POST response text:', text);
      
      alert(`GET: ${testResponse.status}, POST: ${postResponse.status}\nSee console for details.`);
    } catch (error) {
      console.error('Test failed:', error);
      alert('Test failed. Check console.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleLeaveCall()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black rounded-2xl overflow-hidden border-0">
        {/* Added DialogTitle for accessibility */}
        <DialogTitle className="sr-only">Video Call with {friendName}</DialogTitle>
        
        {/* Added aria-describedby for accessibility */}
        <div className="sr-only" id="call-description">
          Video call interface with {friendName}. Use microphone and camera controls below.
        </div>

        {/* Daily.co iframe - only show when we have a URL */}
        {callUrl && (
          <iframe
            src={callUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture"
            title={`Video call with ${friendName}`}
            allowFullScreen
            aria-describedby="call-description"
            onLoad={() => {
              console.log('Daily.co iframe loaded');
              setLoading(false);
            }}
            onError={() => {
              console.error('Daily.co iframe failed to load');
              setError('Failed to load video call interface. Please check your Daily.co configuration.');
              setLoading(false);
            }}
          />
        )}

        {/* Debug info overlay - shows API status */}
        <div className="absolute top-4 right-4 bg-black/70 text-white text-xs p-2 rounded z-50 flex flex-col gap-1">
          <div>API: <span className={apiStatus === 'success' ? 'text-green-400' : apiStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}>
            {apiStatus}
          </span></div>
          <div>Loading: {loading.toString()}</div>
          <Button 
            size="xs" 
            variant="outline" 
            className="mt-1 text-xs h-6"
            onClick={testApiEndpoint}
            title="Test API endpoint"
          >
            Test API
          </Button>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-40">
            <Loader2 className="h-16 w-16 animate-spin text-[#2ec2b3] mb-6" />
            <p className="text-2xl font-medium text-white mb-2">
              {apiStatus === 'pending' ? 'Connecting to server...' : 'Starting call...'}
            </p>
            <p className="text-gray-400 mb-4">with {friendName}</p>
            <div className="text-sm text-gray-500 mt-4 text-center">
              <p>User ID: {userId?.substring(0, 8)}...</p>
              <p>Friend ID: {friendId?.substring(0, 8)}...</p>
              <p className="mt-2 text-xs">Status: {apiStatus}</p>
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
                <h4 className="font-bold mb-2">Common Issues:</h4>
                <ul className="text-sm text-gray-300 text-left space-y-1">
                  <li>1. <strong>405 Error</strong>: Backend API doesn't accept POST requests</li>
                  <li>2. <strong>Missing DAILY_API_KEY</strong>: Check Vercel environment variables</li>
                  <li>3. <strong>API not deployed</strong>: Check if endpoint exists</li>
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
            <div className="flex gap-3">
              <Button onClick={retrySetup} className="mb-4">
                Try Again
              </Button>
              <Button onClick={testApiEndpoint} variant="outline">
                Test API
              </Button>
              <Button onClick={handleLeaveCall} variant="outline">
                Cancel
              </Button>
            </div>
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