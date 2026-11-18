import { describe, expect, it } from 'vitest';
import { isAgentForkHead, mergeTaint, route, sweepReason } from './route';

const base = { outside: false, outsideWhy: [], repoIsPublic: true, ownerAlwaysFork: false, addsToAgentForkPr: false };
describe('route', () => {
  it('keeps trusted work in the repository', () => expect(route(base, true)).toBe('in-repo'));
  it('sends tainted work on public repositories to the fork', () => expect(route({ ...base, outside: true }, true)).toBe('fork'));
  it('asks a human only when no fork is possible', () => {
    expect(route({ ...base, outside: true, repoIsPublic: false }, true)).toBe('ask-human');
    expect(route({ ...base, outside: true }, false)).toBe('ask-human');
  });
  it('honours the owner opt-in', () => expect(route({ ...base, ownerAlwaysFork: true }, true)).toBe('fork'));
  it('taint is sticky across stages', () => expect(mergeTaint({ outside: true, outsideWhy: ['a'] }, { outside: false, outsideWhy: [] }).outside).toBe(true));
});
describe('isAgentForkHead', () => {
  const fork = { org: 'agent-forks', orgId: 42, bot: 'agent[bot]' };
  const ok = { repo: 'agent-forks/acme--app', ownerId: 42, ref: 'agent/x', author: 'agent[bot]' };
  it('accepts only org id + bot author + agent branch', () => {
    expect(isAgentForkHead(ok, fork)).toBe(true);
    expect(isAgentForkHead({ ...ok, author: 'mallory' }, fork)).toBe(false);
    expect(isAgentForkHead({ ...ok, ownerId: 7 }, fork)).toBe(false);
    expect(isAgentForkHead({ ...ok, ref: 'main' }, fork)).toBe(false);
  });
});
describe('sweepReason', () => {
  const now = Date.parse('2026-12-31T00:00:00Z');
  const f = { description: '[agent-fork] x', fork: true, parent: { id: 1, private: false, visibility: 'public' }, pushed_at: '2026-11-01T00:00:00Z' };
  it('deletes detached or non-public upstreams at once', () => {
    expect(sweepReason({ ...f, fork: false, parent: null }, 0, now)).toBe('detached from upstream');
    expect(sweepReason({ ...f, parent: { id: 1, private: true } }, 3, now)).toBe('upstream not public');
  });
  it('keeps unmarked, ambiguous, busy and recent forks', () => {
    expect(sweepReason({ ...f, description: 'someone else' , fork: false }, 0, now)).toBeNull();
    expect(sweepReason({ ...f, parent: null }, 0, now)).toBeNull();
    expect(sweepReason(f, 1, now)).toBeNull();
    expect(sweepReason({ ...f, pushed_at: '2026-12-30T00:00:00Z' }, 0, now)).toBeNull();
  });
  it('deletes idle forks', () => expect(sweepReason(f, 0, now)).toBe('idle for 30 days'));
});
