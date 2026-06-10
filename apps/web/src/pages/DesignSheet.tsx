import { useState } from 'react';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Stack, Inline } from '@/components/ui/stack';
import { TabBar } from '@/components/ui/tabs';
import { Stat } from '@/components/ui/stat';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';

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

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-6">
      <div>
        <Text variant="display">Design system</Text>
        <Text variant="body" tone="secondary">
          « Calme spatial » — la couleur appartient au contenu. Réf : docs/reference/design-system.md
        </Text>
      </div>

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
