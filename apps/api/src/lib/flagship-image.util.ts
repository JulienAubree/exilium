import fs from 'fs';
import path from 'path';

/**
 * Scan /assets/flagships/ for hero images (N.webp without suffix).
 * Returns a random index from available images, or null if none exist.
 */
export function getRandomFlagshipImageIndex(assetsDir: string): number | null {
  const dir = path.join(assetsDir, 'flagships');
  if (!fs.existsSync(dir)) return null;

  const indexes = fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);

  if (indexes.length === 0) return null;
  return indexes[Math.floor(Math.random() * indexes.length)];
}

/**
 * Get the next available index for flagship images (for upload).
 */
export function getNextFlagshipImageIndex(assetsDir: string): number {
  const dir = path.join(assetsDir, 'flagships');
  if (!fs.existsSync(dir)) return 1;

  const indexes = fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10));

  if (indexes.length === 0) return 1;
  return Math.max(...indexes) + 1;
}

/**
 * List all available image indexes for flagships.
 */
export function listFlagshipImageIndexes(assetsDir: string): number[] {
  const dir = path.join(assetsDir, 'flagships');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);
}
