import type { SVGProps, ComponentType } from 'react';

const defaults: SVGProps<SVGSVGElement> = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function RoleAllIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

// Glyphs mirror those used by MissionIcon (apps/web/src/components/fleet/MissionIcon.tsx)
// so the filter chips read the same visually as their matching mission in the fleet UI.

export function RoleTransportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M21 8L12 2 3 8v8l9 6 9-6V8z" />
      <path d="M3 8l9 6 9-6" />
      <path d="M12 14v8" />
    </svg>
  );
}

export function RoleMiningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 3l5 1 4 3 2 5-1 4-3 4-5 1-4-1-3-3-2-4 1-5 3-3z" />
      <line x1="9" y1="10" x2="11" y2="14" strokeWidth={1.5} opacity={0.4} />
      <line x1="14" y1="8" x2="15" y2="12" strokeWidth={1.5} opacity={0.4} />
    </svg>
  );
}

export function RoleRecyclingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M6 18.7l-3 1 1-3" />
      <path d="M18 5.3l3-1-1 3" />
    </svg>
  );
}

export function RoleColonizationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 20a10 10 0 0 1 20 0" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <path d="M12 4l6 3-6 3" />
    </svg>
  );
}

export function RoleExplorationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <circle cx="11" cy="11" r="3" fill="currentColor" fillOpacity={0.2} />
    </svg>
  );
}

export function RoleEspionageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function RoleEnergyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// ── Role definitions ────────────────────────────────────────────────────
// Canonical order for displaying ship roles in the shipyard. Any ship whose
// `role` isn't in this list is dropped (e.g. combat ships built at the
// Command Center).

export type ShipyardRoleId =
  | 'transport'
  | 'mining'
  | 'recycling'
  | 'colonization'
  | 'exploration'
  | 'espionage'
  | 'energy';

export const SHIPYARD_ROLES: {
  id: ShipyardRoleId;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: 'transport', label: 'Transport', Icon: RoleTransportIcon },
  { id: 'mining', label: 'Minier', Icon: RoleMiningIcon },
  { id: 'recycling', label: 'Recyclage', Icon: RoleRecyclingIcon },
  { id: 'colonization', label: 'Colonisation', Icon: RoleColonizationIcon },
  { id: 'exploration', label: 'Exploration', Icon: RoleExplorationIcon },
  { id: 'espionage', label: 'Espionnage', Icon: RoleEspionageIcon },
  { id: 'energy', label: 'Énergie', Icon: RoleEnergyIcon },
];

export const SHIPYARD_ROLE_MAP: Record<ShipyardRoleId, typeof SHIPYARD_ROLES[number]> =
  Object.fromEntries(SHIPYARD_ROLES.map((r) => [r.id, r])) as Record<ShipyardRoleId, typeof SHIPYARD_ROLES[number]>;
