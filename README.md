# Data and code: Route, Don't Refuse

Data, records and code for the report

> Shinji Yumura. **Route, Don't Refuse: Capability-Preserving Isolation of Prompt-Injection-Exposed Agent Work through Fork-Based Pull Requests.** AQUA Research Technical Report 009, AQUA LLC, 2026.
> Japanese: <https://www.aquallc.jp/research/route-dont-refuse/> · English PDF: <https://www.aquallc.jp/wp-content/uploads/research/aqua-tr-009-route-dont-refuse-en.pdf>

A coding agent summoned from GitHub issues (YUA, `@yua`) used to publish every job as a branch inside the repository, where CI runs with the repository's secrets. Jobs that read text written by people who cannot write to the repository (issue bodies, web pages, package metadata, foreign commits, other apps' CI logs) are now published as draft pull requests from a fork in an organisation owned by the operator. GitHub does not pass secrets to workflows triggered by pull requests from forks and gives them a read-only token, so containment is enforced by the platform, not by the model. This repository holds the evidence that this works in practice.

## Main result (from `data/trials.json`)

| Origin of the CI run | Runs | Canary secret readable | Token can write |
|---|---:|---:|---:|
| In-repository push | 8 | 8 | 8 |
| Pull request from the agent's fork | 14 | 0 | 0 |

`python3 analysis/summarize.py` recomputes this table and the pull-request counts from the released records.

## Contents

```
data/trials.json             every issue, pull request and workflow run of the probe repositories (18 Nov 2026),
                             with the two markers each run printed (CANARY=present/absent, WRITE=yes/no).
                             User names are replaced by roles: maintainer, outsider, agent, other (= fork keeper App)
data/summary.json            numbers used in the report (written by analysis/summarize.py)
data/github-behavior.json    six GitHub behaviours that differed from documentation or assumptions (B1-B6)
data/review-findings.json    the six adversarial review rounds, with the reviewers' own labels (33 findings)
data/timeline.csv            the commits of the change, in order (production repository, times in JST)
analysis/summarize.py        recomputes Table 2 and the pull-request counts
code/collect.mjs             re-collects data/trials.json from the GitHub API (needs the GitHub CLI, `gh auth login`)
code/probe-workflow.yml      the probe repository's CI: prints whether the canary secret is set (never its value)
                             and whether GITHUB_TOKEN can create a tag
code/probe-repo-*            the rest of the probe repository (a one-line function and its test)
code/reference/route.ts      reference sketch of the routing, identity and sweep rules (not the production code)
code/reference/route.test.ts tests for the sketch (`npx vitest run code/reference`)
```

Text inside `data/` is partly in Japanese (descriptions written for the Japanese report); field names are in English.

## What is not included

The production source code of YUA and its prompts are not released. The probe repository and its forks were public during the tests; the canary was a dummy value.

## Reproducing

```
python3 analysis/summarize.py          # Table 2, PR counts, and the check of the agent's added lines
node code/collect.mjs > data/trials.json   # re-collect from GitHub (results change if the probe repositories change)
```

## Licence

Code (`code/`, `analysis/*.py`): MIT (`LICENSE`). Data (`data/`, `analysis/` outputs): CC BY 4.0 (`LICENSE-DATA`).

## Citation

See `CITATION.cff`.
