import { useState } from 'react';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Stack, Inline } from '@/components/ui/stack';
import { TabBar } from '@/components/ui/tabs';
import { Stat } from '@/components/ui/stat';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { useThemeStore, themeLabEnabled } from '@/stores/theme.store';
import * as GameIcons from '@/lib/icons';

/** Itération programmatique : toute nouvelle icône exportée par lib/icons
 * apparaît ici automatiquement — la bibliothèque reste exhaustive. */
const GAME_ICON_ENTRIES = Object.entries(GameIcons).filter(
  ([name, value]) => name.endsWith('Icon') && typeof value === 'function',
) as [string, React.ComponentType<React.SVGProps<SVGSVGElement>>][];

const RESOURCE_ICON_ENTRIES = [
  { name: 'MineraiIcon', node: <MineraiIcon size={20} className="text-minerai" /> },
  { name: 'SiliciumIcon', node: <SiliciumIcon size={20} className="text-silicium" /> },
  { name: 'HydrogeneIcon', node: <HydrogeneIcon size={20} className="text-hydrogene" /> },
  { name: 'EnergieIcon', node: <EnergieIcon size={20} className="text-energy" /> },
];

const COLOR_TOKENS = [
  { name: 'background', cls: 'bg-background', note: 'page' },
  { name: 'surface', cls: 'bg-surface', note: 'carte' },
  { name: 'surface-raised', cls: 'bg-surface-raised', note: 'popover/menu' },
  { name: 'primary', cls: 'bg-primary', note: 'action' },
  { name: 'destructive', cls: 'bg-destructive', note: 'danger réel' },
  { name: 'minerai', cls: 'bg-minerai', note: 'ressource' },
  { name: 'silicium', cls: 'bg-silicium', note: 'ressource' },
  { name: 'hydrogene', cls: 'bg-hydrogene', note: 'ressource' },
  { name: 'energy', cls: 'bg-energy', note: 'ressource' },
];

const TEXT_ROLES = ['display', 'page', 'title', 'body', 'secondary', 'caption'] as const;

/**
 * Design sheet vivante — la vitrine du design system dans le vrai runtime.
 * Route non listée : /design. Réf : docs/reference/design-system.md
 */
export default function DesignSheet() {
  const [demoTab, setDemoTab] = useState('a');
  const [demoValue, setDemoValue] = useState(465_000);
  const [demoProgress, setDemoProgress] = useState(0.35);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-6">
      <div>
        <Text variant="display">Design system</Text>
        <Text variant="body" tone="secondary">
          « Calme spatial » — la couleur appartient au contenu. Réf : docs/reference/design-system.md
        </Text>
      </div>

      {themeLabEnabled && (
        <section>
          <Text variant="title" className="mb-3">Thème (lab)</Text>
          <Surface>
            <Inline gap={3} align="center">
              <Text variant="body" tone="secondary" className="flex-1">
                « Quart de nuit » — bleu-noir spatial, donnée phosphore en mono, table Empire.
                Réf : docs/plans/2026-06-10-quart-de-nuit-s0.md
              </Text>
              <Button
                variant={theme === 'default' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('default')}
              >
                Défaut
              </Button>
              <Button
                variant={theme === 'quart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('quart')}
              >
                Quart de nuit
              </Button>
            </Inline>
          </Surface>
        </section>
      )}

      <section>
        <Text variant="title" className="mb-3">Couleurs (sémantiques uniquement)</Text>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {COLOR_TOKENS.map((t) => (
            <div key={t.name}>
              <div className={`h-12 rounded-md border border-border ${t.cls}`} />
              <Text variant="caption" tone="secondary" className="mt-1 block">{t.name}</Text>
              <Text variant="caption" tone="faint" className="block">{t.note}</Text>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Text variant="title" className="mb-3">Typographie — 6 rôles, plancher 12px</Text>
        <Surface>
          <Stack gap={2}>
            {TEXT_ROLES.map((role) => (
              <Inline key={role} gap={3} align="baseline">
                <Text variant="caption" tone="faint" className="w-20">{role}</Text>
                <Text variant={role}>Hoxis IV, capitale de l'empire</Text>
              </Inline>
            ))}
            <Inline gap={3} align="baseline">
              <Text variant="caption" tone="faint" className="w-20">nums</Text>
              <Text variant="body" nums>1 234 567 (tabulaires — obligatoire si la valeur change)</Text>
            </Inline>
          </Stack>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">Surfaces — un seul matériau</Text>
        <div className="grid gap-3 sm:grid-cols-3">
          <Surface>
            <Text variant="title">card</Text>
            <Text variant="secondary" tone="secondary">Fond plein, bordure 1px. Zéro blur, zéro gradient.</Text>
          </Surface>
          <Surface variant="raised">
            <Text variant="title">raised</Text>
            <Text variant="secondary" tone="secondary">Popover/menu — la seule ombre autorisée.</Text>
          </Surface>
          <Surface interactive tabIndex={0}>
            <Text variant="title">interactive</Text>
            <Text variant="secondary" tone="secondary">Hover : bordure renforcée. Pas de glow.</Text>
          </Surface>
        </div>
      </section>

      <section>
        <Text variant="title" className="mb-3">Stat — chiffres de jeu (sans glow, compteur animé)</Text>
        <Surface>
          <Inline gap={5} wrap>
            <Stat value={demoValue} tone="minerai" icon={<MineraiIcon size={14} />} animated />
            <Stat value={255_000} tone="silicium" icon={<SiliciumIcon size={14} />} />
            <Stat value={865_000} tone="hydrogene" icon={<HydrogeneIcon size={14} />} />
            <Stat value={395} tone="energy" icon={<EnergieIcon size={14} />} />
            <Stat value={7300} tone="default" suffix="/h" size="sm" />
            <Button size="sm" variant="outline" onClick={() => setDemoValue((v) => v + Math.round(Math.random() * 50_000))}>
              +tick
            </Button>
          </Inline>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">Tabs — hubs, production, drill-downs</Text>
        <Surface padded={false}>
          <TabBar
            ariaLabel="Démo onglets"
            items={[
              { label: 'Développement', active: demoTab === 'a', onClick: () => setDemoTab('a') },
              { label: 'Production', active: demoTab === 'b', onClick: () => setDemoTab('b') },
              { label: 'Défenses', active: demoTab === 'c', onClick: () => setDemoTab('c') },
            ]}
          />
          <div className="p-4">
            <Text variant="secondary" tone="secondary">Contenu de l'onglet {demoTab.toUpperCase()}</Text>
          </div>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">Progress — files et timers</Text>
        <Surface>
          <Stack gap={3}>
            <Progress value={demoProgress} aria-label="Démo construction" />
            <Progress value={0.8} tone="warning" size="sm" aria-label="Démo stock" />
            <Inline gap={2}>
              <Button size="sm" variant="outline" onClick={() => setDemoProgress((p) => Math.min(1, p + 0.15))}>Avancer</Button>
              <Button size="sm" variant="ghost" onClick={() => setDemoProgress(0)}>Reset</Button>
            </Inline>
          </Stack>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">Boutons (le variant retro disparaîtra en M2)</Text>
        <Surface>
          <Inline gap={2} wrap>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Danger</Button>
          </Inline>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">AlertBanner — la seule voix forte de l'UI</Text>
        <Stack gap={3}>
          <AlertBanner tone="danger" title="Attaque entrante" meta="arrivée 12 min" pulse>
            Flotte hostile détectée en [1:4:9] — seule alerte autorisée à pulser en continu.
          </AlertBanner>
          <AlertBanner tone="warning" title="Surextension impériale" meta="9/8 colonies (+1)" onClick={() => undefined}>
            −15 % récolte · +15 % construction — cliquable, navigation vers la page concernée.
          </AlertBanner>
        </Stack>
      </section>

      <section>
        <Text variant="title" className="mb-3">Icônes — bibliothèque exhaustive (lib/icons + ressources)</Text>
        <Surface>
          <Stack gap={4}>
            <div>
              <Text variant="caption" tone="faint" className="mb-2 block">Ressources (ResourceIcons — prop size, couleur sémantique)</Text>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                {RESOURCE_ICON_ENTRIES.map(({ name, node }) => (
                  <div key={name} className="flex flex-col items-center gap-1.5 rounded-md border border-border/50 p-3">
                    {node}
                    <Text variant="caption" tone="secondary" className="text-center break-all">{name.replace('Icon', '')}</Text>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Text variant="caption" tone="faint" className="mb-2 block">Jeu & navigation (lib/icons — props width/height, currentColor)</Text>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                {GAME_ICON_ENTRIES.map(([name, IconComponent]) => (
                  <div key={name} className="flex flex-col items-center gap-1.5 rounded-md border border-border/50 p-3 text-foreground">
                    <IconComponent width={20} height={20} />
                    <Text variant="caption" tone="secondary" className="text-center break-all">{name.replace('Icon', '')}</Text>
                  </div>
                ))}
              </div>
            </div>
            <Text variant="secondary" tone="secondary">
              Pour le reste de l'UI générique : lucide-react (16-20px, currentColor). Avant de créer une icône custom,
              vérifier qu'elle n'existe ni ici ni dans lucide.
            </Text>
          </Stack>
        </Surface>
      </section>

      <section>
        <Text variant="title" className="mb-3">Motion</Text>
        <Surface>
          <Stack gap={2}>
            <Text variant="secondary" tone="secondary">fast 120ms — hover, press · base 200ms — apparitions, tabs · slow 350ms — sheets, overlays</Text>
            <Text variant="secondary" tone="secondary">Courbes : standard (ease-out) · spring (sheets). prefers-reduced-motion respecté globalement.</Text>
          </Stack>
        </Surface>
      </section>
    </div>
  );
}
