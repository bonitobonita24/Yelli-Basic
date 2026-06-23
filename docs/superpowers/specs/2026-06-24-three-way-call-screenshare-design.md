# Three-Way Calling + Screen Share — Design

**Date:** 2026-06-24
**Status:** Approved (owner, full-auto build authorized)
**Scope:** Yelli web app (`apps/yelli`) + signaling relay + `@yelli/shared` + `@yelli/db`
**Edition impact:** Both LAN and Cloud (media stays peer-to-peer in both)

---

## 1. Summary

Today a Yelli call is strictly **1-on-1**: one `CallSession` (caller + callee), one
`RTCPeerConnection`, one remote video. This feature adds an **optional third participant**
so a session can hold up to **three** people, and lets any participant **share their screen**
(desktop browsers only).

**Locked requirements (owner-confirmed 2026-06-24):**

1. **3rd participant = a full caller**, not a one-way spectator: bidirectional cam/mic with
   everyone, AND can additionally screen-share. (Anyone in the call can present.)
2. **Join flow = both**: start-as-group (caller selects 1 **or 2** callees up front) AND
   add-mid-call ("Add person" rings a 3rd into a live 2-party call). Hard cap = **3**.
3. **Data model = minimal**: one nullable `thirdDeviceId` column on `CallSession`.
   *Who is presenting* and *early-leave* are deliberately **NOT** persisted (see §4).
4. **Presentation = multiple simultaneous shares allowed**: each participant may push an
   optional screen track; the UI shows face tiles + any number of live screen panels.
5. **Platform = web only**. Mobile devices **join and view** shared screens; the **Present**
   control is **desktop-only** (browser `getDisplayMedia` is unsupported on iOS/Android).
   Mobile presenting would require a native app, which **does not exist** and is out of scope.
6. **Permissions = unchanged**: reuse the existing `forbidden-by-role` guard for placing,
   adding, and presenting. In Cloud, every participant must be the **same tenant** (as today).

---

## 2. Topology — full mesh (no media server)

Three participants connect as a **full mesh**: 3 peer connections total, each browser holding
**two** `RTCPeerConnection`s (one per other peer). All media remains peer-to-peer — preserving
Yelli's core promise that *media never touches the server* — in both LAN and Cloud editions.
No SFU, no new infrastructure. Mesh is the correct topology at this size (fine to ~4 peers);
beyond that an SFU would be needed, but the hard cap of 3 keeps us comfortably inside mesh.

**Offer ownership (glare avoidance):** to prevent both peers offering simultaneously, the rule
is **the lower `deviceId` (lexicographic) initiates the offer** to the higher. This deterministic
"polite/impolite" assignment avoids glare without full perfect-negotiation machinery, which is
acceptable because connections are established one peer-pair at a time.

---

## 3. Signaling protocol — additive, server is near-untouched

The relay (`apps/signaling`) already forwards every frame by its `to: deviceId` field and is
inherently point-to-point — it needs **no routing change** for mesh. The engine simply sends an
offer/answer/ice frame to **each** peer instead of one.

**Existing kinds (unchanged):** `offer`, `answer`, `ice`, `hangup` — already carry
`{ to, from, sessionId, data }`.

**One new app-level kind: `present`** — `{ kind: 'present', state: 'start' | 'stop', streamId }`.
WebRTC cannot reliably label a remote track as *camera* vs *screen* across renegotiation, so a
presenter announces its screen `MediaStream.id` over this signal. Receivers map the inbound
stream id → "screen panel" vs "face tile". The relay forwards it identically to the other kinds —
the only server change is **allowing the new kind through `signalMessageSchema`**.

**Group `call-signal` lifecycle:** `calls.start` (multi-callee) and `calls.add` emit the existing
`call-signal` `start` phase to each ringing callee, unchanged in shape (`{ sessionId, phase,
callerDeviceId, calleeDeviceId }`) — emitted once per callee.

---

## 4. Data model

`CallSession` gains **one** nullable column:

```prisma
thirdDeviceId String?   // null for 1-on-1 calls; set when a 3rd participant is added
// existing: callerDeviceId, calleeDeviceId, connectedAt, endedAt, endReason, tenantId ...
```

Migration: `packages/db/prisma/migrations/0004_add_third_device/` — additive, backward
compatible (existing rows get `null`).

**Deliberately ephemeral (NOT in the DB), to avoid the rigid-column pain:**

- **Who is presenting** — a transient realtime fact carried by the `present` signal and held in
  client state only. Persisting it would add churn with no audit value.
- **Early-leave of one participant** — handled by the existing `hangup` signal + `endReason`.
  A participant leaving tears down *their two* connections; the session row is only stamped
  `endedAt` when **≤1 participant remains** (see §6 lifecycle).

The L5 `AuditLog` already records call lifecycle; the third participant is captured by
`thirdDeviceId` being set on the row, which is sufficient for "this call had three people."

---

## 5. tRPC procedures (`apps/yelli/src/server/trpc/routers/call.ts`)

- **`calls.start`** — accept an optional second callee. Input becomes
  `{ callerDeviceId, calleeDeviceIds: string[] }` (length 1 **or** 2). Runs the existing
  per-callee role-guard + Cloud tenant-match. With two callees, the second is written to
  `thirdDeviceId`. Emits `call-signal` `start` to each callee. **Backward compatible:** a
  single-element array reproduces today's behavior. (Keep a thin adapter so existing callers/
  tests using `calleeDeviceId` still typecheck, or migrate call sites in the same change.)
- **`calls.add`** *(new)* — `{ sessionId, calleeDeviceId }`. Validates: session live
  (`endedAt` null), a free slot (`thirdDeviceId` null), role-guard + same-tenant on the new
  device, and that the caller is already a participant. Stamps `thirdDeviceId`, emits
  `call-signal` `start` to the new device so it rings via the normal incoming overlay.
- **`calls.connect` / `calls.end` / `calls.byId`** — semantics preserved. `byId` returns
  `thirdDeviceId` so a refreshing/3rd device can resolve all participants. `end` with a
  per-participant `reason` still works; "ended" is now decided by participant count (§6).
- **Caps & guards:** server rejects a 4th participant (`thirdDeviceId` already set →
  `CALL_FULL`), rejects self-add, rejects adding a device already in the session.

---

## 6. Client engine refactor (`CallEngineProvider.tsx`) — the core change

The engine moves from **one PC per session** to **one PC per (session, peer)**.

**State changes:**

- `pcsRef: Map<string, RTCPeerConnection>` keyed by **`${sessionId}::${peerDeviceId}`**
  (helper `pcKey(sessionId, peerId)`).
- `peersOfSessionRef: Map<string, Set<string>>` — the set of peer deviceIds per session
  (replaces the single-value `peerOfSessionRef`).
- `pendingIceRef` / `pendingOffersRef` — re-keyed by `pcKey` (per peer, not per session).
- `localStreamRef` — unchanged (one mic+cam capture, added to every peer PC).
- `screenStreamRef: MediaStream | null` — local `getDisplayMedia` capture when presenting;
  its tracks are added to every peer PC and announced via the `present` signal.
- **Remote media registry** (replaces the single hidden `[data-remote-stream-target]` video):
  `remoteMediaRef`/state mapping `peerDeviceId → { camStream?, screenStreams: Map<streamId, MediaStream> }`,
  consumed by `ScreenActiveCall` to render tiles. `ontrack` routes a stream to "screen" if its
  `stream.id` was announced via a `present:start`, else "camera".

**Behavior changes:**

- `makePc(sessionId, peerDeviceId)` — keyed by `pcKey`; `onicecandidate`/`ontrack` capture the
  specific `peerDeviceId`; adds **both** local cam tracks and (if presenting) screen tracks.
- `onnegotiationneeded` per PC — enables renegotiation when a screen track is added mid-call
  (lower-deviceId initiates; both sides apply). Guarded against the initial offer to avoid a
  double-offer race.
- **Group placement** `placeCall(peerDeviceIds: string[])` (1–2) — `calls.start` with the array;
  on success build a PC to **each** callee following the offer-ownership rule.
- **`addToCall(peerDeviceId)`** *(new, exposed on `CallEngineApi`)* — `calls.add`, then build a
  PC to the new peer (offer-ownership rule decides who offers; both existing participants will
  each open a PC to the newcomer once they learn of them via `call-signal`/offer).
- **`acceptIncoming`** — a newcomer accepting may need to build PCs to **both** existing
  participants. It learns the participant set from `calls.byId` (now includes `thirdDeviceId`).
- **`startPresenting()` / `stopPresenting()`** *(new)* — `getDisplayMedia`, add/remove screen
  tracks on every peer PC, send `present:start/stop`. `screen.getVideoTracks()[0].onended`
  (user clicks browser "Stop sharing") calls `stopPresenting()`.
- **Per-peer teardown** — `closePeer(sessionId, peerId)` closes one PC. `closeCall(sessionId)`
  closes all peers for the session. On inbound `hangup` from one peer, close just that peer; if
  that drops us to a single remaining participant, end the call locally.
- **API surface** `CallEngineApi` becomes:
  `{ selfDeviceId, placeCall(ids: string[]), addToCall(id), startPresenting(), stopPresenting(),
  isPresenting, participants: string[], busy }`. `placeCall` keeps a 1-arg-friendly shape for
  existing callers (accept `string | string[]`).

**React discipline:** refs for socket/PC maps (no re-render churn); the remote-media registry is
the only new piece of render state and is updated immutably. Run the `react-best-practices` check
on the touched TSX after edits.

---

## 7. UI

**`ScreenActiveCall.tsx`** — from a fixed local+remote pair to a **participant grid**:

- **Face tiles:** self + each remote participant's camera (1–3 tiles), responsive from the
  375px mobile baseline up (locked mobile-first contract) — 1 column on phone, grid on wider.
- **Screen panels:** every active screen share (local or remote) renders as a large panel above
  the face strip; multiple shares sit side-by-side (the chosen "multiple simultaneous" UX).
- **Controls:** existing mic/cam/hangup, plus:
  - **Present / Stop presenting** — **rendered only when `getDisplayMedia` is available**
    (desktop). On mobile it is hidden; an inline hint explains presenting is desktop-only.
  - **Add person** — opens a compact picker (reuses `PeerDirectory` selection) to ring a 3rd;
    hidden/disabled when the session is already full (3) or when not permitted.
- Clay tokens + lucide icons only (ui-rules); no raw hex. Reuse existing shadcn primitives.

**`PeerDirectory.tsx`** — support selecting up to **2** callees to start a group (multi-select
with a max-2 affordance), while preserving single-tap-to-call. Wire its selection into
`placeCall(ids)` and into the in-call "Add person" picker.

**`OverlayIncomingCall.tsx`** — unchanged shape; the newcomer rings exactly as today.

---

## 8. Error handling & edge cases

- **`getDisplayMedia` denied/cancelled** → no-op, stay in call, log `call.present.denied`.
- **Renegotiation failure** when adding a screen track → drop the screen track, keep the call,
  surface a toast; never tear down the whole call for a failed share.
- **Capacity race** (two people add a 3rd at once) → server is the arbiter: first `calls.add`
  wins, second gets `CALL_FULL`; client shows "call is full."
- **One peer drops** → close only that PC; remaining pair stays connected; if only one
  participant remains, end locally + `calls.end`.
- **Newcomer can't reach one existing peer** (NAT) → that one pairwise link fails; the other
  links stay up; log `call.ice.degraded` per pair (TURN remains a separate deploy concern).
- **Backward compat** → 1-on-1 calls take the single-callee path unchanged; `thirdDeviceId`
  stays null; existing tests for 1-on-1 must still pass.

---

## 9. Testing

- **Shared/schema:** `present` signal parses; rejects bad `state`; `call-signal` group shape.
- **tRPC:** `calls.start` with 1 and 2 callees; `calls.add` happy path; `CALL_FULL`; self-add
  reject; role-guard + tenant-match on the added device; backward-compat single-callee.
- **Engine (vitest, mocked `RTCPeerConnection`/`getUserMedia`/`getDisplayMedia`):** pcKey map
  builds one PC per peer; offer-ownership picks the right initiator; `present:start` routes a
  stream to the screen registry; per-peer hangup closes only that PC; full-session teardown.
  Extend the existing `signaling call peer CallEngine PeerDirectory` suite (currently green).
- **Verification gate:** `pnpm -w typecheck` + targeted vitest green; dev stack rebuild healthy;
  **Playwright sweep of every route** (login + each page, no 404/console-crash) per the standing
  all-pages rule. Two-browser manual 3-way is a human gate (noted in handoff).

---

## 10. Out of scope (explicit)

- Native mobile app / mobile screen capture (no app exists; separate project).
- SFU / >3 participants / recording.
- TURN provisioning (separate deploy concern; mesh works on LAN/most NATs).
- Staging/prod deploy — **HARD HOLD** per the promotion-gating policy. This work stops at
  local-dev verified + branch pushed + PR; owner signals promotion.

---

## 11. Governance

- **PRODUCT.md (Rule 1) is edited FIRST**, before any code: move *group calls (cap 3)* and
  *desktop screen share* out of "Out of scope for MVP" into §Core User Flows / §Modules, and
  record the mobile-view-only / desktop-present platform constraint. The build follows the spec.
- Update `docs/DECISIONS_LOG` and `docs/IMPLEMENTATION_MAP` per framework convention.
- Commit per phase; conventional commits; HOLD before any promotion.
