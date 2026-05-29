# LAN Device Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hex peer IDs with user-chosen display names across the Yelli LAN intercom, with a first-load modal, localStorage persistence, and editable names that propagate over the signaling channel.

**Architecture:** Client owns the name (localStorage). Server is a dumb relay that includes `displayName` in peer registry and broadcasts. Hex `id` remains the routing key in all WS messages — only the rendered label changes. No automated test infrastructure exists; verification is manual browser testing against two clients.

**Tech Stack:** Node 20, `ws` 8.x, vanilla HTML/CSS/JS (single-file frontend at `AlphaTest/public/index.html`).

**Source spec:** `docs/superpowers/specs/2026-05-29-lan-device-naming-design.md`

**Time budget:** ~1.5 hours. Tasks are sequenced so a partial implementation still ships something useful.

---

## File Structure

| File | Change |
|---|---|
| `AlphaTest/server.js` | Modify — add `names: Map<id, string>`; updated `register`, `peers`, `peer-joined` payloads; new `rename` handler + `peer-renamed` broadcast |
| `AlphaTest/public/index.html` | Modify — add `#name-modal` HTML + CSS, name state on `S`, localStorage I/O, render `displayName` in 3 UI surfaces, header "Edit name" affordance |

No new files. No tests (manual verification only — see Task 9).

---

## Task 1: Server — Add displayName to registry

**Files:**
- Modify: `AlphaTest/server.js:67` (add `names` map)
- Modify: `AlphaTest/server.js:79-128` (register/rename/close handlers)

- [ ] **Step 1: Add `names` map alongside `clients`**

In `AlphaTest/server.js`, replace line 67:
```js
const clients = new Map();
```
with:
```js
const clients = new Map();           // id → ws
const names   = new Map();           // id → displayName
```

- [ ] **Step 2: Update `register` handler to capture displayName**

Replace the `register` case (lines 89–101):
```js
case 'register': {
  myId = msg.id;
  const displayName = sanitizeName(msg.displayName);
  clients.set(myId, ws);
  names.set(myId, displayName);
  console.log(`[+] Registered: ${myId} as "${displayName}"  (total: ${clients.size})`);

  // Tell this client who else is online
  const others = [...clients.keys()]
    .filter(id => id !== myId)
    .map(id => ({ id, displayName: names.get(id) }));
  send(ws, { type: 'peers', peers: others });

  // Tell others this client joined
  broadcast({ type: 'peer-joined', id: myId, displayName }, myId);
  break;
}
```

- [ ] **Step 3: Add `rename` handler**

Insert a new case in the same switch, between the `register` case and the relay cases:
```js
case 'rename': {
  if (!myId) break;
  const displayName = sanitizeName(msg.displayName);
  names.set(myId, displayName);
  console.log(`[~] Renamed: ${myId} → "${displayName}"`);
  broadcast({ type: 'peer-renamed', id: myId, displayName }, myId);
  break;
}
```

- [ ] **Step 4: Add `sanitizeName` helper near top of file**

Insert after line 13 (after `const PORT = ...`):
```js
function sanitizeName(raw) {
  const s = (typeof raw === 'string' ? raw : '').trim();
  if (!s) return 'Guest';
  return s.slice(0, 30);
}
```

- [ ] **Step 5: Update `close` handler to clean `names`**

Replace lines 122–128:
```js
ws.on('close', () => {
  if (myId) {
    clients.delete(myId);
    names.delete(myId);
    console.log(`[-] Left: ${myId}  (total: ${clients.size})`);
    broadcast({ type: 'peer-left', id: myId });
  }
});
```

- [ ] **Step 6: Manual verification — start server, no crash**

```bash
cd AlphaTest
node server.js
```
Expected: server starts on port 3000, prints banner with URLs. No syntax errors.

Kill it with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add AlphaTest/server.js
git commit -m "Add displayName to signaling protocol"
```

---

## Task 2: Client — Name modal HTML + CSS skeleton

**Files:**
- Modify: `AlphaTest/public/index.html` (add modal markup before `<script>` tag at line 547; add CSS in `<style>` block before line 445)

- [ ] **Step 1: Add modal HTML**

Find the line `<script>` at line 547. Immediately ABOVE it, add:
```html
<!-- Name modal (first-load + edit) -->
<div id="name-modal" class="modal-backdrop" hidden>
  <div class="modal-card">
    <h2 id="name-modal-title">What should we call you?</h2>
    <p class="modal-hint">Other people on the network will see this name when you call them.</p>
    <input id="name-modal-input" type="text" maxlength="30" placeholder="e.g. Alice" autocomplete="off" />
    <div class="modal-actions">
      <button id="name-modal-cancel" type="button" hidden>Cancel</button>
      <button id="name-modal-save" type="button">Save</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add modal CSS**

Find `</style>` at line 445. Immediately ABOVE it, add:
```css
.modal-backdrop{
  position:fixed; inset:0; background:rgba(15,23,42,0.78);
  display:flex; align-items:center; justify-content:center;
  z-index:9999; padding:1rem;
}
.modal-backdrop[hidden]{ display:none; }
.modal-card{
  background:#fff; border-radius:14px; padding:1.5rem 1.5rem 1.25rem;
  max-width:380px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.35);
}
.modal-card h2{ margin:0 0 .5rem; font-size:1.25rem; color:#0f172a; }
.modal-card .modal-hint{ margin:0 0 1rem; color:#64748b; font-size:.875rem; }
.modal-card input{
  width:100%; box-sizing:border-box; padding:.65rem .8rem;
  font-size:1rem; border:1px solid #cbd5e1; border-radius:8px;
  outline:none;
}
.modal-card input:focus{ border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
.modal-actions{
  margin-top:1rem; display:flex; gap:.5rem; justify-content:flex-end;
}
.modal-actions button{
  padding:.55rem 1.1rem; font-size:.95rem; border-radius:8px; cursor:pointer;
  border:1px solid #cbd5e1; background:#fff; color:#0f172a;
}
.modal-actions button#name-modal-save{
  background:#2563eb; border-color:#2563eb; color:#fff;
}
.modal-actions button:disabled{ opacity:.5; cursor:not-allowed; }
```

- [ ] **Step 3: Manual verification — modal renders when forced visible**

Temporarily remove the `hidden` attribute on `#name-modal`. Reload `http://localhost:3000` in a browser. Expected: dark backdrop, white card with input and Save button. Restore the `hidden` attribute before committing.

- [ ] **Step 4: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Add name modal HTML + CSS scaffolding"
```

---

## Task 3: Client — localStorage + first-load modal logic

**Files:**
- Modify: `AlphaTest/public/index.html:549` (extend `S` state)
- Modify: `AlphaTest/public/index.html` (add name-modal module before WS connect)

- [ ] **Step 1: Extend client state with `displayName`**

Find line 549:
```js
  myId: null, peerId: null, peers: [], ws: null, pc: null,
```
Replace with:
```js
  myId: null, peerId: null, peers: [], ws: null, pc: null,
  displayName: null,
  names: {},  // peerId → displayName
```

- [ ] **Step 2: Add localStorage helpers + modal controller**

Find the `<script>` opening at line 547 and the existing `const S = {` declaration at line 548. Immediately AFTER the closing `};` of the `S` object (a few lines below line 549), insert this block:
```js
// ── Display-name modal ─────────────────────────────────────────────
const NAME_KEY = 'yelli.displayName';

function loadStoredName() {
  try { return (localStorage.getItem(NAME_KEY) || '').trim() || null; }
  catch { return null; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}

function openNameModal({ mode }) {
  const modal  = document.getElementById('name-modal');
  const title  = document.getElementById('name-modal-title');
  const input  = document.getElementById('name-modal-input');
  const save   = document.getElementById('name-modal-save');
  const cancel = document.getElementById('name-modal-cancel');

  title.textContent = mode === 'edit' ? 'Edit your name' : 'What should we call you?';
  cancel.hidden     = mode !== 'edit';
  input.value       = mode === 'edit' ? (S.displayName || '') : '';
  modal.hidden      = false;
  setTimeout(() => input.focus(), 0);

  return new Promise((resolve) => {
    function cleanup(result) {
      save.onclick   = null;
      cancel.onclick = null;
      input.onkeydown = null;
      modal.hidden   = true;
      resolve(result);
    }
    function commit() {
      const v = input.value.trim().slice(0, 30);
      if (!v) { input.focus(); return; }
      cleanup(v);
    }
    save.onclick   = commit;
    cancel.onclick = () => cleanup(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape' && mode === 'edit') cleanup(null);
    };
  });
}

async function ensureDisplayName() {
  const stored = loadStoredName();
  if (stored) { S.displayName = stored; return stored; }
  const chosen = await openNameModal({ mode: 'first' });
  S.displayName = chosen;
  storeName(chosen);
  return chosen;
}
```

- [ ] **Step 3: Gate WS connection on `ensureDisplayName()`**

Locate the `connect()` function (the one that does `const ws = new WebSocket(...)` around line 669). Find where it's called at startup. Search for the call site (likely near the bottom of the script).

Wrap the startup call so the modal runs first. Find the bottom-of-script init (look for `connect()` invocation). Replace it with:
```js
(async () => {
  await ensureDisplayName();
  connect();
})();
```

If `connect()` is not currently called automatically (e.g. it's called inside another init function), wrap that init call in the same async IIFE.

- [ ] **Step 4: Manual verification — first-load modal flow**

```bash
cd AlphaTest && node server.js
```
Open `http://localhost:3000` in a fresh browser (or clear localStorage first via DevTools → Application → Local Storage → delete `yelli.displayName`).

Expected:
- Modal appears immediately on load.
- Save button does nothing if input is empty.
- Typing "TestUser" and clicking Save closes the modal.
- DevTools → Application → Local Storage shows `yelli.displayName = "TestUser"`.
- Reload page → modal does NOT reappear.

- [ ] **Step 5: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Add first-load name modal with localStorage persistence"
```

---

## Task 4: Client — Send displayName in WS register; track peer names

**Files:**
- Modify: `AlphaTest/public/index.html:674` (register payload)
- Modify: `AlphaTest/public/index.html:704-718` (peers/peer-joined/peer-left/peer-renamed handlers)

- [ ] **Step 1: Include displayName in register message**

Find line 674:
```js
    ws.send(JSON.stringify({ type: 'register', id: S.myId }));
```
Replace with:
```js
    ws.send(JSON.stringify({ type: 'register', id: S.myId, displayName: S.displayName }));
```

- [ ] **Step 2: Update `peers` handler for new shape**

Find lines 704–706:
```js
    case 'peers':
      S.peers = msg.peers;
      log(`Peers online: ${msg.peers.length}`, 'info');
```
Replace with:
```js
    case 'peers':
      S.peers = msg.peers.map(p => p.id);
      S.names = {};
      msg.peers.forEach(p => { S.names[p.id] = p.displayName; });
      log(`Peers online: ${msg.peers.length}`, 'info');
      renderPicker();
```

- [ ] **Step 3: Update `peer-joined` handler**

Find lines 710–711 (the `peer-joined` case):
```js
    case 'peer-joined':
      if(!S.peers.includes(msg.id)) S.peers.push(msg.id);
```
Replace the entire case body with:
```js
    case 'peer-joined':
      if(!S.peers.includes(msg.id)) S.peers.push(msg.id);
      S.names[msg.id] = msg.displayName;
      log(`Joined: ${msg.displayName}`, 'info');
      renderPicker();
      break;
```
(Keep whatever `break;` and any other lines were already in the case — show them too if removing.)

- [ ] **Step 4: Update `peer-left` handler to drop name**

Find the `peer-left` case (lines 716+):
```js
    case 'peer-left':
      S.peers = S.peers.filter(id => id !== msg.id);
```
Add a line right after the filter:
```js
      delete S.names[msg.id];
      renderPicker();
```

- [ ] **Step 5: Add `peer-renamed` case**

Add a new case in the same switch, immediately after `peer-left`:
```js
    case 'peer-renamed':
      S.names[msg.id] = msg.displayName;
      renderPicker();
      // Refresh call overlay labels if this is our current peer.
      if (S.peerId === msg.id) {
        setCallOverlay(msg.id, document.getElementById('callOverlayStatus')?.textContent);
      }
      break;
```
(If `#callOverlayStatus` doesn't exist in the markup, simplify to just `setCallOverlay(msg.id);` and adjust Task 6 accordingly.)

- [ ] **Step 6: Manual verification — register payload reaches server**

Restart server. Open browser, set name "Alice". Server console expected to print:
```
[+] Registered: <hex> as "Alice"  (total: 1)
```

- [ ] **Step 7: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Send displayName on register, track peer names client-side"
```

---

## Task 5: Client — Render displayNames in peer picker

**Files:**
- Modify: `AlphaTest/public/index.html:613-645` area (peer picker render)

- [ ] **Step 1: Locate `renderPicker` (or whatever renders the picker list)**

Search the file for the function that builds the peer picker. The grep showed activity around lines 605–642. Look for a function that iterates `S.peers` and produces clickable rows. It likely has signature `function renderPicker()` or is inline in a `peers`/`peer-joined` handler.

If a discrete `renderPicker()` function does NOT exist, factor one out from the existing inline rendering code so it can be called from the handlers added in Task 4.

- [ ] **Step 2: Replace hex IDs with displayNames in the picker rows**

Inside the picker rendering loop, wherever a row currently shows `id` as its label, change it to:
```js
const label = S.names[id] || id;
```
And use `label` in the DOM (e.g. `<div class="picker-row-name">${escapeHtml(label)}</div>`).

If `escapeHtml` doesn't exist, add this helper at the top of the script (before `connect()`):
```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
```

- [ ] **Step 3: Manual verification — names appear in picker**

Open two browsers (or one + incognito). Set names "Alice" and "Bob". Each picker should list the other by name, not by hex.

- [ ] **Step 4: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Render displayNames in peer picker"
```

---

## Task 6: Client — Render displayNames on call overlay (incoming + active)

**Files:**
- Modify: `AlphaTest/public/index.html:695-698` (`setCallOverlay`)
- Modify: any incoming-call render path that prints `msg.from` or `S.peerId` as a label

- [ ] **Step 1: Update `setCallOverlay`**

Find lines 695–698:
```js
function setCallOverlay(peerId, status) {
  document.getElementById('callOverlayPeer').textContent = peerId || '—';
  // ...
  document.getElementById('callPeerWho').textContent = peerId || '—';
}
```
Replace the two label assignments with:
```js
function setCallOverlay(peerId, status) {
  const label = (peerId && S.names[peerId]) || peerId || '—';
  document.getElementById('callOverlayPeer').textContent = label;
  // ... keep whatever status logic was here ...
  document.getElementById('callPeerWho').textContent = label;
}
```
Preserve any other lines that were already inside the function.

- [ ] **Step 2: Update any status string built with peerId**

Search the file for occurrences of `'CALLING ' + peerId`, `'IN CALL ● ' + S.peerId`, `'Ringing ' + peerId`, etc. (grep output showed these at lines 834, 843, 910.) Replace each occurrence of `peerId` / `S.peerId` in user-facing label strings with:
```js
(S.names[peerId] || peerId)
```
or
```js
(S.names[S.peerId] || S.peerId)
```
as appropriate. Leave `peerId` untouched in `wsSend({ ... to: S.peerId })` calls — those are the routing key.

- [ ] **Step 3: Manual verification — incoming + active call show name**

Restart server. Open Alice and Bob in two browsers. Alice calls Bob.
- Bob's screen: incoming call indicator says "Alice", not the hex ID.
- Bob accepts. Both screens show "Alice"/"Bob" in the call overlay header.
- Bob ends the call. No crashes.

- [ ] **Step 4: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Render displayNames in call overlay and status strings"
```

---

## Task 7: Client — "Edit name" header affordance + rename WS message

**Files:**
- Modify: `AlphaTest/public/index.html` (header bar area near line 466 — `device-bar`)
- Modify: same file, near the modal controller from Task 3

- [ ] **Step 1: Add "your name" + edit button to the header**

Find the `device-bar` block near line 466 (contains `peers-online`). Add a new sibling element inside `device-bar` that shows the current name + edit pencil:
```html
<div class="your-name">
  <div class="lbl">You</div>
  <div class="val">
    <span id="yourNameLabel">—</span>
    <button id="editNameBtn" type="button" class="edit-name-btn" title="Edit name">✎</button>
  </div>
</div>
```

Add corresponding CSS inside `<style>` (before `</style>`):
```css
.device-bar .your-name{ text-align:left; }
.device-bar .your-name .val{ display:inline-flex; align-items:center; gap:.4rem; }
.edit-name-btn{
  background:none; border:1px solid transparent; border-radius:6px;
  cursor:pointer; padding:.1rem .35rem; font-size:.95rem; line-height:1;
  color:#64748b;
}
.edit-name-btn:hover{ background:#f1f5f9; color:#0f172a; }
.edit-name-btn[disabled]{ opacity:.35; cursor:not-allowed; }
```

- [ ] **Step 2: Render the name in the header after `ensureDisplayName()`**

Inside the `ensureDisplayName()` function (added in Task 3), AFTER `S.displayName` is set (in BOTH branches — the stored path and the modal path), add:
```js
const lbl = document.getElementById('yourNameLabel');
if (lbl) lbl.textContent = S.displayName;
```

Cleanest: add a helper near the modal code:
```js
function refreshOwnNameLabel() {
  const lbl = document.getElementById('yourNameLabel');
  if (lbl) lbl.textContent = S.displayName || '—';
}
```
Call `refreshOwnNameLabel()` everywhere `S.displayName` is assigned.

- [ ] **Step 3: Wire the edit button**

Add this near the bottom of the script (after `ensureDisplayName` is defined):
```js
document.getElementById('editNameBtn')?.addEventListener('click', async () => {
  const updated = await openNameModal({ mode: 'edit' });
  if (!updated || updated === S.displayName) return;
  S.displayName = updated;
  storeName(updated);
  refreshOwnNameLabel();
  if (S.ws && S.ws.readyState === WebSocket.OPEN) {
    S.ws.send(JSON.stringify({ type: 'rename', displayName: updated }));
  }
});
```

- [ ] **Step 4: Manual verification — edit name propagates**

Restart server. Open Alice + Bob. Alice clicks ✎ → modal opens pre-filled. Change to "Alice 2". Save. Expected:
- Alice's header label updates immediately.
- Bob's peer picker row for Alice now shows "Alice 2" (no reload needed).
- Server console prints `[~] Renamed: <hex> → "Alice 2"`.

- [ ] **Step 5: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Add edit-name header affordance with rename propagation"
```

---

## Task 8: Client — Disable edit during active call

**Files:**
- Modify: `AlphaTest/public/index.html` (wherever `S.callState` transitions are managed)

- [ ] **Step 1: Add a helper to enable/disable the edit button**

Add near the modal helpers:
```js
function setEditNameEnabled(enabled) {
  const btn = document.getElementById('editNameBtn');
  if (btn) btn.disabled = !enabled;
}
```

- [ ] **Step 2: Disable edit on call start, re-enable on call end**

Search for `S.callState` assignments. The grep showed setStatus calls at lines 834 ('CALLING'), 910 ('IN CALL'), and onCallEnded at 764/946.

- Wherever the call transitions out of `'idle'` (call start, outgoing, incoming-accepted, in-call), add: `setEditNameEnabled(false);`
- Inside `onCallEnded` (or wherever the state resets to `'idle'` and `S.peerId = null`), add: `setEditNameEnabled(true);`

If there's a single state-setter function like `setCallState(state)`, put the logic there instead:
```js
function setCallState(s) {
  S.callState = s;
  setEditNameEnabled(s === 'idle');
}
```
and replace bare `S.callState = ...` assignments with `setCallState(...)`.

- [ ] **Step 3: Manual verification — edit disabled mid-call**

Restart server. Open Alice + Bob. Alice clicks ✎ — works. Alice calls Bob, Bob accepts. During the active call, Alice clicks ✎ — button is greyed out and unresponsive. Bob ends the call. Alice's ✎ becomes clickable again.

- [ ] **Step 4: Commit**

```bash
git add AlphaTest/public/index.html
git commit -m "Disable name editing during active calls"
```

---

## Task 9: End-to-end manual test on LAN

**Files:** none (verification only)

- [ ] **Step 1: Restart server with HTTPS if available**

```bash
cd AlphaTest
# If certs/cert.pem and certs/key.pem exist, the server will auto-pick HTTPS.
# Otherwise generate them first: ./scripts/gen-cert.sh
node server.js
```
Note the LAN URL printed (e.g. `https://192.168.1.10:3000`).

- [ ] **Step 2: Two-browser smoke test**

On one device, open the LAN URL in browser A. On another device (or same laptop, incognito), open the same URL in browser B.

- [ ] A: modal appears → enter "Alice" → Save. Header shows "Alice".
- [ ] B: modal appears → enter "Bob" → Save. Header shows "Bob".
- [ ] A's peer picker shows "Bob". B's picker shows "Alice".
- [ ] A clicks "Bob" → places call. B's incoming notification shows "Alice is calling" (or equivalent). B accepts.
- [ ] Both screens show each other's names in the call overlay. Video + audio work.
- [ ] Either side ends the call. Both return to picker.

- [ ] **Step 3: Edit-and-propagate test**

- [ ] A clicks ✎ → changes to "Alice (laptop)" → Save. Header updates.
- [ ] B's picker entry for A updates without reload.
- [ ] A calls B again. B's incoming shows "Alice (laptop)".

- [ ] **Step 4: Persistence test**

- [ ] A reloads page. Modal does NOT reappear. Name still "Alice (laptop)".
- [ ] A's name still shown correctly to B (B may need to wait for A's reconnect).

- [ ] **Step 5: Edge cases**

- [ ] A clears localStorage `yelli.displayName` via DevTools, reloads. Modal reappears.
- [ ] A enters a 31-character name. Input clips at 30 (browser-enforced).
- [ ] A tries to save an empty/whitespace name. Save no-ops; input refocuses.
- [ ] During an active call, A's ✎ button is disabled.

- [ ] **Step 6: Commit any final tweaks discovered during smoke test**

If everything passes:
```bash
git log --oneline -10
```
to confirm the commit chain. If any tweaks were needed:
```bash
git add AlphaTest/
git commit -m "Polish from end-to-end smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** All sections of the design spec map to tasks:
  - Modal + persistence → Tasks 2, 3
  - Header affordance + edit flow → Task 7
  - localStorage key → Task 3
  - WS protocol additions (register, peers, peer-joined, rename, peer-renamed) → Tasks 1, 4
  - UI surface updates (picker, incoming, active call header) → Tasks 5, 6
  - Validation (trim, 30-char, reject empty) → Tasks 1 (server `sanitizeName`), 2 (`maxlength`), 3 (modal validates)
  - Out-of-scope item "edit during active call" → Task 8 (disable affordance)
  - Risks (single-file frontend, breaking protocol change, rename mid-handshake) → acknowledged in spec; Task 4 step 5 handles overlay re-render on rename
  - Test plan → Task 9

- **No automated tests:** Repo has no test infrastructure. Adding Jest/Vitest + WS test harness blows the 1.5h budget. Verification is manual browser testing per the test plan in the spec.

- **Task ordering rationale:** Server first (Task 1) so the protocol is the source of truth. Client modal scaffold (Task 2) before logic (Task 3) so the markup is visible during dev. Register payload (Task 4) wires the two sides. Then UI surfaces (Tasks 5, 6) — picker before call overlay because picker is more visible at a glance. Edit affordance + rename (Task 7) requires Task 4's `peer-renamed` handler to already exist. Disable-during-call (Task 8) is last because it depends on Task 7's button existing. E2E test (Task 9) seals it.
