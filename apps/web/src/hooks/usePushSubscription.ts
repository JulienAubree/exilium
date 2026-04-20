import { useEffect, useRef } from 'react';
import { trpc } from '@/trpc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const { data: keyData } = trpc.push.getPublicKey.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (!keyData?.publicKey || attempted.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    attempted.current = true;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const json = existing.toJSON();
          subscribeMutation.mutate({
            endpoint: existing.endpoint,
            keys: {
              p256dh: json.keys!.p256dh!,
              auth: json.keys!.auth!,
            },
          });
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey).buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        subscribeMutation.mutate({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys!.p256dh!,
            auth: json.keys!.auth!,
          },
        });
      } catch {
        // Push not supported or permission denied
      }
    })();
  }, [keyData?.publicKey]);
}
