import { describe, it, expect } from 'vitest';
import { computeTabBadges } from '../features/notifications/tabBadges';

describe('computeTabBadges', () => {
  it('shows no dots with no pending signals', () => {
    const badges = computeTabBadges({ pendingHostRequests: 0, unseenAcceptances: 0 });
    expect(badges).toEqual({
      index: false,
      list: false,
      'my-activities': false,
      profile: false,
    });
  });

  it('lights My Squads for a host with pending requests', () => {
    const badges = computeTabBadges({ pendingHostRequests: 3, unseenAcceptances: 0 });
    expect(badges['my-activities']).toBe(true);
  });

  it('lights My Squads for a joiner with an unseen acceptance', () => {
    const badges = computeTabBadges({ pendingHostRequests: 0, unseenAcceptances: 1 });
    expect(badges['my-activities']).toBe(true);
  });

  it('never lights unrelated tabs from these signals', () => {
    const badges = computeTabBadges({ pendingHostRequests: 2, unseenAcceptances: 2 });
    expect(badges.index).toBe(false);
    expect(badges.list).toBe(false);
    expect(badges.profile).toBe(false);
  });
});
