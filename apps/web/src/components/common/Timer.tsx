import { useEffect, useRef, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/utils';

interface TimerProps {
  endTime: Date;
  totalDuration?: number;
  onComplete?: () => void;
  className?: string;
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function Timer({ endTime, totalDuration, onComplete, className }: TimerProps) {
  const now = useNow();
  const secondsLeft = Math.max(0, Math.floor((endTime.getTime() - now) / 1000));

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [completed, setCompleted] = useState(secondsLeft <= 0);
  const firedRef = useRef(completed);

  useEffect(() => {
    if (secondsLeft <= 0 && !firedRef.current) {
      firedRef.current = true;
      setCompleted(true);
      onCompleteRef.current?.();
    } else if (secondsLeft > 0 && firedRef.current) {
      firedRef.current = false;
      setCompleted(false);
    }
  }, [secondsLeft]);

  const progress =
    totalDuration && totalDuration > 0
      ? Math.min(100, ((totalDuration - secondsLeft) / totalDuration) * 100)
      : null;

  const isUrgent = secondsLeft > 0 && secondsLeft < 60;

  return (
    <div className={className}>
      <span
        className={cn(
          'text-xs font-mono',
          completed && 'text-green-400',
          isUrgent && 'animate-pulse-glow text-energy',
        )}
      >
        {formatTimeLeft(secondsLeft)}
      </span>
      {progress !== null && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-1.5 rounded-full transition-[width] duration-1000 ease-linear',
              completed ? 'bg-green-400' : 'bg-gradient-to-r from-primary to-silicium',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
