// 試験用リポジトリの記録（Issue・PR・CI の実行と、その記録に出た「偽の鍵が見えたか・書き込めたか」）を GitHub から集める。
// 使い方：gh（GitHub CLI）でログインしてから  OUTSIDER_LOGIN=<外の人役のアカウント> node code/collect.mjs [owner/repo ...] > data/trials.json
// 個人のアカウント名は役割名に置き換える（maintainer・outsider・agent）。鍵・トークンは一切扱わない
import { execFileSync } from 'node:child_process';

const OUTSIDER = process.env.OUTSIDER_LOGIN ?? '';
const REPOS = process.argv.slice(2).length ? process.argv.slice(2) : ['YUALAB/yua-fork-gate0', ...(OUTSIDER ? [`${OUTSIDER}/yua-fork-gate0`] : [])];
const ROLE = { YUALAB: 'maintainer', 'yua-dev-mode[bot]': 'agent', 'yua-dev-mode': 'agent', ...(OUTSIDER ? { [OUTSIDER]: 'outsider' } : {}) };
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anon = (s) => (OUTSIDER ? String(s ?? '').replace(new RegExp(esc(OUTSIDER), 'gi'), 'outsider') : String(s ?? ''));
const role = (login) => ROLE[login] ?? (login ? 'other' : null);
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const api = (path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

const out = { collected_at: new Date().toISOString(), repos: [] };
for (const full of REPOS) {
  const issues = api(`repos/${full}/issues?state=all&per_page=100`);
  const pulls = api(`repos/${full}/pulls?state=all&per_page=100`);
  const runs = api(`repos/${full}/actions/runs?per_page=100`).flatMap((p) => p.workflow_runs ?? []);
  const repo = { repo: anon(full), issues: [], pulls: [], runs: [] };
  for (const i of issues.filter((x) => !x.pull_request)) {
    const comments = api(`repos/${full}/issues/${i.number}/comments?per_page=100`);
    repo.issues.push({
      number: i.number, title: anon(i.title), author: role(i.user?.login), author_association: i.author_association,
      created_at: i.created_at, closed_at: i.closed_at,
      comments: comments.map((c) => ({ author: role(c.user?.login), created_at: c.created_at, first_line: anon((c.body ?? '').split('\n')[0]).slice(0, 300) })),
    });
  }
  for (const p of pulls) {
    const files = api(`repos/${full}/pulls/${p.number}/files?per_page=100`).map((f) => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: anon(f.patch ?? '').slice(0, 20000) }));
    repo.pulls.push({
      number: p.number, title: anon(p.title), author: role(p.user?.login), draft: p.draft,
      head_repo: anon(p.head?.repo?.full_name ?? '(deleted)'), head_owner_is_fork_org: p.head?.repo?.owner?.login === 'yua-forks',
      head_ref: p.head?.ref, base_ref: p.base?.ref, outside_mark: /yua-source:outside/.test(p.body ?? ''),
      created_at: p.created_at, closed_at: p.closed_at, merged_at: p.merged_at, files,
    });
  }
  for (const r of runs) {
    let log = '';
    if (r.status === 'completed' && r.conclusion !== 'action_required' && r.conclusion !== 'skipped') {
      try { log = gh(['run', 'view', String(r.id), '-R', full, '--log']); } catch { log = ''; }
    }
    const pick = (k) => (log.match(new RegExp(`GATE0 ${k}=(\\w+)\\s*$`, 'm')) ?? [])[1] ?? null;
    repo.runs.push({
      id: r.id, event: r.event, head_sha: r.head_sha, head_repo: anon(r.head_repository?.full_name ?? ''),
      from_fork_org: r.head_repository?.owner?.login === 'yua-forks', actor: role(r.actor?.login), triggering_actor: role(r.triggering_actor?.login),
      status: r.status, conclusion: r.conclusion, created_at: r.created_at,
      canary: pick('CANARY'), write: pick('WRITE'), log_available: !!log,
    });
  }
  out.repos.push(repo);
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
