const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  password: 'Mot de passe',
  username: 'Nom de commandant',
};

/**
 * Parse a tRPC/Zod error message into a human-readable string.
 * Zod validation errors come as JSON arrays in err.message.
 */
export function formatApiError(message: string): string {
  try {
    const parsed = JSON.parse(message);
    if (Array.isArray(parsed)) {
      return parsed
        .map((e: { path?: string[]; message?: string }) => {
          const field = e.path?.[0];
          const label = field ? FIELD_LABELS[field] ?? field : '';
          const msg = e.message ?? 'Invalide';
          return label ? `${label} : ${msg}` : msg;
        })
        .join('. ');
    }
  } catch {
    // Not JSON — return as-is but clean up common tRPC prefixes
  }

  if (message === 'Invalid credentials') return 'Email ou mot de passe incorrect';
  if (message === 'UNAUTHORIZED') return 'Email ou mot de passe incorrect';
  if (message === 'Account banned') return 'Ce compte a été banni';
  if (message === 'TOO_MANY_REQUESTS') return 'Trop de tentatives. Réessayez dans une minute.';

  return message;
}
