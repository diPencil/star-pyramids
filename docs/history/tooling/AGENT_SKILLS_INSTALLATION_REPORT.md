# Agent Skills Installation Report

## 1. Skills installed

Installed the complete upstream collection: **25 skills**, each retaining its original `SKILL.md` frontmatter and full contents.

- `api-and-interface-design`
- `browser-testing-with-devtools`
- `ci-cd-and-automation`
- `code-review-and-quality`
- `code-simplification`
- `constraint-driven-development`
- `context-engineering`
- `debugging-and-error-recovery`
- `deprecation-and-migration`
- `documentation-and-adrs`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `git-workflow-and-versioning`
- `idea-refine`
- `incremental-implementation`
- `interview-me`
- `observability-and-instrumentation`
- `performance-optimization`
- `planning-and-task-breakdown`
- `security-and-hardening`
- `shipping-and-launch`
- `source-driven-development`
- `spec-driven-development`
- `test-driven-development`
- `using-agent-skills`

All skill-local supporting material was retained: 7 additional files (nested references, examples, frameworks, criteria, and the `idea-refine` shell script). The upstream script was inspected but not executed.

The 7 shared reference checklists were also installed so relative references in the upstream skills resolve correctly.

## 2. Source version

- Repository: <https://github.com/addyosmani/agent-skills>
- Branch inspected: `main`
- Package version: `0.6.13` (from `.codex-plugin/plugin.json`)
- Commit: `aeac41d4d005999432bb7312f7ff06383a91d59d`

## 3. Installation locations

Shared project-local installation (one copy; no skill-tree duplication):

- Skills: `.agents/skills/<skill-name>/SKILL.md`
- Shared references: `.agents/references/<reference-name>.md`

` .agents/skills/ ` is the documented project-level discovery directory for OpenCode, Codex, and Antigravity. Skills use progressive/on-demand loading: agents see skill names/descriptions and load complete skill instructions when selected.

## 4. Compatibility by environment

### OpenCode

- Official documented discovery includes `.agents/skills/<name>/SKILL.md`.
- The installed paths and the required `name`/`description` frontmatter satisfy the documented discovery format.
- The existing root `AGENTS.md` contains the project skill guidance/rules and was preserved with a new appended project-rules section.
- Runtime discovery was **not executable-verified**: `opencode` is not on PATH.

### OpenAI Codex

- Official Codex local skill discovery includes repository `.agents/skills` paths; this uses native project skill discovery and avoids a duplicate copy or global install.
- Codex progressive disclosure and the `SKILL.md` format are supported by this layout. The project `AGENTS.md` is also Codex's native project-instructions file.
- The upstream Codex plugin installation method requires Codex CLI; it was not run because `codex` is not on PATH. Native project-local skill directory compatibility was selected instead.
- Runtime discovery was **not executable-verified**: `codex` is not on PATH.

### Google Antigravity

- Google's official documentation lists `<workspace-root>/.agents/skills/<skill-folder>/` for project skills in the App, CLI, and IDE.
- The installed paths and skill manifests satisfy that directory format; Antigravity uses progressive disclosure.
- Upstream additionally documents a native `agy plugin` install, but no plugin/global install was attempted.
- Runtime discovery was **not executable-verified**: `agy` and `antigravity` are not on PATH.

### Freebuff

- The cross-agent constraints are written in root `AGENTS.md`, which is the existing project instruction entry point.
- The shared `.agents/skills` directory makes the collection available as project files, but no Freebuff-specific automatic skill-discovery mechanism was independently confirmed. Treat Freebuff skill auto-discovery as **unverified**; the project rules are present in `AGENTS.md`.

## 5. Shared configuration approach

All three requested external coding tools document the same project-local `.agents/skills` discovery path, so one unchanged copy of the upstream skills serves them. The upstream pack's seven shared references are in `.agents/references`, matching the relative paths expected from `.agents/skills/<skill>/`. No symlinks, host-specific duplicate skill trees, new package dependencies, or global tooling were added.

The existing `AGENTS.md` was not overwritten. A final section titled **“STAR PYRAMIDS project rules  -  highest priority for all agents”** was appended to make these constraints explicit to agents and higher priority than general skill workflows:

- No browser use, browser automation, or browser-based testing.
- No staging, commits, pushes, or deployments without explicit user approval; no production operations.
- No database resets/seeds or destructive migrations; preserve local development data.
- Preserve the design system and layouts; avoid unrelated code/configuration changes.
- Keep EN/ES/IT; Arabic remains disabled.
- Do not access or modify `web-source-recovery`.
- Inspect bundled/repository scripts before any execution; never execute them without inspecting their effects.
- If a skill conflicts with these rules, the project rules prevail.

## 6. Verification results

Filesystem/configuration checks only; no browser testing, application tests, database actions, builds, or service starts were performed.

- Upstream skills found: **25**.
- Installed `SKILL.md` files: **25**.
- Skill bundle files installed: **32** total (25 manifests plus 7 supporting files).
- Shared reference files installed: **7**.
- Copy comparison against the inspected upstream checkout: exact match for `skills/` and `references/` (`diff -qr` had no differences).
- Frontmatter: all 25 installed manifests have a name and description; each name matches its directory and conforms to lower-case hyphen naming.
- Duplicate skill names: **none** in the installed collection; no prior project skills were found before installation.
- Reference and nested support assets: retained; skill/reference tree copied without omissions.
- OpenCode discovery: documented directory/frontmatter format confirmed; CLI runtime unavailable.
- Codex discovery: documented project-local directory/frontmatter format confirmed; CLI runtime unavailable.
- Antigravity discovery: documented project-local directory format confirmed; CLI runtime unavailable.
- Freebuff automatic skill discovery: unresolved/unverified; project instructions are in `AGENTS.md`.
- Agent CLI availability: `opencode`, `codex`, `agy`, and `antigravity` were all absent from PATH.

## 7. Exact files created or modified

### Modified

- `AGENTS.md`  -  appended the STAR PYRAMIDS agent-priority rules; existing content retained.

### Created under `.agents/skills/`

- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/browser-testing-with-devtools/SKILL.md`
- `.agents/skills/ci-cd-and-automation/SKILL.md`
- `.agents/skills/code-review-and-quality/SKILL.md`
- `.agents/skills/code-simplification/SKILL.md`
- `.agents/skills/constraint-driven-development/SKILL.md`
- `.agents/skills/constraint-driven-development/references/floor-guard.md`
- `.agents/skills/context-engineering/SKILL.md`
- `.agents/skills/debugging-and-error-recovery/SKILL.md`
- `.agents/skills/deprecation-and-migration/SKILL.md`
- `.agents/skills/documentation-and-adrs/SKILL.md`
- `.agents/skills/doubt-driven-development/SKILL.md`
- `.agents/skills/frontend-ui-engineering/SKILL.md`
- `.agents/skills/git-workflow-and-versioning/SKILL.md`
- `.agents/skills/idea-refine/SKILL.md`
- `.agents/skills/idea-refine/examples.md`
- `.agents/skills/idea-refine/frameworks.md`
- `.agents/skills/idea-refine/refinement-criteria.md`
- `.agents/skills/idea-refine/scripts/idea-refine.sh`
- `.agents/skills/incremental-implementation/SKILL.md`
- `.agents/skills/interview-me/SKILL.md`
- `.agents/skills/observability-and-instrumentation/SKILL.md`
- `.agents/skills/performance-optimization/SKILL.md`
- `.agents/skills/performance-optimization/references/optimization-patterns.md`
- `.agents/skills/planning-and-task-breakdown/SKILL.md`
- `.agents/skills/security-and-hardening/SKILL.md`
- `.agents/skills/security-and-hardening/references/hardening-patterns.md`
- `.agents/skills/shipping-and-launch/SKILL.md`
- `.agents/skills/source-driven-development/SKILL.md`
- `.agents/skills/spec-driven-development/SKILL.md`
- `.agents/skills/test-driven-development/SKILL.md`
- `.agents/skills/using-agent-skills/SKILL.md`

### Created under `.agents/references/`

- `.agents/references/accessibility-checklist.md`
- `.agents/references/definition-of-done.md`
- `.agents/references/observability-checklist.md`
- `.agents/references/orchestration-patterns.md`
- `.agents/references/performance-checklist.md`
- `.agents/references/security-checklist.md`
- `.agents/references/testing-patterns.md`

### Created

- `AGENT_SKILLS_INSTALLATION_REPORT.md`  -  this report.

No application dependencies or application source code were changed for this installation. No commit, push, staging, deployment, database operation, or browser action was performed.

The working tree already contained extensive uncommitted development work before installation. This task's intended changes are the `AGENTS.md` addition, the `.agents/` skill/reference files, and this report; unrelated working-tree entries were left untouched.

## 8. Updating the collection later

1. Inspect the upstream installation guide and compare the new release before updating.
2. Fetch/clone the desired upstream revision and record its commit and package version.
3. Compare skill names and existing local files first; do not overwrite local additions or customizations without review.
4. Update `.agents/skills/` and `.agents/references/` from the chosen upstream revision, retaining the complete directory trees and nested assets.
5. Re-run filesystem checks for `SKILL.md` count, frontmatter, duplicate names, references, and parity with upstream. Start fresh OpenCode, Codex, and Antigravity sessions to check runtime discovery when those CLIs are available.
6. Preserve the STAR PYRAMIDS rules in `AGENTS.md`; do not replace the project instructions with upstream repository instructions.

## Sources

- Upstream repository: https://github.com/addyosmani/agent-skills
- Upstream OpenCode setup: https://github.com/addyosmani/agent-skills/blob/main/docs/opencode-setup.md
- Upstream Codex setup: https://github.com/addyosmani/agent-skills/blob/main/docs/codex-setup.md
- Upstream Antigravity setup: https://github.com/addyosmani/agent-skills/blob/main/docs/antigravity-setup.md
- OpenCode skills documentation: https://opencode.ai/docs/skills/
- Codex skills documentation: https://developers.openai.com/codex/build-skills
- Codex project instructions documentation: https://developers.openai.com/codex/agent-configuration/agents-md
- Antigravity skills documentation: https://antigravity.google/docs/skills/
