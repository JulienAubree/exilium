import { describe, it, expect, vi } from 'vitest';
import type { AllianceLogPayload } from '@exilium/shared';
import { fanoutAllianceLogNotifications } from '../alliance-log.service.js';

describe('fanoutAllianceLogNotifications', () => {
  it('publishes one notification per member with visibility metadata', () => {
    const publish = vi.fn();
    const members = [
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ];
    fanoutAllianceLogNotifications(publish, {
      allianceId: 'a1',
      logId: 'l1',
      visibility: 'officers',
      memberUserIds: members.map((m) => m.userId),
    });
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenNthCalledWith(1, 'u1', {
      type: 'alliance-log:new',
      payload: { allianceId: 'a1', logId: 'l1', visibility: 'officers' },
    });
    expect(publish).toHaveBeenNthCalledWith(3, 'u3', {
      type: 'alliance-log:new',
      payload: { allianceId: 'a1', logId: 'l1', visibility: 'officers' },
    });
  });

  it('does nothing when member list is empty', () => {
    const publish = vi.fn();
    fanoutAllianceLogNotifications(publish, {
      allianceId: 'a1',
      logId: 'l1',
      visibility: 'all',
      memberUserIds: [],
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('swallows publish errors (fire-and-forget)', () => {
    const publish = vi.fn(() => { throw new Error('redis down'); });
    expect(() => fanoutAllianceLogNotifications(publish, {
      allianceId: 'a1',
      logId: 'l1',
      visibility: 'all',
      memberUserIds: ['u1', 'u2'],
    })).not.toThrow();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});

describe('allianceLog type contract', () => {
  it('requires payload.type to match schema', () => {
    const p: AllianceLogPayload = { type: 'member.left', memberId: '11111111-1111-1111-1111-111111111111', memberName: 'x' };
    // Compile-only check — if this stops compiling the contract drifted.
    expect(p.type).toBe('member.left');
  });
});
