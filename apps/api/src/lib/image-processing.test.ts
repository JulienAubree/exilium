import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { processBuildingVariant } from './image-processing.js';

describe('processBuildingVariant', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'variant-')); });
  afterAll(() => { /* cleanup handled per test */ });

  it('writes hero/thumb/icon webp files under {category}/{id}/{planetType}*.webp', async () => {
    const src = await sharp({ create: { width: 1400, height: 1400, channels: 3, background: '#888' } }).png().toBuffer();
    const files = await processBuildingVariant(src, 'buildings', 'mineraiMine', 'volcanic', dir);

    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic.webp'))).toBe(true);
    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic-thumb.webp'))).toBe(true);
    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic-icon.webp'))).toBe(true);
    expect(files).toEqual(expect.arrayContaining(['volcanic.webp', 'volcanic-thumb.webp', 'volcanic-icon.webp']));
    rmSync(dir, { recursive: true });
  });

  it('works for defenses too', async () => {
    const src = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#333' } }).png().toBuffer();
    await processBuildingVariant(src, 'defenses', 'rocketLauncher', 'arid', dir);
    expect(existsSync(join(dir, 'defenses', 'rocket-launcher', 'arid-icon.webp'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('rejects categories other than buildings|defenses', async () => {
    const src = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(processBuildingVariant(src, 'ships' as never, 'x', 'volcanic', dir)).rejects.toThrow();
  });
});
