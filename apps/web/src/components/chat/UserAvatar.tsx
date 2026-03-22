const AVATAR_GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#059669', '#10b981'],
  ['#dc2626', '#ef4444'],
  ['#d97706', '#f59e0b'],
  ['#0891b2', '#06b6d4'],
  ['#7c3aed', '#a78bfa'],
  ['#db2777', '#f472b6'],
  ['#2563eb', '#3b82f6'],
];

function hashUsername(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_GRADIENTS.length;
}

const SIZES = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
} as const;

interface UserAvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({ username, size = 'md', className = '' }: UserAvatarProps) {
  const [from, to] = AVATAR_GRADIENTS[hashUsername(username)];
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${SIZES[size]} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
    </div>
  );
}
