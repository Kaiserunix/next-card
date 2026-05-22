# Draft Skill: nextcard-action-review-profile-guard

This is a draft only. Do not install it as a local Codex skill from this file.

## Skill Header Draft

```yaml
---
name: nextcard-action-review-profile-guard
description: Use when implementing or reviewing Next Card action review, proof signal aggregation, profile snapshots, policy hints, soft-task candidates, personalization governance, or profile-related explanation copy
---
```

## Guard Rules

1. The third layer may read only verified proof/runtime facts.
2. The third layer may output only aggregate, snapshot, policy hint, candidate, or explanation records.
3. The third layer must not write deck, card, reminder, proof, deadline, hard lock, or Time Guardian queue state.
4. Profile is a behavior-support model, not a psychological diagnosis.
5. Proof is visible evidence for the user, not a moral score.
6. Failed reminder delivery is not user behavior.
7. Missing notification permission means reminder response data is unreliable.
8. System soft tasks must be soft candidates.
9. System soft tasks must go through Time Guardian review.
10. Automatic profile updates are off by default.
11. Personalization must be disableable and resettable.
12. User-facing copy must not use labels such as 懒, 自律差, 拖延症, 执行力评分, 人格画像, low discipline, lazy, or personality score.

## Implementation Checklist

- Read `AGENTS.md`.
- Read `docs/superpowers/specs/2026-05-21-action-review-profile-adaptation-plan.md`.
- Read `docs/superpowers/specs/2026-05-21-action-review-profile-contract.md`.
- Confirm the code changes stay inside `lib/server/action-review`, third-layer tests, or third-layer docs unless the user explicitly expands scope.
- Write failing tests before implementation.
- Check forbidden output keys.
- Check forbidden user-facing copy.
- Run targeted tests and typecheck.

## Safe Output Shapes

Allowed:

```text
ProofSignalAggregate
ProfileSnapshot
AgentPolicySnapshot
SystemSoftTaskCandidate
ProfileExplanation
ProofSummaryInsight
ProfileGovernanceSettings
```

Forbidden:

```text
committed deck mutation
card mutation
reminder job mutation
proof append
deadline mutation
hard lock mutation
TimeLock move
baseline goal reduction
standard goal reduction
external report
diagnostic user label
```

## Red-Team Prompt

Before finishing, ask:

```text
Could this change directly mutate committed state?
Could this copy be read as diagnosis, judgment, or shame?
Could failed delivery or missing permission be mistaken for user response?
Could a soft task bypass Time Guardian review?
Could this affect an active deck instead of future planning only?
```

If any answer is yes, stop and refactor before claiming completion.
