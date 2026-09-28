# Per-Change Changelog Files

One file per shipped change. Named `vX.Y.Z.md` after the release tag it shipped in (or
`YYYY-MM-DD-short-slug.md` for a change deployed without a tag, which is currently the norm
since deploys are manual; see `AGENTS.md` §6).

## When to create one

Every change that reaches production, no matter how small. Same trigger as `AGENTS.md` §7.

## What goes in it

```markdown
# vX.Y.Z — YYYY-MM-DD

**Type:** feat | fix | chore | refactor | docs
**Scope:** area of the codebase affected (analyze, guidelines, api/score, db, deploy, ...)

One-paragraph summary of what changed.

**Why:** the decision/rationale — what problem this solved, what was tried before, what broke.
This is the part an auto-generated PR-title changelog can never produce.

**Files changed:** short list or "see commit diff"
```

## How this feeds release notes

When cutting a formal release, compile the notes from every changelog file in range instead of
relying solely on an auto-generated "PR titles" release-notes feature, which loses the "why."
If the CI/CD provider auto-creates a release the moment a tag is pushed, plan to immediately
edit that release's notes with the compiled version rather than trying to race it or create a
duplicate.

## Retroactive backfill

Not required. Starts from the next shipped change going forward.
