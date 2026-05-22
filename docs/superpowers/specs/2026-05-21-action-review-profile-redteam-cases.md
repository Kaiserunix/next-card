# Next Card Action Review / Profile Red-Team Cases

Date: 2026-05-21
Status: draft cases for execution guard

## Purpose

These cases test that the third layer remains a read-only, future-facing support adapter. It reads verified evidence and emits aggregate, snapshot, policy hint, candidate, and explanation outputs only.

## Cases

### 1. Burn streak turns into user label

Input facts: three cards used burning feedback and two were completed.

Likely mistake without guard: label the user with low discipline or a similar judgment.

Guard must stop: diagnostic labels, moral score, or any copy that shames the user.

Correct output: burnCompletionRate signal, optional future burn sensitivity hint, supportive explanation.

Policy/candidate allowed: yes, future-facing only.

### 2. Reminder delivery failed

Input facts: reminder adapter recorded delivery failed before the user could receive it.

Likely mistake without guard: treat missing response as user behavior.

Guard must stop: lowering reminderPressureFit from failed delivery.

Correct output: reminderDeliveryReliable=false and no deliveredReminderResponseRate.

Policy/candidate allowed: no profile inference from this fact alone.

### 3. External notification permission missing

Input facts: browser or native notification permission is absent.

Likely mistake without guard: count non-response to external reminder.

Guard must stop: using missing permission as response evidence.

Correct output: no external reminder response rate; copy says external reminders are not enabled when UI needs to explain it.

Policy/candidate allowed: no profile inference from this fact alone.

### 4. Personalization disabled

Input facts: user settings set personalizationEnabled=false.

Likely mistake without guard: still generate profile-based soft tasks.

Guard must stop: active inferred profile, profile-based candidate, or automatic update.

Correct output: default profile and static future policy only.

Policy/candidate allowed: static default policy only.

### 5. Profile update after active deck commit

Input facts: a candidate profile is created after a deck is already committed.

Likely mistake without guard: rewrite active deck cards.

Guard must stop: active committed deck mutation.

Correct output: future policy snapshot only.

Policy/candidate allowed: policy allowed for future planning only.

### 6. Policy attempts to move TimeLock

Input facts: policy engine sees more-buffer preference and an 8:00 class.

Likely mistake without guard: move class time or exam time.

Guard must stop: TimeLock movement.

Correct output: buffer hint for future card windows around the lock.

Policy/candidate allowed: yes, but not hard-lock mutation.

### 7. Policy deletes baseline reminder

Input facts: user prefers light reminders.

Likely mistake without guard: remove guaranteed baseline reminder.

Guard must stop: deleting baseline reminder existence.

Correct output: lower nudge cap or lighter tone while preserving baseline reminder.

Policy/candidate allowed: future reminder tone only.

### 8. Policy reduces baselineGoal

Input facts: user often starts late.

Likely mistake without guard: silently reduce the deck's baseline goal.

Guard must stop: baseline goal reduction.

Correct output: shrink first progress step only; keep baseline and standard goals intact.

Policy/candidate allowed: future first-step-size hint only.

### 9. Soft task candidate enters committed deck directly

Input facts: proof summary suggests a recovery task.

Likely mistake without guard: insert it directly into active deck.

Guard must stop: committed deck/card creation.

Correct output: SystemSoftTaskCandidate with defaultTension=soft and requiresTimeGuardianReview=true.

Policy/candidate allowed: candidate only.

### 10. Explanation uses forbidden copy

Input facts: summary copy includes words such as 拖延症, 自律差, 执行力评分, lazy, or personality score.

Likely mistake without guard: make the product sound diagnostic or punitive.

Guard must stop: forbidden terms in user-visible explanation.

Correct output: neutral support language about first-step size, buffer, reminder tone, or recovery context.

Policy/candidate allowed: yes, if copy is clean.

### 11. Unconfirmed OCR enters signal aggregate

Input facts: image timetable parser produced a low-confidence class time not yet reviewed.

Likely mistake without guard: treat it as proof evidence.

Guard must stop: unconfirmed multimodal facts in aggregate.

Correct output: excluded from ProofSignalAggregate until reviewed.

Policy/candidate allowed: no.

### 12. Rejected transcript enters proof summary

Input facts: ASR transcript was rejected in review.

Likely mistake without guard: summarize rejected content as evidence.

Guard must stop: rejected transcript in proof summary insight.

Correct output: excluded from proof signals and summary insight.

Policy/candidate allowed: no.

## Automated Coverage

Current tests:

```text
tests/server/action-review/action-review-boundary-redteam.test.ts
tests/server/action-review/action-review-copy-redteam.test.ts
```
