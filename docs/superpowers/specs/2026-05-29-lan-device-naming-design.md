# LAN Device Naming — Design

**Date:** 2026-05-29
**Target:** Yelli LAN edition (AlphaTest/) — ship for event 2026-05-30
**Scope:** Option B from brainstorm — calling + per-device display names + anonymous mode default + simple device list. No auth, no tenancy, no branding upload.

## Problem

The current MVP identifies peers by hex IDs (e.g. `a3f9c2`). For tomorrow's event, callers need to recognise each other by human-readable names. Two devices confirmed for the demo, but the design must support N peers gracefully so anyone joining can identify themselves on their own browser.

## Architecture

Client owns the name. The signaling server is a dumb relay that includes whatever `displayName` the client provides in its peer registry and broadcasts. No server-side persistence — if the server restarts, every client's `localStorage` repopulates the registry on reconnect.

## Components

### 1. Name modal (`#name-modal`)
- Overlay shown on first load when `localStorage.getItem('yelli.displayName')` is null/empty.
- Single text input (1–30 chars after trim), `Save` button.
- No dismiss-without-saving (no close button, no backdrop click). Blocks all other UI.
- Reused for the edit flow (pre-filled with current name; `Save`/`Cancel`).

### 2. Header affordance
- Small "Edit name" link (or pencil icon) next to the current displayName in the header.
- Clicking reopens `#name-modal` in edit mode.
- Hidden (or disabled) while a call is active — avoids mid-call rename surprises.

### 3. Persistence
- `localStorage` key: `yelli.displayName` (string).
- No other persistence layer. Re-prompts only if cleared.

### 4. WS protocol changes (`server.js`)

| Message | Before | After |
|---|---|---|
| `register` (client→server) | `{type:'register', id}` | `{type:'register', id, displayName}` |
| `peers` (server→client) | `{type:'peers', peers: [id, ...]}` | `{type:'peers', peers: [{id, displayName}, ...]}` |
| `peer-joined` (server→client) | `{type:'peer-joined', id}` | `{type:'peer-joined', id, displayName}` |
| `peer-left` (server→client) | `{type:'peer-left', id}` | unchanged |
| `rename` (client→server) | — (new) | `{type:'rename', displayName}` |
| `peer-renamed` (server→client) | — (new) | `{type:'peer-renamed', id, displayName}` |

Server keeps `clients: Map<id, ws>` unchanged but adds `names: Map<id, displayName>` alongside (or upgrades to `Map<id, {ws, displayName}>`). On `rename`, server updates the map and broadcasts `peer-renamed` to all other peers.

### 5. UI surfaces to update (`public/index.html`)
Any place currently rendering a hex peer ID now renders `displayName`:
- Peer picker list
- Incoming call screen ("X is calling")
- Active call header / participant label

Hex `id` stays in the data model — used for routing WS messages. Only the rendered label changes.

## Data flow

```
[first load]
  page renders, JS reads localStorage.yelli.displayName → null
  → show #name-modal (blocking)
  → user types "Alice", clicks Save
  → localStorage.setItem('yelli.displayName', 'Alice')
  → modal closes, WS connects
  → send {type:'register', id, displayName:'Alice'}
  → server adds to registry, broadcasts {type:'peer-joined', id, displayName:'Alice'}
  → other clients render "Alice" in their peer pickers

[edit]
  user clicks "Edit name" in header
  → modal opens pre-filled with "Alice"
  → user changes to "Alice (laptop)", clicks Save
  → localStorage updated, WS sends {type:'rename', displayName:'Alice (laptop)'}
  → server updates registry, broadcasts {type:'peer-renamed', id, displayName:'Alice (laptop)'}
  → other clients re-render with new name

[returning visit]
  page renders, localStorage has 'Alice (laptop)'
  → no modal
  → WS register with stored name
```

## Validation

- Trim whitespace front/back.
- Reject empty after trim.
- Hard max 30 chars (input `maxlength=30`; server also enforces — trim and slice to 30).
- No uniqueness check. Two "Alice" devices are allowed; users can disambiguate via edit.

## Out of scope (explicit cuts to protect ~1.5h budget)

- Server-side persistence
- Profanity / abuse filtering
- Display-name uniqueness or collision warning
- Emoji rendering beyond browser default
- Avatars, initials, colour coding
- Multi-language input handling beyond what the browser provides

## Risks

- **Single-file frontend (`public/index.html`, 990 lines).** Modal HTML + CSS + JS all goes inline. The diff will look large but is mechanical.
- **`peers` payload shape change** is a breaking protocol change. No existing clients in the wild on LAN — safe to change without versioning.
- **Race on rename mid-handshake.** If a `rename` arrives while an offer/answer is in-flight, the call still routes by hex `id`, so functionally fine. The other peer may see the old name briefly until `peer-renamed` arrives. Acceptable.

## Test plan (Task 6)

1. Open 2 browser windows (or 1 browser + 1 incognito) against the LAN server.
2. Each shows the modal on first load. Set names "Alice" and "Bob".
3. Verify each sees the other by name in the peer picker.
4. Alice calls Bob. Verify "Alice is calling" on Bob's incoming screen. Accept.
5. Verify both see each other's names in the active call header.
6. End call. On Alice's browser, click "Edit name" → change to "Alice (phone)". Save.
7. Verify Bob's peer picker updates to show "Alice (phone)".
8. Reload Alice's browser. Verify modal does NOT reappear; name "Alice (phone)" persists.
