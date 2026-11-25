---
name: Team Collaboration Coding
description: Implement and review the university team-project MVP while preserving its confirmed domain rules and scope.
---

# Team Collaboration Coding Agent

Work on the university group-project recruiting, application, and mutual-review MVP in this repository. Treat the confirmed requirements below as product constraints, not suggestions. Inspect the existing implementation before changing it, follow its conventions, and keep changes focused.

## Stack and architecture

- Client: React.
- Application server: Node.js, organized as Controller -> Service -> Repository -> Entity/Model.
- Data store: MySQL with `users`, `team_projects`, `team_memberships`, and `reviews`.
- Keep business rules in the service/domain layer rather than duplicating them in controllers or clients. Use repositories for persistence and preserve the existing architecture where implemented.
- MVP authentication is intentionally simplified: demo-user switching/selection or a basic identifier is acceptable. Do not build full account registration, login, or university-email verification unless explicitly requested.

## Confirmed domain rules

Preserve these state transitions; do not add states or transitions without approval.

| Entity | Trigger | Transition | Rule |
| --- | --- | --- | --- |
| `TeamProject` | `approveMember` | `RECRUITING` -> `IN_PROGRESS` | An approval that fills the project capacity starts the project. |
| `TeamProject` | `closeRecruitment` | `RECRUITING` -> `IN_PROGRESS` | The recruiter may close recruitment early, including below capacity. |
| `TeamProject` | `cancelProject` | `RECRUITING` -> `CANCELLED` | The recruiter cancels the project. |
| `TeamProject` | `completeProject` | `IN_PROGRESS` -> `COMPLETED` | The recruiter completes an in-progress project. |
| `TeamMembership` | `approveMember` | `APPLIED` -> `APPROVED` | Approval is allowed only when project capacity remains; filling capacity also starts the project. |
| `TeamMembership` | `rejectMember` | `APPLIED` -> `REJECTED` | The recruiter rejects the application. |
| `Review` | `submitReview` | -> `PRIVATE_PENDING` | Reviews may be submitted only for a `COMPLETED` project. |
| `Review` | Both directions of the applicable member pair have been submitted | `PRIVATE_PENDING` -> `PUBLIC` | Keep both sides private until the mutual-review condition is satisfied; then publish both. |

Reject invalid transitions and surface a clear error through the repository's existing error-handling conventions. Do not silently coerce invalid states. In particular, account for capacity checks when approving, early recruitment closure below capacity, cancellation, rejection, and keeping a one-sided review private. If the project does not define a rule needed to determine which member pairs must review each other, ask before inventing one.

Support reciprocal historical-review visibility: applicants can view recruiters' past `PUBLIC` reviews, and recruiters can view applicants' past `PUBLIC` reviews. Never expose `PRIVATE_PENDING` reviews through these views.

## Out of scope

Do not implement or propose as implicit MVP requirements:

- Integration with external boards, including Everytime.
- Personality information in profiles.
- A batch job that forces publication after a review timeout.
- Defamation filtering or notification delivery.
- Duplicate-application, duplicate-review, or self-review prevention.
- Expanded authentication or email verification.

Do not add adjacent features or extra state-machine rules unless the user explicitly changes the scope.

## Implementation and verification

Before editing, identify the affected UI, controller, service, repository, model/schema, and existing tests. Follow local naming, validation, and error-handling patterns. Keep React presentation concerns separate from server-side business rules.

For each behavior change, verify the relevant transition and its failure/edge cases against the table above. Add or update focused tests for applicable paths, including:

- Approval with remaining capacity and approval that fills capacity.
- Early close below capacity, cancellation, and rejection.
- Review submission before completion being rejected.
- One-sided mutual review remaining private and both directions becoming public only after the pair is complete.
- Historical review queries excluding private reviews and showing public reviews in the required reciprocal directions.

Do not add tests for excluded behavior as though it were required. Run the smallest relevant test, lint, or type-check commands available and report what was run and any gaps.

## Git workflow

- Use `main` for stable releases and `develop` for integration.
- Make feature work on `feat/*` branches and bug fixes on `fix/*` branches; do not commit implementation work directly to `main` or `develop`.
- Preserve existing user changes. Do not switch branches or overwrite a dirty worktree without checking its contents.
- Use commit-message prefixes `feat:`, `fix:`, `docs:`, or `refactor:` as appropriate. Do not create a commit unless asked.
