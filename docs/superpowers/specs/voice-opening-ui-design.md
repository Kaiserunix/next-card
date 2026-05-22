# Next Card Voice Opening UI Design

Date: 2026-05-21
Status: design contract for frontend implementation

## Purpose

This document defines the first voice-first opening experience for Next Card.

The opening must feel like:

```text
I speak lightly, then the app plans.
```

It does not replace explicit Plan Mode. The voice opening only collects and clarifies a lightweight user intention. The product still moves into:

```text
understanding -> constraints/decomposition -> A/B/C plans -> selected plan -> deck
```

## Product Boundary

In scope:

- First card idle state.
- One-tap start gesture.
- Permission/start transition.
- Listening card face.
- Tap-to-finish recording.
- Transcript reveal.
- High-confidence standby/loading card.
- Low-confidence correction card.
- Chip-based clarification loop before A/B/C.
- UI contract to the voice backend routes.

Out of scope:

- Final Plan Mode visual redesign.
- Deck execution redesign.
- Proof redesign.
- Streaming ASR.
- Android native bridge UI.
- Aliyun/Tencent concrete ASR clients.
- Full agent architecture design.

## Source Decisions

The voice opening is based on the PM decisions recorded on 2026-05-21:

- User taps the main card once to grant permission/start.
- The start affordance lives in the center of the main card.
- Pre-tap card shows logo plus one randomized low-pressure hint.
- After permission is granted, use B-lite motion: card floats/scales, logo flashes, then flips into listening.
- Listening face is visual-only: no visible listening text.
- User taps the card again to finish recording.
- Transcript appears by flipping the card back to the front.
- Normal transcript card is gesture-only: right swipe continues, left swipe re-speaks.
- High-confidence path shows `我理解为...` as standby/loading, not as another confirmation.
- Low-confidence path morphs the same transcript card into a correction card.
- Correction uses chips and light taps; avoid asking the user to speak repeatedly.
- Chip selection is sent back to readiness until semantic elements are sufficient.
- A/B/C generation requires task object, task type, and time/deadline/window.
- Missing time chips are chosen by the software's second-layer readiness/clarification agent.

## Design Principle

The opening should feel like a calm ritual, not a microphone toolbar.

Rules:

- The card is the primary control.
- The user should not have to read instructions during listening.
- Normal transcript confirmation should not show buttons.
- Correction may show chips because the user needs lightweight choices.
- The UI should avoid repeated speech; taps and swipes are preferred after the first voice input.
- The opening should be short enough that a student can use it before class, around a deadline, or while walking.
- It must not imply that the product directly controls the system input-method microphone.
- It must not jump directly into `方案一` or generate cards before Plan Mode.

## Overall Flow

```text
idle-card
-> tap-start
-> permission-requesting
-> permission-granted
-> card-float/logo-flash
-> flip-to-listening
-> tap-finish
-> transcribing
-> flip-to-transcript
-> right-swipe
   -> readiness-check
      -> enough: understanding-standby -> Plan Mode A/B/C
      -> missing: correction-card
-> left-swipe
   -> return-to-idle/re-speak

correction-card
-> tap chips
-> readiness-check
   -> enough: understanding-standby -> Plan Mode A/B/C
   -> still missing: same correction card updates chips
-> left-swipe
   -> reject and return to re-speak/re-enter
```

## Screen States

Recommended finite state machine:

```text
idle_hint
-> permission_requesting
-> listening
-> stopping
-> transcribing
-> transcript_review
-> readiness_checking
-> correction_card
-> readiness_checking
-> understanding_standby
-> plan_generating
-> plan_options_ready
```

Fallback/error states:

```text
permission_denied
quota_limited
asr_failed
recording_timeout
unsupported_browser
manual_dictation_fallback
```

The frontend should follow the state machine. It should not infer Plan Mode readiness by itself.

### 1. Idle Card

Goal:

Make the user feel they can speak casually, without committing to a heavy form.

Content:

- Next Card logo or mark.
- One low-pressure hint, randomly selected per idle session:
  - `写一句话，帮你拆成卡片`
  - `说句话，自动生成卡片`
  - `随便说点什么，我来帮你变成卡片`
  - `输入一个想法，拆成卡片`

Interaction:

- Tap anywhere on the main card starts the voice opening.
- The card should be visually tappable, but not look like a generic mic button.
- A separate composer may still exist as a fallback, but the voice-opening ritual centers on the card.

Visual:

- One stable card in the main viewport.
- Quiet logo placement.
- No marketing hero.
- No long instructional copy.
- No oversized toolbar.

### 2. Permission And Start

Goal:

Use the user tap as the permission/start gesture while keeping the flow lightweight.

Behavior:

- First tap requests microphone permission if needed.
- While the browser permission prompt is pending, keep the card in a permission-requesting state.
- If permission is granted, start recording and play the B-lite transition.
- If permission is denied, return to the idle card and expose manual text/manual dictation fallback.
- If the permission promise stalls, keep the card waiting and do not show listening state until a stream is actually available.

Motion:

```text
tap
-> permission_requesting
-> permission_granted
-> card lifts or scales slightly
-> logo flashes once
-> card flips to listening face
```

Implementation notes:

- Use `navigator.mediaDevices.getUserMedia` plus `MediaRecorder` for Web capture.
- Web Speech API can remain an experimental source `web-speech`, but it should not be the primary MVP path.
- Use Framer Motion for lift/scale/flip.
- Use CSS 3D transform for the card face if simpler.
- Respect `prefers-reduced-motion`: replace flip with crossfade and small scale.

### 3. Listening Face

Goal:

Show that the app is listening without making the user read anything.

Content:

- Small mark or logo.
- Waveform, breathing line, pulse, or subtle audio energy visualization.
- No visible text such as `正在听...`.
- Include an accessibility label equivalent to `正在录音，点击卡片结束`.
- No real-time transcript on the first version.

Interaction:

- Tap the card again to finish recording.
- Backend quota still caps the clip at 30 seconds.
- When the hard limit is reached, finish automatically and move to transcribing.

Visual:

- Listening face should feel like the back of the same card.
- Avoid a busy audio recorder UI.
- Avoid countdown anxiety unless the user is near the 30-second limit.

### 4. Transcribing Hold

Goal:

Bridge the short ASR wait without adding a new decision.

Behavior:

- After tap-to-finish, stop recording and send audio to `POST /api/backend/voice/transcribe`.
- Hold the same card in a subtle processing state.
- Do not show transcript text until the backend returns normalized text.

Visual:

- Use the same listening/back-face visual, but slow the waveform or turn it into a fine loading rail.
- If needed, a small progress mark is allowed.
- Keep copy minimal; the normal path should stay visually led.

Errors:

- Quota exceeded: show fallback card with manual text/manual dictation entry.
- Network/provider failure: show retry and manual fallback.
- Empty audio: return to idle/re-speak state.

### 5. Transcript Card

Goal:

Let the user check what was recognized with almost no friction.

Transition:

```text
listening/transcribing face
-> flip back to front
-> show transcript
```

Content:

- Recognized/normalized transcript as the main card text.
- Optional small source label only if useful for debugging or fallback states.
- No normal-path buttons.

Interaction:

- Right swipe: continue.
- Left swipe: reject this input and return to re-speak/re-enter.
- On first use, a very light edge-direction hint is allowed, but it must not become visible buttons.

Rules:

- Rejected transcript is discarded.
- Normal transcript card must not show visible `继续` / `重新说` buttons.
- Do not generate A/B/C directly from a transcript that has not passed readiness.

### 6. Readiness Check

Goal:

Decide whether the transcript is semantically sufficient for Plan Mode.

After right swipe:

```text
POST /api/backend/voice/normalize
POST /api/backend/voice/readiness
POST /api/backend/voice/confirm when accepted
```

The UI must wait for readiness before moving into A/B/C.

Sufficient means all three are present:

- task object
- task type
- time/deadline/window

If sufficient:

```text
transcript card -> understanding standby -> Plan Mode A/B/C
```

If insufficient:

```text
transcript card -> morph into correction card
```

### 7. Understanding Standby Card

Goal:

Give the user a tiny confirmation of system understanding while backend AI prepares A/B/C.

Content:

- Short `我理解为...` sentence or compact semantic summary.
- This is a loading/standby card, not a new confirmation step.

Interaction:

- No additional required confirmation.
- The card proceeds automatically into explicit A/B/C Plan Mode when ready.

Rules:

- Do not show only `方案一`.
- Do not create deck/cards before the user chooses among A/B/C.

### 8. Correction Card

Goal:

Resolve ambiguity with light taps instead of asking the user to speak again.

Transition:

- The same transcript card morphs into correction mode.
- Do not stack a second correction card above it in the normal path.

Content:

- Recognized text.
- AI understanding preview.
- Missing-information area.
- Chips for missing type and suggested values.

First chip families:

- Missing type chips:
  - `具体任务`
  - `时间`
  - `先做哪个`
  - `课程`
  - `作业`
  - `提醒`
- Suggested value chips:
  - `现在`
  - `今天内`
  - `今晚前`
  - `明早课前`
  - `上课前 20 分钟`
  - `DDL 前 1 小时`
  - `本周五前`

Interaction:

- User taps chips to patch the semantic state.
- After a chip tap, immediately send the updated state back to readiness.
- If enough, move to understanding standby.
- If still missing, update the same correction card with the next chip set.
- Keep already selected chips visible as committed context so the card does not feel like it reset.
- Left swipe rejects and returns to re-speak/re-enter.

Custom time fallback:

- If no suggested time chip fits, expose a lightweight custom time control.
- If two chip rounds still cannot produce enough semantic state, expose the lightweight custom control instead of asking the user to speak again.
- Do not silently invent a default time.
- Store time chips as structured `timeWindow` values, not only display text.

Example:

```ts
type VoiceOpeningTimeWindow =
  | { kind: "now"; label: "现在" }
  | { kind: "today"; label: "今天内" }
  | { kind: "deadline"; label: "今晚前"; deadlineLabel: string }
  | { kind: "before-event"; label: "上课前 20 分钟"; eventLabel: string; offsetMinutes: number }
  | { kind: "custom"; label: string; startsAt?: string; deadlineAt?: string };
```

Visual:

- Correction card can contain visible chips.
- Chips should be easy to tap with one thumb.
- Do not turn the card into a full form.
- Keep the transcript visible enough that the user knows what is being corrected.

## Gesture Contract

| State | Gesture | Result |
|---|---|---|
| idle card | tap card | request/start voice |
| listening face | tap card | finish recording |
| transcript card | right swipe | continue to readiness |
| transcript card | left swipe | reject and re-speak/re-enter |
| correction card | tap chip | patch semantic state and re-check |
| correction card | right swipe | accept current correction if readiness allows |
| correction card | left swipe | reject and re-speak/re-enter |

Important distinction:

- Voice confirmation uses right continue / left reject.
- Formal deck execution still uses the old deck baseline from `AGENTS.md`: left/right complete, down status, deeper down freeze.

## Backend UI Contract

The UI should treat backend routes as thin product services:

```text
POST /api/backend/voice/transcribe
POST /api/backend/voice/normalize
POST /api/backend/voice/readiness
POST /api/backend/voice/confirm
```

Recommended UI-facing model:

```ts
type VoiceOpeningStage =
  | "idle_hint"
  | "permission_requesting"
  | "listening"
  | "stopping"
  | "transcribing"
  | "transcript_review"
  | "readiness_checking"
  | "correction_card"
  | "understanding_standby"
  | "plan_generating"
  | "plan_options_ready"
  | "permission_denied"
  | "quota_limited"
  | "asr_failed"
  | "recording_timeout"
  | "unsupported_browser"
  | "manual_dictation_fallback";

type VoiceOpeningTranscript = {
  id: string;
  rawTranscript: string;
  normalizedText: string;
  confidence?: number;
  durationMs?: number;
  source: "web-recording" | "manual-dictation" | "web-speech" | "android-native";
};

type VoiceOpeningReadiness = {
  gate: "enough" | "missing" | "retry";
  confidence: number;
  understandingPreview?: string;
  missingSlots: Array<"taskObject" | "taskType" | "timeWindow">;
  chips: Array<{
    id: string;
    label: string;
    slot: "taskObject" | "taskType" | "timeWindow";
    value: string | VoiceOpeningTimeWindow;
    source: "fixed" | "contextual" | "custom";
  }>;
};
```

## Reference Frontend Notes

Useful inspiration from `external/next-card-119`:

- Mobile WebView-like shell.
- Compact top identity.
- Low-friction composer energy.
- Card-like motion and overlay patterns.

Must not copy as final behavior:

- Do not use `只做一张卡` as core doctrine.
- Do not default directly into `方案一任务流`.
- Do not make burn/freeze gestures from that frontend the formal deck rule.
- Do not lock/fail a task through burning.

## Accessibility And Fallbacks

The primary product rhythm is card gesture, but implementation still needs practical fallbacks:

- If microphone permission fails, show manual text/manual dictation fallback.
- If swipe is hard to use, implementation may expose accessibility-only actions through keyboard or screen-reader labels.
- Reduced motion should use crossfade instead of flip.
- Slower mobile WebView devices may use the same reduced-motion fallback even when the OS setting is not enabled.
- Audio visualization should not be the only state signal for assistive technology.
- Manual dictation is voice-like in product flow but uses source `manual-dictation` and does not count against Volcengine quota.

## Acceptance Criteria

The voice opening UI is complete when:

1. Opening input mode shows one central card with logo and one randomized low-pressure hint.
2. Tapping the card starts the permission/start flow.
3. The card does not enter listening state until microphone permission returns a usable stream.
4. Granted permission triggers B-lite motion: float/scale, logo flash, flip to listening.
5. Listening face uses visual-only state and no visible listening text.
6. Listening face has a non-visual accessibility label for recording state.
7. Tapping the card again finishes recording.
8. The card holds a transcribing state while ASR runs.
9. Transcript appears by flipping back to the front.
10. Normal transcript card has no visible buttons.
11. Right swipe continues from transcript.
12. Left swipe rejects transcript and returns to re-speak/re-enter.
13. High-confidence transcript moves to `我理解为...` standby/loading, then explicit A/B/C Plan Mode.
14. Low-confidence transcript morphs into correction card.
15. Correction card shows recognized text, AI understanding preview, and chips.
16. Tapping chips sends semantic state back to readiness and preserves selected chips as context.
17. The loop does not enter A/B/C until task object, task type, and time/deadline/window are present.
18. Missing time uses structured `timeWindow` chips and custom time fallback instead of silent default guessing.
19. Rejected transcript/audio is not saved.
20. Confirmed transcript can be passed to the backend confirm route.

## Open Architecture Follow-Up

This UI contract intentionally leaves the internal software agent architecture for the next Q&A round.

Next architecture decision should decide how the readiness/clarification layer is structured:

```text
single readiness service
vs
two-layer readiness + clarification agent
vs
larger orchestrated agent graph
```

The current UI design only requires that the frontend receives:

- whether the input is sufficient,
- what is missing,
- what chips should be shown next,
- and when it is safe to enter Plan Mode A/B/C.
