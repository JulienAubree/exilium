import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc';
import { formatApiError } from '@/lib/error';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const requestMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(formatApiError(err.message)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    requestMutation.mutate({ email });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-stars p-4">
      <div className="w-full max-w-sm glass-card p-6 animate-slide-up">
        <h1 className="text-center text-2xl font-bold glow-silicium mb-2">Exilium</h1>
        <p className="text-center text-sm text-muted-foreground mb-6">Réinitialisation du mot de passe</p>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm">
              Si un compte est associé à cette adresse, un email avec un lien de réinitialisation
              vient de vous être envoyé. Vérifiez votre boîte mail (pensez aux spams).
            </p>
            <p className="text-sm text-muted-foreground">Le lien est valable 30 minutes.</p>
            <Link to="/login" className="block text-center text-sm text-primary hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-sm text-muted-foreground">
              Entrez votre adresse email. Nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </p>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? 'Envoi...' : 'Envoyer le lien'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="hover:text-primary hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
