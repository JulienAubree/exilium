# Landing page publique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Transformer la page `/login` (formulaire minimal) en landing publique orientée conversion, composée de sections autonomes (`Header / Hero / Pillars / Showcase / LoginForm / Footer`). Aucun changement de logique serveur : le formulaire de login conserve sa mutation tRPC actuelle.

**Architecture :** Décomposition de `Login.tsx` en 6 sous-composants sous `components/landing/`. La page racine devient un orchestrateur qui compose les sections dans l'ordre. Chaque composant est autonome et modifiable indépendamment. Le formulaire existant est extrait tel quel dans `LandingLoginForm.tsx` et ancré à `#connexion`.

**Tech Stack :** React 19, React Router 7, TanStack Query + tRPC, Tailwind (`glass-card`, `bg-stars`, `glow-silicium`), SVG inline + kit `lib/icons.tsx`.

**Spec :** `docs/superpowers/specs/2026-04-23-landing-page-design.md`.

**Conventions projet :**
- Vouvoiement systématique (FR).
- Pas d'emojis dans les composants.
- Minimum de commentaires (seulement si le *pourquoi* n'est pas évident).
- Chaque tâche se termine par `pnpm --filter @exilium/web typecheck` + commit + push.

---

## File Structure

**Créations :**
```
apps/web/src/components/landing/
  ├── LandingHeader.tsx          ← wordmark + lien "Connexion" (scroll to #connexion)
  ├── LandingHero.tsx            ← H1, sous-titre, CTAs, fond planète flouté, starfield
  ├── LandingPillars.tsx         ← 3 cards glass-card avec icônes SVG inline
  ├── LandingShowcase.tsx        ← 3 screenshots + légendes en alternance
  ├── LandingLoginForm.tsx       ← formulaire extrait de Login.tsx (logique inchangée)
  └── LandingFooter.tsx          ← CTA final + liens patchnotes/mentions
apps/web/public/assets/landing/
  ├── planet-hero.webp           ← placeholder temporaire
  ├── overview.webp              ← placeholder temporaire
  ├── galaxy.webp                ← placeholder temporaire
  └── combat.webp                ← placeholder temporaire
```

**Modifications :**
```
apps/web/src/pages/Login.tsx     ← réécrit en orchestrateur
apps/web/index.html              ← ajout meta SEO / OG
```

---

## Parallélisation

Les tâches 1 à 6 et 8 sont indépendantes (chacune crée un fichier distinct ou modifie un fichier distinct) et peuvent être dispatchées en parallèle à des subagents séparés. La tâche 7 (orchestrateur) dépend de 1-6. La tâche 9 est une vérif manuelle finale.

```
Parallèle : Tâches 1, 2, 3, 4, 5, 6, 8
Séquentiel : Tâche 7 (après 1-6) → Tâche 9 (après 7 + 8)
```

Les 6 composants ont des surfaces disjointes — aucun import croisé entre eux.

---

### Task 1: `LandingHeader.tsx`

Barre de header minimaliste : wordmark « EXILIUM » à gauche (style `glow-silicium`), lien discret « Connexion » à droite qui fait un scroll lissé vers l'ancre `#connexion`.

**Files:**
- Create: `apps/web/src/components/landing/LandingHeader.tsx`

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingHeader.tsx` :

```tsx
export function LandingHeader() {
  const handleConnectClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('connexion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-lg font-bold tracking-wide glow-silicium">EXILIUM</span>
        <a
          href="#connexion"
          onClick={handleConnectClick}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Connexion
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK (pas de nouveau composant consommé pour l'instant — ça passe).

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingHeader.tsx
git commit -m "feat(landing): LandingHeader component"
git push
```

---

### Task 2: `LandingHero.tsx`

Hero plein viewport : H1, sous-titre, CTA principal (`Fonder votre empire` → `/register`) et CTA secondaire (`J'ai déjà un compte` → scroll vers `#connexion`). Fond = render planète `thumb` flouté (low priority) + voile sombre pour lisibilité. Teaser visuel en bas (bande horizontale qui suggère un screenshot).

**Files:**
- Create: `apps/web/src/components/landing/LandingHero.tsx`

Note : le composant `Button` du projet n'accepte pas `asChild`. On utilise donc `buttonVariants` + `<Link>` pour le CTA principal (pattern déjà utilisé dans `LandingFooter`).

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingHero.tsx` :

```tsx
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LandingHero() {
  const handleSecondaryClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('connexion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'url(/assets/landing/planet-hero.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(18px) brightness(0.45)',
          transform: 'scale(1.08)',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-background/60" />

      <div className="mx-auto flex min-h-[85vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-primary/80">Stratégie spatiale</p>
        <h1 className="text-4xl font-extrabold leading-[1.05] text-foreground sm:text-6xl">
          Bâtissez votre
          <br />
          <span className="glow-silicium">empire spatial.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Colonisez des mondes, commandez des flottes, forgez des alliances. Stratégie profonde au
          rythme qui vous convient — votre empire tourne même hors ligne.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/register"
            className={cn(buttonVariants({ size: 'lg' }), 'min-w-[220px]')}
          >
            Fonder votre empire
          </Link>
          <a
            href="#connexion"
            onClick={handleSecondaryClick}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            J'ai déjà un compte
          </a>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
      />
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingHero.tsx
git commit -m "feat(landing): LandingHero component"
git push
```

---

### Task 3: `LandingPillars.tsx`

Grille de 3 cartes `glass-card` (1 colonne mobile, 3 desktop). Chaque carte : icône SVG inline (planète, flotte, sablier), titre court, 2 phrases. Copy exacte tirée du spec.

**Files:**
- Create: `apps/web/src/components/landing/LandingPillars.tsx`

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingPillars.tsx` :

```tsx
interface Pillar {
  title: string;
  body: string;
  icon: React.ReactNode;
}

const PILLARS: Pillar[] = [
  {
    title: 'Un empire à votre mesure',
    body:
      "Des mondes à coloniser, trois ressources à équilibrer, des dizaines de bâtiments à faire monter. Construisez une économie qui tient la route.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12c3 2 15 2 18 0" />
        <path d="M12 3c2.5 3 2.5 15 0 18" />
      </svg>
    ),
  },
  {
    title: 'Flottes, combat, diplomatie',
    body:
      "Concevez vos flottes, lancez des attaques, défendez vos planètes. Rejoignez une alliance ou formez la vôtre. La galaxie est peuplée de vrais joueurs.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <path d="M12 3 3 18h18L12 3Z" />
        <path d="M12 11v4" />
        <path d="M9 18l3-3 3 3" />
      </svg>
    ),
  },
  {
    title: 'Le jeu respecte votre temps',
    body:
      "Queues longues, production persistante, notifications précises. 5 minutes de bonnes décisions valent mieux que 4 heures de clics.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export function LandingPillars() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {PILLARS.map((p) => (
          <article key={p.title} className="glass-card p-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {p.icon}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">{p.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingPillars.tsx
git commit -m "feat(landing): LandingPillars component"
git push
```

---

### Task 4: `LandingShowcase.tsx`

3 captures avec légende, en alternance image gauche/droite sur desktop, empilées sur mobile (image puis texte). Images en `loading="lazy"`, `.webp`.

**Files:**
- Create: `apps/web/src/components/landing/LandingShowcase.tsx`

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingShowcase.tsx` :

```tsx
interface ShowcaseItem {
  src: string;
  alt: string;
  title: string;
  body: string;
}

const ITEMS: ShowcaseItem[] = [
  {
    src: '/assets/landing/overview.webp',
    alt: "Aperçu de la page Vue d'ensemble d'Exilium",
    title: 'Une planète, un coup d’œil',
    body:
      "Ressources, production, flotte stationnée, menaces en cours : tout ce qui compte sur un seul écran.",
  },
  {
    src: '/assets/landing/galaxy.webp',
    alt: 'Aperçu de la carte galactique',
    title: 'Explorez la galaxie',
    body:
      "Naviguez parmi les systèmes, repérez les voisins, planifiez vos prochaines colonies. La galaxie est vaste — et peuplée de vrais joueurs.",
  },
  {
    src: '/assets/landing/combat.webp',
    alt: 'Aperçu d’un rapport de combat',
    title: 'Reports détaillés, vraie simulation',
    body:
      "Chaque combat est résolu par un moteur déterministe : rounds, boucliers, rapid fire, débris. Les rapports expliquent exactement ce qui s’est passé.",
  },
];

export function LandingShowcase() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="space-y-16 sm:space-y-24">
        {ITEMS.map((item, idx) => {
          const reverse = idx % 2 === 1;
          return (
            <div
              key={item.src}
              className={`grid gap-8 sm:grid-cols-2 sm:items-center sm:gap-12 ${
                reverse ? 'sm:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div className="overflow-hidden rounded-xl border border-white/10 bg-card/50 shadow-lg">
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h3 className="mb-3 text-xl font-semibold text-foreground sm:text-2xl">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingShowcase.tsx
git commit -m "feat(landing): LandingShowcase component"
git push
```

---

### Task 5: `LandingLoginForm.tsx`

Extraction du formulaire de login actuel (`Login.tsx`) dans un composant dédié, sans modifier la logique. On expose ensuite ce composant sous une ancre `#connexion` à l'intérieur d'une section titrée « Déjà empereur ? ». Le composant gère à la fois son titre et son formulaire pour rester autonome.

**Files:**
- Create: `apps/web/src/components/landing/LandingLoginForm.tsx`
- Reference (to copy from): `apps/web/src/pages/Login.tsx`

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingLoginForm.tsx` :

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc, resetRefreshState } from '@/trpc';
import { useAuthStore } from '@/stores/auth.store';
import { formatApiError } from '@/lib/error';

export function LandingLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      resetRefreshState();
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    },
    onError: (err) => setError(formatApiError(err.message)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password, rememberMe });
  };

  return (
    <section id="connexion" className="mx-auto max-w-md px-4 py-16 sm:px-6 sm:py-24">
      <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">Déjà empereur ?</h2>
      <div className="glass-card p-6 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground">Se souvenir de moi</span>
          </label>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Pas de compte ?{' '}
            <Link to="/register" className="text-primary hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingLoginForm.tsx
git commit -m "feat(landing): LandingLoginForm (extraction du form existant)"
git push
```

---

### Task 6: `LandingFooter.tsx`

Bloc final centré répétant le CTA `Fonder votre empire`, court texte d'amorce, puis footer minimal avec liens publics (`/changelog`) et mentions. Aucune dépendance Discord pour l'instant (à trancher avec le propriétaire avant production).

**Files:**
- Create: `apps/web/src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Créer le composant**

Fichier `apps/web/src/components/landing/LandingFooter.tsx` :

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/src/components/landing/LandingFooter.tsx
git commit -m "feat(landing): LandingFooter + CTA final"
git push
```

---

### Task 7: Réécrire `Login.tsx` en orchestrateur

La page `Login.tsx` devient une simple composition des sections landing. L'ancien formulaire inline est retiré (la logique vit maintenant dans `LandingLoginForm`).

**Dépend de :** Tâches 1-6 terminées.

**Files:**
- Modify: `apps/web/src/pages/Login.tsx`

- [ ] **Step 1: Réécrire le fichier**

Remplacer intégralement le contenu de `apps/web/src/pages/Login.tsx` par :

```tsx
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingPillars } from '@/components/landing/LandingPillars';
import { LandingShowcase } from '@/components/landing/LandingShowcase';
import { LandingLoginForm } from '@/components/landing/LandingLoginForm';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Login() {
  return (
    <div className="min-h-dvh bg-background bg-stars text-foreground">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingPillars />
        <LandingShowcase />
        <LandingLoginForm />
      </main>
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK — toutes les imports doivent résoudre.

- [ ] **Step 3: Build de validation**

Run: `pnpm --filter @exilium/web build`
Expected: succès, aucune erreur Vite.

- [ ] **Step 4: Commit + push**

```bash
git add apps/web/src/pages/Login.tsx
git commit -m "feat(landing): Login.tsx devient l'orchestrateur landing"
git push
```

---

### Task 8: Meta SEO / OG dans `index.html`

Ajout d'un `<title>`, `<meta description>`, balises `og:*` et `twitter:card` pour soigner les partages de lien. L'image OG pointe sur `planet-hero.webp`.

**Files:**
- Modify: `apps/web/index.html`

- [ ] **Step 1: Mettre à jour les meta**

Remplacer le contenu actuel du `<head>` (sans toucher au `<body>`) par :

```html
<!doctype html>
<html lang="fr" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#5cb8d6" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Exilium" />
    <link rel="apple-touch-icon" href="/manifest-icons/icon-192x192.png" />

    <title>Exilium — Bâtissez votre empire spatial</title>
    <meta
      name="description"
      content="Exilium est un jeu de stratégie spatiale jouable dans votre navigateur. Colonisez, commandez des flottes, rejoignez une alliance. Votre empire tourne même hors ligne."
    />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="Exilium — Bâtissez votre empire spatial" />
    <meta
      property="og:description"
      content="Stratégie spatiale profonde au rythme qui vous convient. Votre empire tourne même hors ligne."
    />
    <meta property="og:image" content="/assets/landing/planet-hero.webp" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Exilium — Bâtissez votre empire spatial" />
    <meta
      name="twitter:description"
      content="Stratégie spatiale profonde au rythme qui vous convient. Votre empire tourne même hors ligne."
    />
    <meta name="twitter:image" content="/assets/landing/planet-hero.webp" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Typecheck (par cohérence ; ne touche rien)**

Run: `pnpm --filter @exilium/web typecheck`
Expected: OK.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/index.html
git commit -m "feat(landing): meta SEO/OG"
git push
```

---

### Task 9: Vérification manuelle dans le navigateur

**Dépend de :** tâches 7 + 8 terminées.

**Files :** aucune modification attendue.

- [ ] **Step 1: Déposer les 4 assets placeholders**

Si les captures in-game ne sont pas encore disponibles, créer des placeholders visibles pour éviter les 404. Un sous-agent peut générer des `.webp` sobres (fond cyan/bleu 1600×900) via la commande suivante depuis la racine du repo :

```bash
node -e "
const sharp = require('sharp');
const items = [
  { file: 'apps/web/public/assets/landing/planet-hero.webp', w: 1600, h: 1000, color: { r: 18, g: 30, b: 60 } },
  { file: 'apps/web/public/assets/landing/overview.webp', w: 1600, h: 900, color: { r: 12, g: 22, b: 40 } },
  { file: 'apps/web/public/assets/landing/galaxy.webp', w: 1600, h: 900, color: { r: 20, g: 18, b: 45 } },
  { file: 'apps/web/public/assets/landing/combat.webp', w: 1600, h: 900, color: { r: 40, g: 18, b: 20 } },
];
(async () => {
  for (const it of items) {
    await sharp({
      create: { width: it.w, height: it.h, channels: 3, background: it.color },
    }).webp({ quality: 70 }).toFile(it.file);
    console.log('wrote', it.file);
  }
})();
"
```

`sharp` est déjà dans les `devDependencies` du monorepo.

Puis commit + push :

```bash
git add apps/web/public/assets/landing/
git commit -m "chore(landing): placeholders webp pour hero + showcase"
git push
```

- [ ] **Step 2: Lancer le dev server**

Run (en arrière-plan) : `pnpm --filter @exilium/web dev`
Attendre l'URL locale, ouvrir dans un navigateur.

- [ ] **Step 3: Golden path mobile**

En largeur mobile (≤ 420 px dans les devtools) :
- Le header reste fixe en haut, "EXILIUM" lisible, lien Connexion cliquable.
- Le hero occupe tout l'écran, H1 lisible, CTAs empilés verticalement.
- Le scroll passe par Pillars (1 colonne) → Showcase (images empilées) → Formulaire → Footer.
- Cliquer "J'ai déjà un compte" fait défiler jusqu'à `#connexion`.
- Cliquer "Connexion" dans le header fait le même défilement.
- Soumettre le formulaire avec identifiants valides redirige vers `/` (Overview).
- Soumettre avec un mauvais mot de passe affiche le message d'erreur sous `<p className="text-sm text-destructive">`.

- [ ] **Step 4: Golden path desktop**

En largeur desktop (≥ 1024 px) :
- Pillars en 3 colonnes.
- Showcase en alternance gauche/droite (1re image à gauche, 2e à droite, 3e à gauche).
- CTA "Fonder votre empire" pointe bien vers `/register`.

- [ ] **Step 5: Vérif console & perfs**

- Aucune erreur JS dans la console.
- Network : les 4 `.webp` de `/assets/landing/` chargent en 200 OK (avec `loading="lazy"` pour les 3 screenshots).
- `index.html` sert bien les nouvelles meta (`document.title === 'Exilium — Bâtissez votre empire spatial'`).

- [ ] **Step 6: Test utilisateur connecté**

Se connecter, vérifier que naviguer vers `/login` (via URL manuelle) affiche bien la landing — ce n'est pas une régression : la route n'est pas gardée et c'est le comportement attendu (un utilisateur déjà connecté qui atterrit sur la landing peut se re-logger ou cliquer "Fonder" s'il le souhaite).

- [ ] **Step 7: Commit final si ajustements**

Si des retouches visuelles ont été faites pendant la vérif, les commit sous un message explicite, sinon rien à faire.

---

## Notes pour l'exécution multi-agents

- Les tâches 1–6 et 8 sont totalement indépendantes : un subagent par tâche, en parallèle.
- La tâche 7 bloque sur toutes les précédentes côté import. À dispatcher seul après confirmation que 1–6 sont committées et que `pnpm typecheck` passe.
- La tâche 9 est une vérif humaine finale — à lancer depuis l'orchestrateur, pas dans un subagent (nécessite un navigateur et un regard humain).
- Pas de conflit attendu : chaque sous-agent touche un fichier disjoint.
