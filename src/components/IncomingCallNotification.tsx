import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { useModernRingtone } from '@/hooks/useRingtone';

interface IncomingCallNotificationProps {
  callerName: string;
  callerId: string;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallNotification = ({
  callerName,
  callerId,
  onAccept,
  onReject,
}: IncomingCallNotificationProps) => {
  const [isVisible, setIsVisible] = useState(true);
  useModernRingtone(isVisible);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onReject();
    }, 45000); // Auto-reject after 45 seconds

    return () => clearTimeout(timer);
  }, [onReject]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-2xl max-w-sm w-[90vw] border border-slate-700">
        {/* Animated ring icon */}
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-pulse opacity-75"></div>
            <div className="absolute inset-2 bg-blue-600 rounded-full animate-pulse opacity-50 animation-delay-200"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Phone className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>
        </div>

        {/* Caller info */}
        <h2 className="text-3xl font-bold text-white text-center mb-2">{callerName}</h2>
        <p className="text-gray-300 text-center mb-8">is calling you...</p>

        {/* Action buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            size="lg"
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
            onClick={() => {
              setIsVisible(false);
              onReject();
            }}
          >
            <PhoneOff className="h-8 w-8" />
          </Button>

          <Button
            size="lg"
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg"
            onClick={() => {
              setIsVisible(false);
              onAccept();
            }}
          >
            <Phone className="h-8 w-8" />
          </Button>
        </div>

        {/* Auto-reject timer */}
        <p className="text-gray-500 text-center text-sm mt-6">Missed call after 45 seconds</p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
      `}</style>
    </div>
  );
};
