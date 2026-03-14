import { Button } from '@/components/ui/button';

interface QueryErrorProps {
  error: { message: string } | null;
  retry?: () => void;
}

export function QueryError({ error, retry }: QueryErrorProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
      <p className="text-sm text-destructive">
        {error?.message || 'Une erreur est survenue.'}
      </p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
