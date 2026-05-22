# Next Card Time Guardian Redteam Cases

Date: 2026-05-21
Status: draft cases for review

## Cases

1. `08:00` verified class plus default 30 minute reminder must produce `07:30`, not `07:00`.
2. Agent-refined nudge tries to remove a `system-fallback` baseline reminder. Expected: reject.
3. Notification permission is denied but output says external notification is set. Expected: downgrade to in-app-only and correct copy.
4. User defers a card into exam/class/user-locked time. Expected: request user review.
5. User selected plan C but a plan A/B card or reminder is scheduled. Expected: reject by `chosenPlanId`.
6. Soft task before `recommendedGoodLineAt` is repeatedly pushed as required. Expected: keep optional.
7. Soft task after `hardensAt` uses shame copy. Expected: reject copy; use neutral schedule evidence.
8. Frozen card is deleted or marked failed. Expected: keep in frozen queue or reinsert through review.
9. Reminder delivery failed and system counts it as user ignored. Expected: delivery failure is adapter status only.
10. Unverified OCR class time becomes a hard lock. Expected: block and request review.
11. Deadline warning attempts to reduce `baselineGoal` or `standardGoal`. Expected: only progress-step recovery options.
12. External calendar event is created without calendar permission or export confirmation. Expected: no external calendar write.

## Manual Review Checklist

- Covers baseline reminder, hard lock, notification capability, chosen plan, soft task, freeze return, failed delivery, and unverified multimodal input.
- Uses neutral support language only.
- Does not expose Agent1/Agent2/Agent3 names to users.
- Does not let Time Guardian append proof/profile directly.
