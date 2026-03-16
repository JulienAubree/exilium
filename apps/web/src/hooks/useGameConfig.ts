import { trpc } from '../trpc';

export function useGameConfig() {
  return trpc.gameConfig.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
