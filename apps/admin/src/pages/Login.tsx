import { useState } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/trpc';
import { useAuthStore } from '@/stores/auth.store';
import { resetRefreshState } from '@/trpc';
import { Zap } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (!data.user.isAdmin) {
        setError('Acces reserve aux administrateurs.');
        return;
      }
      setAuth(data.accessToken, data.refreshToken, {
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        isAdmin: data.user.isAdmin,
      });
      resetRefreshState();
      navigate('/');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-panel grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6 text-hull-500" />
            <span className="font-mono font-semibold text-hull-400 text-lg tracking-wider">
              EXILIUM
            </span>
          </div>
          <div className="text-xs font-mono text-gray-600 tracking-widest uppercase">
            Administration
          </div>
        </div>

        <form onSubmit={handleSubmit} className="admin-card p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="admin-btn-primary w-full"
          >
            {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
