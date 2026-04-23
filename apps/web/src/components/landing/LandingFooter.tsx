import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LandingFooter() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="mb-4 text-2xl font-semibold text-foreground sm:text-3xl">
          Votre galaxie vous attend.
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-sm text-muted-foreground sm:text-base">
          Création de compte en une minute. Jouable dans votre navigateur, sans installation.
        </p>
        <Link
          to="/register"
          className={cn(buttonVariants({ size: 'lg' }), 'min-w-[220px]')}
        >
          Fonder votre empire
        </Link>
      </section>

      <footer className="border-t border-white/5 bg-background/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>Exilium © {new Date().getFullYear()}</span>
          <nav className="flex items-center gap-5">
            <Link to="/changelog" className="hover:text-primary transition-colors">
              Patchnotes
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
