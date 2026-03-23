import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';

type SSEHandler = (event: { type: string; payload: Record<string, unknown> }) => void;

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export function useSSE(onEvent: SSEHandler) {
  const token = useAuthStore((s) => s.accessToken);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const esRef = useRef<EventSource | null>(null);
  const retryDelay = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!token) return;

    // Clean up previous connection
    esRef.current?.close();
    clearTimeout(retryTimer.current);

    const es = new EventSource(`/sse?token=${token}`);
    esRef.current = es;

    es.onopen = () => {
      retryDelay.current = INITIAL_RETRY_MS;
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;

      // Reconnect with exponential backoff
      const delay = retryDelay.current;
      retryDelay.current = Math.min(delay * 2, MAX_RETRY_MS);
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [token]);

  useEffect(() => {
    connect();

    // Reconnect when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !esRef.current) {
        retryDelay.current = INITIAL_RETRY_MS;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearTimeout(retryTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect]);
}
