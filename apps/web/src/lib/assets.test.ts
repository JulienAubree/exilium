import { describe, it, expect } from 'vitest';
import { getAssetUrl } from './assets';

describe('getAssetUrl', () => {
  it('returns base URL when no options', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon')).toBe('/assets/buildings/minerai-mine-icon.webp');
  });

  it('returns base URL when planetType given but hasVariant=false', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon', { planetType: 'volcanic', hasVariant: false }))
      .toBe('/assets/buildings/minerai-mine-icon.webp');
  });

  it('returns variant URL when planetType given and hasVariant=true', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon', { planetType: 'volcanic', hasVariant: true }))
      .toBe('/assets/buildings/minerai-mine/volcanic-icon.webp');
  });

  it('handles defenses', () => {
    expect(getAssetUrl('defenses', 'rocketLauncher', 'thumb', { planetType: 'arid', hasVariant: true }))
      .toBe('/assets/defenses/rocket-launcher/arid-thumb.webp');
  });

  it('falls back to base for non-supported categories even with hasVariant=true', () => {
    expect(getAssetUrl('ships', 'heavyFighter', 'full', { planetType: 'arid', hasVariant: true }))
      .toBe('/assets/ships/heavy-fighter.webp');
  });

  it('handles full size suffix empty string', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'full', { planetType: 'volcanic', hasVariant: true }))
      .toBe('/assets/buildings/minerai-mine/volcanic.webp');
  });
});
