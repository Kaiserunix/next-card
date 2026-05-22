# Next Card PM Question And Decision Log

Date: 2026-05-21
Status: active question log for post-compaction continuation

## Context

The project has been reset into a design-first state.

- Root workspace: `C:\Users\qwerf\Desktop\nextcard`
- Old implementation archive: `废弃文件夹\旧实现-20260520-225958`
- Teammate frontend checkout: `external\next-card-119`
- Main product contract remains in `AGENTS.md`, `README.md`, and `docs/`
- Voice backend draft spec: `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`

The user wants the old design to be called back and redesigned, not blindly replaced by the teammate frontend.

## PM Baseline From Subagent

The PM subagent identified the first critical decision:

```text
Should the new baseline follow explicit old Plan Mode,
or accept the teammate frontend's direct "one card now" flow?
```

Decision:

```text
A. Explicit Plan Mode is the main experience.
```

Meaning:

- User input must not directly create task cards.
- The flow is still understanding -> constraints/decomposition -> A/B/C plans -> selected plan -> deck.
- The teammate frontend's "only one card" feeling can inspire the opening experience, but it cannot replace Plan Mode.

## Product Decisions Already Made

### 1. Main Experience

Question:

```text
Choose A/B/C:
A. Old explicit Plan Mode
B. Teammate frontend direct one-card start
C. Hybrid
```

Decision:

```text
A. Old explicit Plan Mode.
```

### 2. Voice Provider Direction

Question:

```text
Can we drive system input-method voice recognition directly?
Should we use domestic low-cost ASR?
Does MiMo have ASR?
```

Decision summary:

- Do not promise direct control of the system input-method microphone button in Web.
- Web can use in-page microphone or manual dictation text.
- Android native wrapper can later use `SpeechRecognizer` / `RecognizerIntent` or native recording with WebView bridge.
- Experience version should use Volcengine ASR.
- Aliyun and Tencent ASR positions must be reserved.
- MiMo ASR is not a default hosted provider until stable public ASR API is confirmed.

### 3. Transcript Review

Question:

```text
After speech recognition, should the user confirm the transcript before A/B/C?
```

Decision:

```text
B. Auto-ish flow with correction, expressed as card gestures.
```

Gesture rule:

```text
recognized text appears on card
right swipe -> confirm and continue
left swipe -> reject this input and return to re-speak/re-enter
```

### 4. Transcript Normalization

Question:

```text
Should raw transcript be normalized before Plan Mode?
A. Full normalization
B. No normalization
C. Light normalization
```

Decision:

```text
C. Light normalization.
```

Rules:

- remove obvious filler words
- add simple punctuation
- fix high-confidence ASR artifacts
- preserve original intent
- do not infer hidden deadlines
- do not generate cards

### 5. ASR Mode

Question:

```text
Volcengine ASR should use batch upload or streaming?
A. Batch short-audio upload
B. Streaming
C. Batch first, streaming reserved
```

Decision:

```text
C. MVP batch short-audio upload, streaming reserved.
```

### 6. Platform Priority

Question:

```text
Launch first on Web, Android WebView, or both-compatible?
A. Web first
B. Android bridge first
C. Backend compatible, Web experience first, Android bridge next
```

Decision:

```text
C. Backend compatible, Web experience first, Android bridge next.
```

### 7. Plan Gate After Transcript Confirmation

Question:

```text
After transcript confirmation, should A/B/C be generated directly?
A. Always direct
B. Always show understanding card first
C. Gate by confidence
```

Decision:

```text
C. Gate by confidence.
```

Rule:

```text
high confidence -> direct Plan Mode A/B/C
low confidence -> show AI understanding card first
```

### 8. History And Proof Recording

Question:

```text
What voice information should be saved?
A. Full voice process
B. Only confirmed transcript
C. Only final goal text
```

Decision:

```text
B. Save only confirmed transcript, not rejected transcript or raw audio.
```

### 9. Quota

Question:

```text
Should the experience version have ASR quota?
A. Yes
B. No
C. Only clip length limit
```

Decision:

```text
A. Yes.
```

### 10. Quota Identity

Question:

```text
Quota should be by local device, user account, or migration path?
A. Device
B. User
C. Device first, user later
```

Decision:

```text
C. Device first, user later.
```

Rule:

```text
MVP uses anonymousDeviceId.
Future account system uses userId first and device fallback.
```

### 11. Exact Experience Quota

Question:

```text
For the experience version quota, should we use:
A. 30 seconds per clip, 30 clips/day, 10 total minutes/day per anonymous device
B. 60 seconds per clip, 50 clips/day, 30 total minutes/day per anonymous device
C. 15 seconds per clip, 10 clips/day, 3 total minutes/day per anonymous device
```

Decision:

```text
A. Use the light default:
- max single clip: 30 seconds
- daily clip count: 30 clips per anonymous device
- daily total duration: 10 minutes per anonymous device
```

### 12. Voice Usage Storage

Question:

```text
Where should voice usage records live in the first backend slice?
A. Memory only
B. Local JSON file
C. UsageRepository interface with local JSON implementation
```

Decision:

```text
C. Use a VoiceUsageRepository interface.
First implementation uses local JSON storage.
Future implementation can swap to database storage without changing API routes.
```

### 13. Volcengine Credential Env Shape

Question:

```text
Should the experience version use the newer Volcengine console path:
VOLCENGINE_ASR_API_KEY + VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo,
with old AppKey/AccessKey or AK/SK/AppKey token auth only as compatibility fallback?
```

Decision:

```text
Yes. Use the newer X-Api-Key route as the experience-version baseline.
Old Volcengine credential routes are kept only as fallback/compatibility paths.
```

### 14. Manual Dictation Classification

Question:

```text
Should system input-method dictation be treated as voice input or ordinary text?
A. Voice input
B. Ordinary text
C. Voice-like product flow, but proof/cost source is manual-dictation
```

Decision:

```text
C. Treat it as voice-like in the user flow.
Mark proof/source as manual-dictation.
Do not count it against Volcengine ASR usage or cost quota.
```

### 15. Low-Confidence Understanding Card Content

Question:

```text
What should the low-confidence confirmation card show?
A. Recognized text only
B. Recognized text + AI understanding + missing-information chips
C. Return to input immediately
```

Decision:

```text
B. Show recognized text, AI understanding, and missing-information chips.
Right swipe confirms and continues into Plan Mode.
Left swipe rejects and returns to re-speak or re-enter.
```

### 16. Low-Confidence Interaction Fallback

Question:

```text
Should low-confidence confirmation include visible button fallback in addition to swipe?
A. Swipe only
B. Swipe-first plus small visible buttons
C. Button-first plus swipe shortcut
```

Decision:

```text
B. Swipe remains primary, but show small buttons such as 确认理解 / 重新说.
This state should become a Plan Mode-like lightweight clarification card.
Prefer chips, taps, and buttons over asking the user to speak again.
```

### 17. Plan Mode Strictness After Ambiguous Voice Input

Question:

```text
How strict should Plan Mode be about A/B/C when voice input is still ambiguous after confirmation?
A. Always generate three plans
B. Show a missing-information confirmation card first, then generate A/B/C
C. Allow fewer than three plans
```

Decision:

```text
B. Do not force three plans from ambiguous voice input.
Show a missing-information confirmation card first.
Let the user resolve ambiguity with lightweight chips/buttons, then generate the explicit A/B/C options.
```

### 18. Deployment Shape

Question:

```text
Should the first implementation assume:
A. Backend-capable Next server
B. Static export + remote API
C. Local Next server + static production export with remote API
```

Decision:

```text
A. Use a backend-capable Next server as the first implementation baseline.
Core routes live under app/api/backend/*.
Static export is not the primary backend shape for this slice.
```

### 19. Burning Semantics

Question:

```text
A. Burning is pressure feedback only; no failure and no hard lock.
B. Burning can fail or lock the deck.
C. Frontend avoids failure; proof records needs-review.
```

Decision:

```text
A. Burning is only pressure feedback.
It must not fail or hard-lock the deck.
```

### 20. Deck Gesture Baseline

Question:

```text
A. Old rule: left/right complete, down status bar, deeper down freeze.
B. New frontend rule: left complete, right freeze, up burn, down catalog.
C. Mixed rule.
```

Decision:

```text
A. Use the old gesture baseline for the formal deck.
Voice confirmation can still use left reject / right continue where already decided.
```

### 21. Proof First Screen

Question:

```text
A. Old complete evidence system: colored table + charts + journal + summary.
B. New frontend project aggregation cards.
C. Hybrid: project cards first, evidence after click.
```

Decision:

```text
A. Use the old complete proof evidence system.
The proof surface must keep colored table, charts, blog-style journal, and readable summary.
```

### 22. First Backend Scope

Question:

```text
A. Voice ASR + quota + transcript/normalization/readiness only.
B. Also connect Plan Mode API using mock/local planner.
C. ASR + Plan Mode + deck/proof write-in.
```

Decision:

```text
A. First backend slice only covers voice ASR, quota, transcript contract, normalization, and readiness.
Plan Mode/deck/proof write-in stays out of this implementation slice.
```

### 23. State Authority

Question:

```text
A. localStorage remains frontend fallback; backend records only voice usage and transcript metadata.
B. Backend JSON also owns decks/proof.
C. Prepare database-style repository for all state.
```

Decision:

```text
A. localStorage remains the deck/proof persistence baseline and offline fallback.
Backend local JSON is only for voice usage records and confirmed transcript metadata in this slice.
```

### 24. Aliyun And Tencent Slots

Question:

```text
A. Keep only provider types and adapter slots.
B. Add empty adapters and env examples.
C. Build full provider registry with Volcengine.
```

Decision:

```text
A. Keep only provider types and adapter slots for Aliyun/Tencent.
Do not implement Aliyun/Tencent clients in the first slice.
```

### 25. Opening Feeling

Question:

```text
Opening feeling:
A. I am planning
B. I am starting action
C. I speak lightly, then the app plans
```

Decision:

```text
C. The first feeling should be "I speak lightly, then the app plans."
This preserves the low-friction voice/card opening while keeping explicit Plan Mode.
```

### 26. "Only One Card" Copy Role

Question:

```text
"只做一张卡" role:
A. Core slogan
B. Low-pressure input-page copy
C. Remove from core product language
```

Decision:

```text
B. "只做一张卡" can remain as low-pressure input-page copy.
It must not replace the explicit Plan Mode contract.
```

### 27. First Redesign Target User

Question:

```text
Target user for first redesign:
A. Student course/assignment first
B. General personal tasks first
C. Student first, general compatible
```

Decision:

```text
C. Student first, general compatible.
Course, assignment, timetable, and early-class scenarios stay the clearest demo lane.
```

### 28. Deck Inner Catalog

Question:

```text
Deck inner catalog:
A. No catalog inside active deck
B. Catalog exists only as drawer/status layer
C. Catalog can be a visible deck subpage
```

Decision:

```text
B. The catalog can exist only as a drawer/status layer.
The active deck surface still focuses on one action card at a time.
```

### 29. Card Detail Surface

Question:

```text
Card detail surface:
A. Expand inside the main card
B. Open overlay
C. Expand first, overlay for long detail
```

Decision:

```text
C. Short detail expands inside the main card.
Long detail can open an overlay.
```

### 30. Proof Entry Emphasis

Question:

```text
Proof entry emphasis:
A. Full proof dashboard first
B. "Today's evidence" as top entrance inside proof
C. Project cards first, evidence after click
```

Decision:

```text
B. Use "今日证据" as the top entrance inside proof.
It should lead into the full table, charts, journal, and summary evidence system.
```

### 31. Summary Document Action

Question:

```text
Summary document action:
A. Read-only summary
B. Copyable summary
C. Exportable/downloadable summary
```

Decision:

```text
B. Summary document should be copyable.
Download/export can remain future work.
```

### 32. Large Import Review Strictness

Question:

```text
Large import review strictness:
A. Always review before deck
B. Only review large/multimodal imports before deck
C. Direct deck generation allowed after parse
```

Decision:

```text
B. Only large or multimodal imports require a review gate before deck creation.
Small voice/text input should stay lightweight.
```

## Frontend Inspiration From `external/next-card-119`

Useful to preserve or reinterpret:

- Mobile WebView frame and compact mode switching are good references for the final frontend.
- The input composer has the right low-friction direction; "只做一张卡" should become soft input copy, not product doctrine.
- The proof page's "今日证据" entrance matches the new decision, but must connect to the old full evidence system.
- The card detail pattern can inspire the new short-expand plus long-overlay rule.
- The catalog drawer is useful, but it must remain a secondary/status layer instead of replacing one-card execution.

Must be corrected against old contract:

- Input cannot directly default into `方案一`; it must preserve analysis and explicit A/B/C choice.
- Burning cannot lock or fail the deck.
- Proof should not treat burn as failure; it should record pressure feedback and `needs-review` only when appropriate.
- README/static-export assumptions must be updated when backend-capable Next server work begins.

## PM Question Bank

This question bank is for main-thread product realignment. It should be used to ask only the smallest useful set of questions at a time, instead of flooding the user.

### First Question To Ask First

```text
Next Card 的新基线到底是：
A. 旧契约的 Codex Plan Mode 三方案体验
B. 外部新前端的“输入即生成，只做一张卡”体验
```

Why this comes first:

- It decides whether Next Card is primarily a planning decision tool or an action starter.
- It affects Plan Mode, deck entry, proof semantics, backend ownership, and what should be kept from `external/next-card-119`.
- This question has already been answered once in this log as `A. Old explicit Plan Mode`; keep it as the anchor unless the user explicitly reopens the decision.

### A. Product Positioning

1. Next Card 更像“计划决策工具”，还是“行动启动工具”？
2. 用户打开 app 的第一感受应该是“我来规划”，还是“我马上开始”？
3. “只做一张卡”是核心 slogan，还是只是 input 页的低压文案？
4. 产品要不要避免任何“失败/惩罚”语言？
5. 目标用户更偏学生课程/作业，还是泛用个人任务？

### B. Plan Mode / AI

1. 是否必须保留显式分析状态？
2. 是否必须先展示三方案，再允许生成 deck？
3. `执行方案一` / `执行方案二` / `执行方案三` / `否，重新生成` 是否仍是硬要求？
4. 默认选方案一能不能接受？
5. AI 输出更重“理解与策略”，还是更重“直接给下一步卡片”？

### C. Deck / Card Execution

1. deck 是否必须先有封面/卡包感，再进入单卡？
2. active deck 是否绝对不能出现 Todo list 形态？
3. 是否接受任务目录作为 deck 内抽屉，而不是主流程？
4. `去高数课` 是否继续作为核心 demo case？
5. 每张卡是否必须显示 parent goal、序号、flow node？
6. 卡片详情应在主卡展开，还是 overlay 展开？

### D. Time / Burning / Freeze

1. Burning 是压力提醒，还是可以变成失败状态？
2. Triple click 是否允许直接锁定/失败？
3. 冻结是冻结当前卡，还是冻结整副 deck？
4. 冻结后必须问 `继续完成 / 先冻结` 吗？
5. 下滑应该显示状态栏，还是打开任务目录？
6. 时间 UI 必须直接写出 `剩 X min / hot / burning` 吗？

### E. Proof

1. Proof 首屏要表格+journal，还是项目聚合卡？
2. “今日证据”是否可以作为 proof 的核心入口？
3. 燃烧失败是否应该进入 proof，还是只记录为 `needs-review`？
4. Flow journal 是否必须是一等视图？
5. Summary document 是否需要可复制/导出？

### F. Backend Boundary

1. 当前基线是 Next server backend，还是 static WebView export？
2. Mimo / backend provider 是否已经进入当前产品范围？
3. 大导入是否必须先 review gate？
4. hard time lock 是否必须作为 PM 级规则保留？
5. localStorage 是演示 fallback，还是当前唯一权威状态？

### First Round Main-Thread Questions

Use these five when the main thread needs a compact product reset:

1. 先问：产品基线选 Plan Mode 三方案，还是“只做一张卡”？
2. Burning 是否允许失败/锁定，还是只能做温和压力反馈？
3. 当前交付形态选 backend-capable Next server，还是 static WebView export？
4. deck 手势以旧规则还是新规则为准？
5. Proof 首屏以完整证据系统为准，还是以新前端项目聚合卡为准？

## PM Questions Still Pending

No PM questions are blocking the voice-backend implementation plan.

## Current Recommended Next Question

Ask next:

```text
Start executing the voice-backend implementation plan, or import/reconcile the teammate frontend first?
```

Reason:

The remaining PM-bank answers have been recorded. The next sequencing choice is whether backend execution starts before or after frontend import/reconciliation.

## Previously Unasked PM-Bank Items

These have now been answered in decisions 25-32.

Already covered by hard contract or earlier decisions:

- Explicit Plan Mode is the baseline.
- Three options remain required after understanding is ready.
- Burning is pressure feedback only.
- Formal deck uses old gesture baseline.
- Proof uses the complete evidence system.
- Backend first slice is voice-only.
- `localStorage` remains deck/proof persistence baseline for this slice.
- Hard time locks remain a PM-level rule from `AGENTS.md`.
- Large imports should still pass review/coverage before deck creation, per existing backend contract.

Answered batch:

```text
1. Opening feeling:
A. "I am planning"
B. "I am starting action"
C. "I speak lightly, then the app plans" -> selected

2. "只做一张卡" role:
A. Core slogan
B. Low-pressure input-page copy -> selected
C. Remove from core product language

3. Target user for first redesign:
A. Student course/assignment first
B. General personal tasks first
C. Student first, general compatible -> selected

4. Deck inner catalog:
A. No catalog inside active deck
B. Catalog exists only as drawer/status layer -> selected
C. Catalog can be a visible deck subpage

5. Card detail surface:
A. Expand inside the main card
B. Open overlay
C. Expand first, overlay for long detail -> selected

6. Proof entry emphasis:
A. Full proof dashboard first
B. "Today's evidence" as top entrance inside proof -> selected
C. Project cards first, evidence after click

7. Summary document action:
A. Read-only summary
B. Copyable summary -> selected
C. Exportable/downloadable summary

8. Large import review strictness:
A. Always review before deck
B. Only review large/multimodal imports before deck -> selected
C. Direct deck generation allowed after parse
```

## Next Planning Focus

Question:

```text
Which planning pass should come next?
A. Voice opening UI choreography
B. Teammate frontend reconciliation
C. Post-voice Plan Mode backend
```

Decision:

```text
A. Voice opening UI choreography.
Focus next on card emergence, logo timing, permission moment, speech capture start, transcript card, and low-confidence correction flow.
```

### Voice Opening 1. Speech Capture Start

Question:

```text
How should speech recognition start?
A. User taps once to grant/start, then the card appears and listening starts automatically
B. Card appears, then user taps a mic button
C. Fully automatic listening
```

Decision:

```text
A. Use one user tap as the permission/start gesture.
After that tap, the card can appear and listening can begin automatically.
This keeps the flow light while respecting browser permission and privacy expectations.
```

### Voice Opening 2. Start Affordance Location

Question:

```text
Where should the one-tap permission/start affordance live?
A. In the center of the main card
B. In a microphone button beside the composer
C. Both card and mic button
```

Decision:

```text
A. Put the start affordance in the center of the main card.
Tapping the card itself starts the opening ritual and speech capture.
Do not make the first moment feel like a generic toolbar mic action.
```

### Voice Opening 3. Pre-Tap Card Copy

Question:

```text
What should the main card show before the user taps to start?
A. Logo + low-pressure hint
B. Blank breathing card + logo only
C. Traditional input/microphone instruction
```

Decision:

```text
A. Show the logo plus one randomized low-pressure hint.
Rotate these four hints:
- 写一句话，帮你拆成卡片
- 说句话，自动生成卡片
- 随便说点什么，我来帮你变成卡片
- 输入一个想法，拆成卡片
```

### Voice Opening 4. First-Second Card Motion

Question:

```text
What should happen visually immediately after the user taps the main card?
A. Card floats/scales slightly, logo flashes, then enters listening
B. Card flips to a listening back face
C. Card expands into an input panel
B-lite. Card floats, logo flashes, then flips into listening
```

Decision:

```text
B-lite. The card first floats/scales slightly and the logo flashes, then the card flips into the listening face.
This keeps the stable feel of A while adding the card ritual of B.
Implementation can use Framer Motion plus CSS 3D transform; include reduced-motion fallback.
```

### Voice Opening 5. Listening Face Content

Question:

```text
What should the flipped listening face show?
A. Minimal visual state: small logo plus waveform/breathing line
B. Real-time transcript text
C. Timer and cancel button only
```

Decision:

```text
A. Use a minimal visual listening state.
Do not show text such as "正在听...".
Use a small mark, waveform, breathing line, or subtle listening animation to communicate state.
```

### Voice Opening 6. Recording Finish Gesture

Question:

```text
How should the user finish recording?
A. Auto-stop by silence or 30-second limit
B. Tap the card again to finish
C. Both tap-to-finish and automatic fallback
```

Decision:

```text
B. Tap the card again to finish recording.
The voice opening rhythm is: tap card to start, tap card to finish.
Automatic 30-second hard limit still exists as a backend quota rule, but the primary product gesture is explicit card tap.
```

### Voice Opening 7. Transcript Reveal

Question:

```text
How should transcript text appear after recording finishes?
A. Listening face directly becomes transcript card
B. Card flips back to the front and shows transcript text
C. A new transcript card stacks in from below
```

Decision:

```text
B. The card flips back to the front and shows the transcript text.
The opening loop becomes: front hint -> back listening -> front transcript.
```

### Voice Opening 8. Transcript Card Actions

Question:

```text
What actions should the transcript card show?
A. Gesture only: right swipe continues, left swipe re-speak
B. Gesture plus small buttons
C. Buttons only
```

Decision:

```text
A. Use gesture-only transcript actions.
Right swipe continues.
Left swipe rejects and returns to re-speak.
Do not show visible continue/re-speak buttons on the normal transcript card.
```

### Voice Opening 9. High-Confidence Transition To Plan Mode

Question:

```text
After right-swiping a high-confidence transcript, should there be a transition card before Plan Mode options?
A. Directly enter analysis state and then A/B/C
B. Show a short "I understand this as..." card
C. Require user confirmation of "I understand this as..."
```

Decision:

```text
B. Show a short "I understand this as..." card, but treat it as a standby/loading page.
It is not an extra confirmation step.
It waits while backend AI generates the explicit A/B/C Plan Mode options.
```

### Voice Opening 10. Low-Confidence Correction Card Visual

Question:

```text
What should low-confidence correction look like visually?
A. Same transcript card morphs into correction card
B. A new correction card stacks above it
C. Return to the start and re-speak
```

Decision:

```text
A. The same transcript card morphs into the correction card.
It shows recognized text, AI understanding, and missing-information chips.
Prefer taps/chips over asking the user to speak again.
```

### Voice Opening 11. Correction Chip Types

Question:

```text
Which chip types should correction support first?
A. Missing-type chips only: specific task, time, priority
B. Missing-type chips plus suggested value chips
C. Full editable form
```

Decision:

```text
B. Support missing-type chips plus suggested value chips.
Examples: 具体任务, 时间, 先做哪个, 今晚前, 明早课前, 作业, 课程, 提醒.
The user should usually fix ambiguity by tapping chips, not by speaking again.
Swipe gestures remain for confirmation or rejection of the correction card.
```

### Voice Opening 12. Correction Loop

Question:

```text
After the user taps correction chips, how should the flow continue?
A. User right-swipes to confirm, left-swipes to reject
B. Auto-continue directly to A/B/C
C. Send chip selection back to AI for another readiness check until semantic elements are sufficient
```

Decision:

```text
C. After chip selection, immediately send the updated semantic state back to AI/readiness check.
If semantic elements are sufficient, continue to the "I understand this as..." standby/loading card and generate A/B/C.
If not sufficient, keep the same correction card and show the next round of chips.
The loop should reduce repeated speaking and rely on tapping lightweight choices.
```

### Voice Opening 13. Semantic Sufficiency Standard

Question:

```text
What counts as semantically sufficient before A/B/C generation?
A. Task object is enough; time can default
B. Task object + task type; time can default
C. Task object + task type + time/deadline/window
```

Decision:

```text
C. Require task object, task type, and time/deadline/window before entering A/B/C.
Reason: without these, the user may not trust the generated plan.
It is acceptable to ask for another lightweight chip round instead of guessing.
```

### Voice Opening 14. Missing Time Clarification Agent

Question:

```text
When time information is missing, should the product use fixed choices, ask the user to speak again, or let an internal software agent judge the next clarification?
```

Decision:

```text
Use the software's second-layer readiness/clarification agent to judge the next time clarification.
The correction card should show common time chips plus context-aware suggested time chips.
Examples: 现在, 今天内, 今晚前, 明早课前, 上课前 20 分钟, DDL 前 1 小时, 本周五前.
If none fits, provide a lightweight custom time control.
Do not force the user to repeat speech, and do not invent a default time silently.
After the user taps a time chip or custom time, send the updated semantic state back to readiness until task object, task type, and time/deadline/window are sufficient.
```

## Soft Task And Deck Library Follow-Up

### Soft Task 1. Tension Visibility

Question:

```text
How should soft-task tension levels be shown to the user?
A. Use explicit level names
B. Use color as the primary external signal
C. Hide tension from the user
```

Decision:

```text
B. Use color as the primary external signal.
Internal levels may remain hard / deadline-sensitive / recommended / soft / background for scheduling and tests.
The UI should not rely on technical level names as the main user-facing language.
```

### Soft Task 2. Good Line / Harden Line Visibility

Question:

```text
Should recommendedGoodLineAt / hardensAt be visible to the user?
A. Hidden, only reflected through reminders
B. Visible as raw schedule fields
C. Visible as formatted proof/deck-library timeline information
```

Decision:

```text
C. Format the good line and harden line into the proof-side timeline.
This is the deck-library representation discussed earlier.
Users can see the recommended action window, the point where the task becomes harder to defer, and why the task tension changed.
Do not expose raw technical field names as primary UI copy.
```

### Soft Task 3. Hardened Soft Task UI

Question:

```text
After a soft task crosses the harden line, what should happen?
A. Push it into deck execution, but do not interrupt with a popup
B. Keep it only in proof timeline
C. Pop a current card immediately
```

Decision:

```text
A. Push it into the deck execution flow, but do not interrupt with a popup.
The proof timeline should show why it became stronger, the color upgrade, and recommended execution time.
```

### Soft Task 4. Lifecycle Confirmation

Question:

```text
When Agent1 classifies fixed vs one-off tasks and keep-vs-clear lifecycle, does the user confirm every time?
A. High-confidence automatic; low-confidence/high-risk asks for confirmation
B. Confirm every time
C. Never ask
```

Decision:

```text
A. Use high-confidence automatic classification.
Ask for confirmation when confidence is low or the decision is high-risk.
High-risk includes fixed courses, recurring tasks, and completion-clearing decisions.
```

### Soft Task 5. Agent3 System Soft Task Source

Question:

```text
Can Agent3 generate system soft tasks without existing user context?
A. Must be grounded in existing proof/profile evidence
B. Can generate a few generic cold-start tasks from initialization profile
C. Do not allow Agent3 to generate soft tasks for now
```

Decision:

```text
A. Agent3-generated system soft tasks must be grounded in proof/profile evidence.
It should not create proactive system tasks from nothing or from broad assumptions about the user.
Cold-start generic system tasks are not allowed unless a later PM decision explicitly enables them.
```

### Soft Task 6. Hardened Soft Task Push Limit

Question:

```text
After a soft task hardens, how many times may Agent2 push it before switching to review/freeze?
A. At most 2 pushes per day, then review/freeze
B. At most 3 pushes per day
C. No fixed count; only quiet hours and cooldown
```

Decision:

```text
A. After a soft task hardens, Agent2 may push it at most 2 times per day.
If the user still does not respond, it should switch to review/freeze instead of escalating indefinitely.
```

### Soft Task 7. Proof Deck Overview Density

Question:

```text
In the proof-side deck/todo overview, can the system retain rich fields such as task name, deck, tension color, recommended time, latest safe time, current state, and next action?
```

Decision:

```text
Yes, but the UI must not show all fields at once.
The first glance should show only task/deck title, tension color, current state, and one next recommended action.
Good line, harden line, reason, recommended execution time, latest safe time, and detailed schedule/proof context should appear only after expand/click or inside the timeline detail.
```

## Post-Voice Plan Mode Backend Decisions

### Plan Mode Backend 1. Direction Owner

Question:

```text
Should Codex decide the Post-Voice Plan Mode Backend direction, or should Pro decide?
```

Decision:

```text
Codex decides the backend product contract.
Pro may later review schema and risk boundaries, but Pro is not the direction owner.
```

### Plan Mode Backend 2. Route Boundary

Question:

```text
What happens after confirmed voice/manual-dictation input is ready for planning?
```

Decision:

```text
The flow enters POST /api/backend/plan-mode.
The input authority is PlanCompilerHandoff from the input layer.
The output is PlanModeDraft with explicit A/B/C options.
The route must not commit deck, write proof, create reminders, schedule cards, or default to option A.
```

### Plan Mode Backend 3. Storage Boundary

Question:

```text
Should plan-mode own backend state?
```

Decision:

```text
Plan-mode may own lightweight PlanModeDraft records for regeneration and later deck commit reference.
It does not own committed decks, active cards, reminders, proof, or profile.
Default repository can be local JSON under .nextcard-data/plan-mode-drafts.json.
```

### Plan Mode Backend 4. Provider Boundary

Question:

```text
Should plan-mode require a real AI provider immediately?
```

Decision:

```text
Plan-mode uses a provider port.
Mimo/OpenAI-compatible providers are adapter slots.
The first implementation must include deterministic-local fallback so the demo does not die when provider output fails or is unavailable.
UI must never import provider SDKs.
```
