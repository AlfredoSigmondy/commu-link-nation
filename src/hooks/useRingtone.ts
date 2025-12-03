import { useEffect, useRef } from 'react';

export const useCallRingtone = (playing: boolean) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      // Create audio element with inline data URL for a simple ring tone
      audioRef.current = new Audio();
      // Using a simple sine wave beep pattern as fallback
      audioRef.current.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
    }

    if (playing) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => console.log('Autoplay prevented:', error));
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [playing]);

  return audioRef;
};

// Modern ringtone using Web Audio API
export const useModernRingtone = (playing: boolean) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainsRef = useRef<GainNode[]>([]);

  useEffect(() => {
    if (!audioContextRef.current) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
      } catch (e) {
        console.log('AudioContext not supported');
        return;
      }
    }

    const ctx = audioContextRef.current!;

    if (playing) {
      // Create ringtone pattern: 800ms tone, 200ms silence, repeat
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.value = 0.3;

      const frequencies = [880, 740]; // Two frequencies for richer sound

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = freq;
        osc.type = 'sine';

        gain.connect(masterGain);
        osc.connect(gain);

        // Envelope: fade in, hold, fade out
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.setValueAtTime(0.5, now + 0.7);
        gain.gain.linearRampToValueAtTime(0, now + 0.8);

        osc.start(now);
        osc.stop(now + 0.8);

        // Repeat every second
        const interval = setInterval(() => {
          if (!audioContextRef.current) return;
          const nextNow = audioContextRef.current.currentTime;
          const nextOsc = audioContextRef.current.createOscillator();
          const nextGain = audioContextRef.current.createGain();

          nextOsc.frequency.value = freq;
          nextOsc.type = 'sine';

          nextGain.connect(masterGain);
          nextOsc.connect(nextGain);

          nextGain.gain.setValueAtTime(0, nextNow);
          nextGain.gain.linearRampToValueAtTime(0.5, nextNow + 0.1);
          nextGain.gain.setValueAtTime(0.5, nextNow + 0.7);
          nextGain.gain.linearRampToValueAtTime(0, nextNow + 0.8);

          nextOsc.start(nextNow);
          nextOsc.stop(nextNow + 0.8);
        }, 1000);

        oscillatorsRef.current.push(osc);
        gainsRef.current.push(gain);
      });
    } else {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      });
      oscillatorsRef.current = [];
      gainsRef.current = [];
    }

    return () => {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      });
      oscillatorsRef.current = [];
      gainsRef.current = [];
    };
  }, [playing]);
};
