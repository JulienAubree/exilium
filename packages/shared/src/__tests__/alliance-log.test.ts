import { describe, expect, it } from 'vitest';
import {
  AllianceLogPayloadSchema,
  categoryOf,
  isMilitaryType,
  isMemberType,
  type AllianceLogPayload,
} from '../alliance-log.js';

describe('AllianceLogPayloadSchema', () => {
  it('accepts a valid combat.defense payload', () => {
    const p: AllianceLogPayload = {
      type: 'combat.defense',
      memberId: '11111111-1111-1111-1111-111111111111',
      memberName: 'Alice',
      planetId: '22222222-2222-2222-2222-222222222222',
      planetName: 'Home',
      coords: '2:45:8',
      attackerId: '33333333-3333-3333-3333-333333333333',
      attackerName: 'Bob',
      outcome: 'victory',
      reportId: '44444444-4444-4444-4444-444444444444',
    };
    expect(AllianceLogPayloadSchema.parse(p)).toEqual(p);
  });

  it('accepts a valid member.joined payload', () => {
    const p: AllianceLogPayload = {
      type: 'member.joined',
      memberId: '11111111-1111-1111-1111-111111111111',
      memberName: 'Alice',
      via: 'invitation',
    };
    expect(AllianceLogPayloadSchema.parse(p)).toEqual(p);
  });

  it('rejects an unknown type', () => {
    expect(() => AllianceLogPayloadSchema.parse({ type: 'unknown', foo: 'bar' })).toThrow();
  });

  it('rejects a combat payload with wrong outcome', () => {
    expect(() => AllianceLogPayloadSchema.parse({
      type: 'combat.defense',
      memberId: '11111111-1111-1111-1111-111111111111',
      memberName: 'Alice',
      planetId: '22222222-2222-2222-2222-222222222222',
      planetName: 'Home',
      coords: '2:45:8',
      attackerId: '33333333-3333-3333-3333-333333333333',
      attackerName: 'Bob',
      outcome: 'explosion',
      reportId: '44444444-4444-4444-4444-444444444444',
    })).toThrow();
  });

  it('classifies types', () => {
    expect(isMilitaryType('combat.attack')).toBe(true);
    expect(isMilitaryType('espionage.incoming')).toBe(true);
    expect(isMilitaryType('member.joined')).toBe(false);
    expect(isMemberType('member.kicked')).toBe(true);
    expect(isMemberType('combat.defense')).toBe(false);
  });

  it('categoryOf returns the correct category', () => {
    expect(categoryOf('combat.attack')).toBe('military');
    expect(categoryOf('espionage.outgoing')).toBe('military');
    expect(categoryOf('member.left')).toBe('members');
    expect(categoryOf('member.kicked')).toBe('members');
  });

  it('rejects a member.joined payload with a non-UUID memberId', () => {
    expect(() => AllianceLogPayloadSchema.parse({
      type: 'member.joined',
      memberId: 'not-a-uuid',
      memberName: 'Alice',
      via: 'invitation',
    })).toThrow();
  });

  it('rejects a combat.attack payload with a malformed coords', () => {
    expect(() => AllianceLogPayloadSchema.parse({
      type: 'combat.attack',
      memberId: '11111111-1111-1111-1111-111111111111',
      memberName: 'Alice',
      targetId: '22222222-2222-2222-2222-222222222222',
      targetName: 'Bob',
      planetName: 'Home',
      coords: '1:2',
      outcome: 'victory',
      reportId: '44444444-4444-4444-4444-444444444444',
    })).toThrow();
  });
});
