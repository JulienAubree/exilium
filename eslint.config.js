import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // ── Design system v2 « calme spatial » — enforcement (M3) ──
  // Réf : docs/reference/design-system.md. Les primitives ui/ et les
  // exceptions documentées (topbar mobile, bottom sheet, landing) sont
  // exemptées. Échappatoire : eslint-disable avec raison.
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: [
      'apps/web/src/components/ui/**',
      'apps/web/src/components/layout/TopBar.tsx',
      'apps/web/src/components/layout/BottomSheet.tsx',
      'apps/web/src/components/landing/**',
    ],
    rules: {
      // Purgés intégralement → erreur : toute réintroduction casse le lint.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/text-\\[10px\\]|text-\\[11px\\]/]",
          message: 'Design system : plancher typo 12px (text-xs) — utiliser <Text variant="caption">.',
        },
        {
          selector: "Literal[value=/(?<!icon-)glow-(minerai|silicium|hydrogene|energy)/]",
          message: 'Design system : les glows néon sont supprimés — la couleur sémantique suffit.',
        },
        {
          selector: "Literal[value=/shadow-\\[0_0/]",
          message: 'Design system : pas d\'ombre néon — seule shadow-raised est autorisée.',
        },
        {
          selector: "Literal[value=/backdrop-blur/]",
          message: 'Design system : pas de glassmorphism — surfaces pleines (bg-surface / bg-surface-raised).',
        },
        {
          selector: "JSXAttribute[name.name='variant'] Literal[value='retro']",
          message: 'Design system : le variant retro est supprimé — utiliser default/secondary/outline/ghost.',
        },
      ],
    },
  },
);
