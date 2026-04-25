import { useState } from 'react';
import { trpc } from '@/trpc';

export function ExiliumSection({
  exilium,
  userId,
  onSaved,
}: {
  exilium: any;
  userId: string;
  onSaved: () => void;
}) {
  const [balance, setBalance] = useState(exilium?.balance ?? 0);
  const mutation = trpc.playerAdmin.setExiliumBalance.useMutation({ onSuccess: onSaved });

  return (
    <div className="admin-card p-4 mb-8">
      <div className="flex items-center gap-4">
        <div>
          <span className="text-xs text-gray-500">Solde</span>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="admin-input w-24 py-1 text-xs font-mono"
            />
            <button
              onClick={() => mutation.mutate({ userId, balance })}
              disabled={mutation.isPending}
              className="admin-btn-primary py-1 px-3 text-xs"
            >
              {mutation.isPending ? '...' : 'Sauver'}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          <div>Total gagne : <span className="text-emerald-400 font-mono">{exilium?.totalEarned ?? 0}</span></div>
          <div>Total depense : <span className="text-red-400 font-mono">{exilium?.totalSpent ?? 0}</span></div>
        </div>
      </div>
    </div>
  );
}
