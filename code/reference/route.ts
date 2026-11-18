/**
 * Reference sketch of the routing rules in "Route, Don't Refuse" (AQUA Research Technical Report 009).
 * Written for the paper; it is not the production code of YUA. Pure functions only, no network.
 */

/** Where a job's changes are published. */
export type Route = 'in-repo' | 'fork' | 'ask-human';

export interface Job {
  /** Text whose author cannot write to the repository was read (issue body, web page, registry text, foreign commit...). */
  outside: boolean;
  /** Reasons, shown in the pull request. */
  outsideWhy: string[];
  repoIsPublic: boolean;
  /** Owner opted in with .yua/settings.json {"pr_from_fork": "always"} on the default branch. */
  ownerAlwaysFork: boolean;
  /** The job adds to a pull request that the agent already opened from its fork. */
  addsToAgentForkPr: boolean;
}

/**
 * Untrusted input never meets repository secrets: such jobs go to the fork (no secrets, read-only token
 * for fork pull requests) when possible, and to a human only when no fork can exist (private repositories).
 */
export function route(job: Job, forkAvailable: boolean): Route {
  if (job.addsToAgentForkPr) return forkAvailable ? 'fork' : 'ask-human';
  const wantsFork = job.outside || job.ownerAlwaysFork;
  if (!wantsFork) return 'in-repo';
  if (job.repoIsPublic && forkAvailable) return 'fork';
  return 'ask-human';
}

/** Taint is sticky: once any stage reads outside text, every later stage of the same job is outside. */
export function mergeTaint(a: Pick<Job, 'outside' | 'outsideWhy'>, b: Pick<Job, 'outside' | 'outsideWhy'>) {
  return { outside: a.outside || b.outside, outsideWhy: [...new Set([...a.outsideWhy, ...b.outsideWhy])].slice(0, 5) };
}

export interface PrHead { repo: string; ownerId: number | null; ref: string; author: string | null }

/**
 * Is this pull request one the agent opened from its fork? Identity is by number, never by name:
 * the head must live in the fork organisation (numeric id), on an agent branch, and the PR must be
 * authored by the agent's bot account (anyone can open a PR whose head is a public fork branch).
 */
export function isAgentForkHead(h: PrHead, fork: { org: string; orgId: number; bot: string }): boolean {
  const [org, repo, extra] = h.repo.split('/');
  return h.ownerId === fork.orgId && (h.author ?? '').toLowerCase() === fork.bot.toLowerCase()
    && !!repo && extra === undefined && org.toLowerCase() === fork.org.toLowerCase() && h.ref.startsWith('agent/');
}

export interface ForkRepo { fork?: boolean; parent?: { id: number; private?: boolean; visibility?: string } | null; description?: string | null; pushed_at?: string | null; created_at?: string | null; updated_at?: string | null }

/**
 * Daily sweep: delete a marked fork when its upstream stopped being public (GitHub detaches public forks
 * of a repository made private: fork=false), or when it has had no open pull request for `idleDays`.
 * Ambiguous answers keep the fork.
 */
export function sweepReason(r: ForkRepo, openPulls: number, now: number, mark = '[agent-fork]', idleDays = 30): string | null {
  if (!(r.description ?? '').startsWith(mark)) return null;
  if (r.fork === false) return 'detached from upstream';
  if (r.fork !== true || !r.parent) return null;
  if (r.parent.private === true || r.parent.visibility === 'private' || r.parent.visibility === 'internal') return 'upstream not public';
  if (r.parent.private !== false || openPulls !== 0) return null;
  const last = Math.max(...[r.pushed_at, r.created_at, r.updated_at].map((t) => Date.parse(t ?? '') || 0));
  return last && now - last > idleDays * 86_400_000 ? `idle for ${idleDays} days` : null;
}
