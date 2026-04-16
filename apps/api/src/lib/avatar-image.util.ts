import fs from 'fs';
import path from 'path';

/**
 * Get the next available index for avatar images (for upload).
 */
export function getNextAvatarIndex(assetsDir: string): number {
  const dir = path.join(assetsDir, 'avatars');
  if (!fs.existsSync(dir)) return 1;

  const indexes = fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10));

  if (indexes.length === 0) return 1;
  return Math.max(...indexes) + 1;
}

/**
 * List all available avatar image indexes.
 */
export function listAvatarIndexes(assetsDir: string): number[] {
  const dir = path.join(assetsDir, 'avatars');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);
}
