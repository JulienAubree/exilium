import { trpc } from '@/trpc';

export function useExilium() {
  return trpc.exilium.getBalance.useQuery(undefined, {
    refetchInterval: 30_000,
  });
}
