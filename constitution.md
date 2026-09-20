# Star Pyramids Engineering Constitution

## 1. Authority and scope

This document defines the mandatory engineering process for every feature, bug
fix, refactor, dependency update, and configuration change in this repository.
It applies to human and AI contributors.

Priority order when instructions conflict:

1. The user's current explicit request.
2. Security, privacy, and data-integrity requirements.
3. This constitution.
4. `AGENTS.md` and area-specific agent files.
5. `DESIGN_SYSTEM.md` and other repository documentation.
6. Existing implementation patterns.

Do not silently bypass a rule. If a rule cannot be satisfied, explain the
constraint, reduce risk where possible, and identify the missing verification
in the completion report.

## 2. Core principles

1. **Evidence before assumptions.** Read the owning code, configuration, local
   framework docs, and related tests before designing a change.
2. **User outcome first.** Define the behavior and acceptance criteria before
   selecting an implementation.
3. **Smallest coherent change.** Solve the requested problem completely while
   avoiding unrelated refactors and speculative infrastructure.
4. **Preserve working code.** Never rewrite an entire working file merely
   because a feature touches part of it. Inspect the current diff, preserve
   unrelated user and agent work, and prefer surgical changes to the owning
   code.
5. **One source of truth.** Extend the existing owner of data, behavior, styles,
   or documentation instead of introducing parallel copies.
6. **Secure by default.** Validate at trust boundaries, authorize on the server,
   protect secrets, and collect only necessary data.
7. **Accessible and responsive by default.** Keyboard, focus, semantics, RTL,
   reduced motion, mobile, and desktop behavior are part of correctness.
8. **Verification is part of implementation.** A feature is not complete merely
   because code was written or a build command exited successfully.
9. **Truthful reporting.** Never claim a test, review, browser check, security
   property, persistence layer, or integration that does not exist or was not
   verified.

## 3. Feature intake gate

Before implementation, establish a lightweight feature contract. It can live in
the task notes for small work or in a dedicated spec for larger work. Record:

- problem and intended user;
- in-scope and explicitly out-of-scope behavior;
- observable acceptance criteria;
- affected routes, components, data, integrations, and documentation;
- empty, loading, success, validation, permission, error, and retry states;
- responsive, accessibility, locale, and RTL expectations;
- security, privacy, persistence, analytics, and migration implications;
- verification plan and rollback or recovery approach when risk warrants it.

Ask for clarification only when different answers would materially change the
product behavior, data model, security boundary, or irreversible outcome.
Otherwise make the smallest reasonable assumption and state it.

## 4. Discovery and design gate

Before editing:

1. Read the required documents in `AGENTS.md`.
2. Trace the current behavior from route to component, data source, styles, and
   side effects.
3. Search for an existing component, token, helper, or pattern that already owns
   the concern.
4. Check the installed Next.js documentation for APIs whose behavior may differ
   by version.
5. Identify whether the current screen is a prototype or backed by a real
   server. Do not turn simulated success into a production claim.
6. Choose the smallest design that satisfies the acceptance criteria and fits
   the current architecture.

For substantial or risky work, write a short implementation plan before edits.
The plan must include verification, not only code changes.

## 5. Implementation gate

### Architecture and code

- Keep route files thin and place reusable behavior in the established owning
  module.
- Inspect the current file and diff before editing. Preserve unrelated user and
  agent work, and patch only the owning code needed by the accepted scope.
- Never replace or broadly reformat a working file merely because one section
  needs to change.
- Prefer server components. Use client components only for state, effects,
  event handlers, or browser-only APIs.
- Use strict, explicit TypeScript types at component, data, and trust
  boundaries. Avoid `any`; if legacy `any` is touched, narrow it when practical.
- Keep functions and components focused. Extract an abstraction only when it
  removes real duplication or clarifies a stable domain concept.
- Handle failures deliberately. Never swallow errors or present success before
  the underlying operation succeeds.
- Preserve backward compatibility unless the accepted feature contract calls
  for a breaking change and its migration is documented.
- Do not edit generated files or vendor code.

### UI and content

- Follow `DESIGN_SYSTEM.md`, existing CSS variables, and established
  component patterns.
- Use semantic HTML and native controls first. Every control must have an
  accessible name and visible keyboard focus.
- Support keyboard operation, sensible tab order, touch targets, error
  identification, and non-color state indicators.
- Verify mobile, tablet, and desktop layouts. Text and controls must not overlap,
  clip, or create unintended horizontal scrolling.
- Preserve English and Arabic behavior, including direction, alignment, font,
  and content expansion, whenever shared UI is affected.
- Provide meaningful image alt text; use empty alt text for decorative images.
- Honor reduced-motion preferences for non-essential animation.
- Do not add a new visual token when an existing token communicates the same
  role.

### Data and integrations

- Define ownership, validation, lifecycle, and failure behavior before adding
  persisted data.
- Keep external calls behind a small boundary with typed inputs and outputs,
  timeouts, explicit error handling, and safe retries where appropriate.
- Make mutation retries idempotent or protect them with idempotency keys when
  duplicate actions could cause harm.
- Never ship placeholder persistence, fake authentication, mock payment, or
  simulated submission as production-ready behavior.

## 6. Security and privacy gate

Every change must be checked against the following list. Items that do not apply
should be consciously marked not applicable during self-review.

### Secrets and configuration

- Never commit API keys, passwords, tokens, private URLs, or customer data.
- Keep secrets server-side and load them from validated environment variables.
- Never expose a secret through `NEXT_PUBLIC_*`, client bundles, logs, errors,
  analytics, screenshots, or test fixtures.
- Fail safely when required configuration is missing.

### Input, output, and browser safety

- Validate type, format, length, range, and allowed values at every trust
  boundary. Client validation improves UX but never replaces server validation.
- Use framework escaping. Avoid `dangerouslySetInnerHTML`; sanitize with a
  maintained allowlist-based library if trusted rich text is a real requirement.
- Prevent injection by using parameterized database queries and structured APIs
  when server/data layers are introduced.
- Validate redirects and external URLs against an allowlist.
- External links opened in a new tab must use `rel="noopener noreferrer"` or an
  equivalent safe value.
- File uploads, if introduced, require server-side size/type checks, generated
  storage names, malware handling, and non-executable storage.

### Authentication and authorization

- Authentication and authorization decisions must occur on the server.
- Check authorization for every protected action and every resource; hidden UI
  is not access control.
- Prevent insecure direct object references by scoping queries to the authorized
  user or role.
- Use secure, HttpOnly, SameSite cookies for sessions and CSRF protection for
  cookie-authenticated mutations.
- Rate-limit authentication, recovery, contact, review, booking, and payment
  endpoints when they become real server actions.
- Do not reveal whether an account exists in login or recovery responses.

### Privacy, logging, and dependencies

- Collect the minimum personal data needed and document its purpose and
  retention.
- Never log credentials, session values, full payment data, or unnecessary PII.
- Return safe user-facing errors while retaining actionable, sanitized server
  diagnostics.
- Use the existing package manager and lockfile. Review dependency purpose,
  maintenance, license, and security impact before adding it.
- For sensitive changes, run the project's available dependency/security checks
  and record any unresolved finding. Do not apply blind breaking upgrades merely
  to silence a scanner.

Payment data must be handled by a compliant payment provider; never store raw
card numbers or CVV in this application.

## 7. Testing strategy gate

Tests must match the risk and behavior of the change.

The automated-test entries below become mandatory when the repository has an
official quality stack. Until then, agents must not install frameworks to make
an ordinary feature task conform to the table; they must perform all currently
available checks and explicitly report the missing automated coverage.

| Change type | Minimum verification |
| --- | --- |
| Documentation only | Review links, paths, commands, and internal consistency |
| Static content or low-risk CSS | Type check, production build, affected-page browser check |
| Stateful UI or reusable logic | Focused automated tests plus type check, build, and browser check |
| Route, form, search, planner, or booking flow | Unit/component coverage as appropriate and an end-to-end happy path plus key failure path |
| Auth, authorization, payment, personal data, upload, or server mutation | Unit, integration, end-to-end, negative authorization, validation, and security-boundary tests |
| Shared component, global CSS, locale, or configuration | Representative regression checks across all affected route families |

Test behavior, not private implementation details. Include boundary values,
empty data, invalid input, errors, and recovery where applicable. A regression
fix should include a test that fails before the fix whenever the repository's
official test harness supports that behavior.

Current repository reality:

- There is no configured automated test runner or lint script.
- This absence is not permission to claim tests passed.
- Until the project's testing and linting stack is intentionally established as
  a dedicated infrastructure task, an agent must not introduce a new test
  framework, lint framework, E2E framework, or major quality dependency solely
  to satisfy a feature task.
- Feature work must instead perform all currently available verification:
  browser testing, TypeScript checking, production build validation, focused
  manual regression, relevant searches, and self-review.
- Every completion report must explicitly identify automated coverage that is
  missing because the official tooling has not yet been established.

### Quality-stack governance

The official quality stack must be chosen once through a dedicated
infrastructure task with explicit scope. That task must:

1. evaluate and select one linting solution, one unit/component testing
   solution, and one E2E solution that fit the current Next.js version;
2. configure them centrally with documented package scripts and conventions;
3. add a small representative test at each selected layer to prove the setup;
4. update `AGENTS.md`, this constitution, and `package.json` so the selected
   tools and commands become the only official quality stack;
5. define the migration policy for existing code and avoid unrelated mass
   formatting or test rewrites.

Possible tools such as ESLint, Vitest, React Testing Library, and Playwright are
candidates, not current project standards. No agent may treat them as approved
until that infrastructure task records the decision in the repository.

## 8. Mandatory verification gate

Run commands from the application root (the directory containing
`package.json`) unless the command says otherwise.

```powershell
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

Both commands are required for code changes. The build alone is insufficient
because `next.config.mjs` currently ignores TypeScript build errors.

Also run these commands only when the repository's official quality stack
defines them:

```powershell
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
```

Do not invent missing scripts. If a command cannot run because of an
environment limitation, document the exact limitation and perform the strongest
safe alternative.

### Browser validation

For user-facing changes, run the app and inspect the affected flow in a real
browser. At minimum verify:

- the acceptance criteria and primary interaction;
- loading, empty, validation, error, success, and retry states that apply;
- keyboard-only use and visible focus;
- no relevant console errors, hydration errors, or failed network requests;
- responsive behavior at approximately 375px, 768px, and 1440px widths;
- English and Arabic/RTL when shared or localized UI is touched;
- adjacent routes that reuse the changed component or global style.

Use screenshots or visual diffs for material layout changes when tooling is
available. A browser check is evidence, not a substitute for automated tests.

## 9. Self-review gate

After implementation and before final reporting, inspect the complete diff as a
reviewer. Ask:

### Correctness

- Does every acceptance criterion pass?
- Are state transitions, URLs, dates, currencies, and boundary values correct?
- Are stale state, duplicate submission, async races, and failure recovery
  handled?
- Did the change accidentally alter unrelated routes or shared behavior?

### Maintainability

- Is the code in the correct owner and consistent with nearby patterns?
- Is there duplicated logic, dead code, an unnecessary dependency, or a leaky
  abstraction?
- Are names and types clear? Are comments limited to non-obvious reasoning?
- Did configuration, dependencies, routes, or behavior changes update docs?

### UX, accessibility, and localization

- Can the feature be understood and completed without a mouse?
- Are labels, headings, errors, focus, semantics, contrast, and touch targets
  correct?
- Does the layout survive long text, narrow screens, zoom, and RTL?
- Are disabled, loading, empty, success, and failure states honest and clear?

### Security and privacy

- What new input, output, data, permission, secret, redirect, upload, or external
  dependency crossed a trust boundary?
- Is server-side validation and authorization present where required?
- Could logs, UI, analytics, URLs, or errors expose sensitive data?
- Can the operation be abused through replay, enumeration, injection, CSRF,
  insecure object references, or excessive requests?

### Performance and reliability

- Did the change add avoidable client JavaScript, rerenders, large media, layout
  shift, unbounded work, or duplicate requests?
- Are external operations bounded by timeout and safe retry behavior?
- Is there a graceful failure path?

Fix issues discovered in self-review, rerun affected checks, and review the diff
again.

## 10. Code-review gate

Substantial, risky, or shared changes require a second review by a human or an
independent AI review pass. Review findings are ordered by severity:

- **P0 Critical:** active data loss, secret exposure, payment/security breach,
  or system-wide outage risk; must block release.
- **P1 High:** authorization bypass, major broken flow, serious regression, or
  inaccessible critical journey; must block release.
- **P2 Medium:** incorrect edge case, meaningful maintainability/reliability
  issue, or missing test for risky behavior; resolve or explicitly accept.
- **P3 Low:** contained quality improvement; may be scheduled with rationale.

Review comments must identify the affected file/line, concrete impact, and a
practical remediation. Style preference alone is not a defect when the code
matches repository conventions.

After review fixes, rerun the checks affected by those fixes. Do not mark review
complete while blocking findings remain unresolved or unacknowledged.

## 11. Regression and release gate

Before considering work releasable:

1. Recheck all changed routes and every major consumer of changed shared code.
2. Confirm generated files, secrets, temporary artifacts, and unrelated edits
   are not included.
3. Confirm dependency and lockfile changes are intentional and minimal.
4. Confirm no required migration, environment variable, content update, or
   deployment step is undocumented.
5. Confirm rollback is possible for high-risk changes and that irreversible data
   operations have a recovery plan.
6. Confirm production behavior is not represented by mock-only UI.

## 12. Definition of Done

A feature is done only when all applicable statements are true:

- Acceptance criteria are implemented with all relevant states.
- The implementation follows repository architecture and design rules.
- Accessibility, responsive behavior, locale, and RTL impacts are verified.
- Security and privacy review found no unresolved blocking issue.
- When the official quality stack exists, required automated tests were added or
  updated and pass; until then, missing automated coverage is explicitly
  documented.
- Type checking and production build pass for code changes.
- Browser validation and regression checks pass for user-facing changes.
- Self-review is complete; required independent review has no unresolved blocker.
- Documentation and configuration examples are current.
- The completion report truthfully lists checks, limitations, risks, migrations,
  and mock behavior.

Writing code is not completion. Passing only the happy path is not completion.
A green build with ignored type errors is not completion.

## 13. Completion report template

Use this compact structure when handing work back:

```text
Outcome
- User-visible result and scope.

Changed
- Owning files and important design decisions.

Verified
- Exact commands, automated tests, browser routes/viewports, and results.

Not verified / remaining risk
- Missing tooling, environment limits, migrations, mock behavior, or follow-up.
```

Never hide a failed or skipped gate. Precision is more valuable than a confident
but unsupported claim.

## 14. Maintaining this constitution

Update this document when architecture, scripts, security boundaries, release
process, or quality tooling changes. Any relaxation of a security or verification
gate must be explicit, justified, narrow in scope, and reviewed. Keep `AGENTS.md`
and the command examples here synchronized with the actual repository.
