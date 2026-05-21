# Next Card Voice Plan Mode Backend Design

Date: 2026-05-21
Status: draft for post-compaction follow-up

## Current Decisions

Next Card keeps the old product contract as the main experience: explicit Plan Mode.

The flow is:

```text
voice or text input
-> AI understanding
-> constraints and decomposition
-> A/B/C execution plans
-> user selects a plan
-> deck and action cards are generated
```

The teammate frontend in `external/next-card-119` can be used as a visual/product reference, especially its light mobile card feel, but it must not replace explicit Plan Mode with an immediate default-plan flow.

## Voice Experience Goal

The desired future opening experience is:

```text
a card appears
-> Next Card mark appears
-> voice capture starts after permission/user gesture
-> recognized speech appears on the card
-> right swipe confirms the transcript
-> left swipe rejects this input
-> Plan Mode creates A/B/C options
```

Frontend interaction details are deferred. This document defines the backend and platform contract first.

## Platform Strategy

The experience version uses Web first, with Android native bridge reserved.

Deployment assumption:

```text
Backend-capable Next server.
Core routes live under app/api/backend/*.
The first implementation does not assume static export as the primary backend shape.
```

```text
MVP:
Web / mobile browser
-> short audio upload
-> Volcengine ASR
-> transcript review card
-> Plan Mode

Next stage:
Android WebView native wrapper
-> Android SpeechRecognizer or native recording
-> WebView bridge
-> same SpeechTranscript contract
-> same Plan Mode
```

Plain Web pages should not promise that they can directly trigger the system input-method microphone button. System dictation remains a useful fallback, but product control should come from either in-page capture or a native wrapper.

## Provider Strategy

Default provider for the experience version:

```text
volcengine-asr
```

Experience-version credential shape:

```text
VOLCENGINE_ASR_API_KEY=<new console APP Key / X-Api-Key>
VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
```

The first implementation should use the newer console `X-Api-Key` path for Volcengine's big-model flash recording-file recognition API. Older `X-Api-App-Key` plus `X-Api-Access-Key`, or token-based `AK/SK/AppKey`, should remain compatibility options only when the new console route is unavailable.

Reserved providers:

```text
aliyun-asr
tencent-asr
```

For the first implementation, Aliyun and Tencent should only be represented as provider types and adapter slots. Do not implement their provider clients yet.

Additional future sources:

```text
manual-dictation
web-speech
android-native
self-hosted-asr
mimo-asr
```

Manual dictation rule:

```text
Product flow: treated like voice input because the user spoke.
Proof/source label: manual-dictation.
ASR cost/quota: does not count as Volcengine ASR usage.
Raw audio: not available to Next Card and not stored.
```

MiMo should not be treated as the default hosted ASR provider until a stable public ASR API is confirmed. Publicly visible MiMo ASR model work can remain a future self-hosted or experimental adapter option.

## Recognition Mode

Use a two-layer design:

```text
MVP:
batch short-audio transcription

Future:
streaming transcription session
```

MVP audio capture constraints:

```text
single clip length: 5-30 seconds
default max clip length: 30 seconds
audio file is temporary
audio is not stored after transcription
```

Streaming is reserved for a later version, especially for Android wrapper or a more immersive card-opening experience.

## Transcript Review

Voice recognition does not directly enter planning.

The transcript must pass through a review card:

```text
ASR returns transcript
-> light normalization
-> show recognized sentence on card
-> right swipe confirms
-> left swipe rejects and discards this input
```

Confirmed transcript enters Plan Mode.

Rejected transcript is not saved to proof or user history.

## Light Normalization

Normalization is light. It prepares speech text for Plan Mode without rewriting the user's intent.

Allowed:

- remove obvious filler words such as `呃`, `那个`, `就是`
- remove duplicated starts
- add basic punctuation and sentence breaks
- fix high-confidence ASR spacing or obvious homophone errors
- preserve both raw and normalized text for the confirmed record

Not allowed:

- infer hidden deadlines
- expand one sentence into a new complex goal
- generate cards
- skip explicit Plan Mode
- silently change the user's intent

## Confidence Gate

After the user confirms the transcript, the backend evaluates readiness.

```text
confirmed transcript
-> readiness check
-> high confidence: direct Plan Mode A/B/C
-> low confidence: show AI understanding card first
```

Low-confidence understanding card content:

```text
recognized text
AI understanding preview
missing-information chips when useful
right swipe: confirm and continue into Plan Mode
left swipe: reject and return to re-speak or re-enter
visible fallback buttons: confirm understanding / re-speak
```

In this state, the interaction should feel like a lightweight Plan Mode-like clarification card, not a form. Prefer tap/click chips and buttons over asking the user to speak again. Re-speaking remains available, but the product should reduce voice burden when the system is uncertain.

If the input remains ambiguous after this confirmation, the system should not force three execution plans. Show a missing-information confirmation card first, let the user resolve the ambiguity with lightweight chips or buttons, then generate the explicit A/B/C Plan Mode options.

Low-confidence triggers include:

- ASR confidence is low
- transcript is too short, such as only `那个作业`
- unresolved references, such as `这个`, `那个`, `明天那个`
- incomplete time expression
- multiple goals mixed together
- normalization changed too much

Suggested shape:

```ts
type VoicePlanGate =
  | "direct-plan"
  | "confirm-understanding"
  | "retry-transcript";

type VoicePlanReadiness = {
  gate: VoicePlanGate;
  confidence: number;
  reasons: string[];
  understandingPreview?: string;
  missingInfoChips?: string[];
};
```

## Data Contract

Use one transcript shape across Web, Android, cloud ASR, and future providers.

```ts
type SpeechInputSource =
  | "manual-dictation"
  | "web-recording"
  | "web-speech"
  | "android-native"
  | "volcengine-asr"
  | "aliyun-asr"
  | "tencent-asr"
  | "self-hosted-asr"
  | "mimo-asr";

type SpeechTranscript = {
  id: string;
  text: string;
  rawTranscript: string;
  normalizedText: string;
  source: SpeechInputSource;
  provider?: "volcengine" | "aliyun" | "tencent" | "manual" | "android" | "mimo";
  language: "zh-CN" | "en" | "mixed" | "auto";
  durationMs?: number;
  confidence?: number;
  userConfirmed: boolean;
  createdAt: string;
};
```

Only confirmed transcript records may be linked to Plan Mode, deck, proof, or history.

## Backend Services

Suggested service boundaries:

```text
SpeechToTextPort
TranscriptNormalizationService
VoiceInputReviewService
VoicePlanReadinessService
PlanModeVoiceAdapter
VoiceUsageLimitService
```

Suggested API surface:

```text
POST /api/backend/voice/transcribe
POST /api/backend/voice/normalize
POST /api/backend/voice/readiness
POST /api/backend/voice/confirm
```

First implementation scope:

```text
Implement only voice ASR, quota, transcript review contract, light normalization, and readiness gating.
Do not write deck/proof state from the backend in this slice.
Do not expand into full Plan Mode/deck/proof persistence in this slice.
```

Reserved future API:

```text
POST /api/backend/plan-mode
POST /api/backend/voice/session
```

Provider port:

```ts
type SpeechProviderMode = "batch-audio" | "streaming";

interface SpeechToTextPort {
  transcribeAudio(input: unknown): Promise<SpeechTranscript>;
  createStreamingSession?(input: unknown): Promise<unknown>;
}
```

## Privacy And History

Save:

- confirmed transcript
- normalized text
- source and provider
- duration
- confidence
- created time
- linked plan/deck id when available

Do not save:

- rejected transcript
- raw audio
- user withdrawal actions
- long-term audio cache

Audio should be used only for the current transcription request and discarded after provider processing.

## Quota And Cost Control

The experience version must include simple quota limits.

Default rule:

```text
max single clip: 30 seconds
daily clip count: 30 clips per anonymous device
daily total duration: 10 minutes per anonymous device
fallback on limit: system dictation or manual text
```

Suggested config:

```ts
type VoiceUsageLimit = {
  maxDurationMsPerClip: number;
  maxClipsPerDay: number;
  maxTotalDurationMsPerDay: number;
  provider: "volcengine";
};
```

Quota identity:

```text
MVP: anonymous device id
Future: user id first, device id fallback
```

Suggested records:

```ts
type VoiceQuotaSubject = {
  kind: "device" | "user";
  id: string;
};

type VoiceUsageRecord = {
  subject: VoiceQuotaSubject;
  provider: "volcengine" | "aliyun" | "tencent";
  durationMs: number;
  createdAt: string;
  status: "accepted" | "rejected" | "failed";
};
```

The server must enforce duration, size, and quota before calling the ASR provider.

First implementation storage:

```text
Use a VoiceUsageRepository interface.
Default implementation: local JSON file storage.
Future implementation: database-backed repository without changing API routes.
```

State authority:

```text
localStorage remains the frontend offline fallback and deck/proof persistence baseline.
The backend JSON repository is only authoritative for voice usage records and confirmed transcript metadata in this slice.
```

## Product Callback Decisions

These decisions are inherited from the old design while the backend slice stays voice-first:

```text
Burning semantics: pressure feedback only; no failure or hard deck lock.
Deck gestures: old baseline; left/right complete, down reveals status, deeper down freezes.
Proof first screen: old complete evidence system; colored table, charts, journal, and summary.
```

## Open Questions For Next Session

1. The voice/backend PM alignment has been implemented as the first backend slice in root.

## Implementation Status

Implemented on 2026-05-21:

- `POST /api/backend/voice/transcribe`
- `POST /api/backend/voice/normalize`
- `POST /api/backend/voice/readiness`
- `POST /api/backend/voice/confirm`
- `SpeechToTextPort` with Volcengine batch ASR adapter.
- Local JSON `VoiceUsageRepository` for anonymous-device quota records.
- Local JSON `VoiceTranscriptRepository` for confirmed transcript metadata.
- Lightweight transcript normalization and readiness gating.

Still intentionally out of scope:

- Streaming ASR.
- Aliyun/Tencent concrete providers.
- Deck/proof backend persistence.
- Frontend voice UI.
- Raw audio persistence.

## Non-Goals

- No visual design implementation in this phase.
- No streaming ASR implementation in MVP.
- No direct promise that Web can start the system input-method dictation button.
- No persistent audio storage.
- No provider-specific code leaking into UI components.
- No bypass of explicit Plan Mode.
