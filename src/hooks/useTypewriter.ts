import { useState, useEffect } from 'react';

interface UseTypewriterProps {
  text: string;
  speed?: number;
  delayStart?: number;
  delayEnd?: number;
}

export const useTypewriter = ({
  text,
  speed = 100,
  delayStart = 0,
  delayEnd = 2000,
}: UseTypewriterProps) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    // Start typing after delayStart
    if (!isTyping && !isErasing && displayText === '') {
      timeout = setTimeout(() => {
        setIsTyping(true);
      }, delayStart);
      return () => clearTimeout(timeout);
    }

    // Type text
    if (isTyping && displayText.length < text.length) {
      timeout = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }

    // Stop typing and start erasing after delayEnd
    if (isTyping && displayText.length === text.length) {
      timeout = setTimeout(() => {
        setIsTyping(false);
        setIsErasing(true);
      }, delayEnd);
      return () => clearTimeout(timeout);
    }

    // Erase text
    if (isErasing && displayText.length > 0) {
      timeout = setTimeout(() => {
        setDisplayText(displayText.slice(0, -1));
      }, speed / 2); // Erase faster
      return () => clearTimeout(timeout);
    }

    // Loop - reset and start again
    if (isErasing && displayText.length === 0) {
      timeout = setTimeout(() => {
        setIsErasing(false);
        setIsTyping(true);
      }, delayStart);
      return () => clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isTyping, isErasing, text, speed, delayStart, delayEnd]);

  return displayText;
};
