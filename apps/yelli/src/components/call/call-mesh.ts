/**
 * CallMesh — framework-agnostic full-mesh WebRTC engine (spec §6).
 *
 * Moves the call engine from "one PC per session" to "one PC per (session, peer)"
 * so a session can hold up to 3 participants, each browser holding up to two
 * RTCPeerConnections. All media stays peer-to-peer (no SFU). Screen sharing adds
 * an optional screen MediaStream whose tracks are pushed to every peer PC and
 * announced over the app-level `present` signal so receivers can label a remote
 * stream as a screen panel vs a face tile.
 *
 * This class is deliberately UI-free and React-free: it owns the PC/stream maps
 * via plain fields (no re-render churn) and emits an immutable snapshot through
 * `onState` whenever render-visible media changes. CallEngineProvider is a thin
 * shell that instantiates it, forwards signaling frames, and renders snapshots.
 *
 * Glare avoidance (spec §2): for any peer-pair the LOWER `deviceId`
 * (lexicographic) creates the offer; the higher waits for it. Applied on group
 * placement, add-to-call, and newcomer-connect. `onnegotiationneeded` (mid-call
 * screen-track add) is guarded against the initial handshake via a per-PC
 * `makingOffer` flag + a `stable`-state check to avoid a double-offer race.
 */

export type RemoteParticipantMedia = {
  deviceId: string;
  /** The peer's camera+mic MediaStream id (if received). */
  camStreamId?: string;
  /** ids of that peer's active screen-share streams. */
  screenStreamIds: string[];
};

export type MeshSnapshot = {
  /** Participant device ids INCLUDING self (1..3). [] when idle. */
  participants: string[];
  /** Per-peer inbound media classification (excludes self). */
  remoteMedia: RemoteParticipantMedia[];
  isPresenting: boolean;
};

export type PresentPayload = { state: 'start' | 'stop'; streamId: string };

type SendInput = { to: string; sessionId: string; data?: unknown };

export type CallMeshDeps = {
  selfDeviceId: string;
  rtcConfig: RTCConfiguration;
  /** Factory so tests can inject a fake. Defaults to `new RTCPeerConnection`. */
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
  /** Acquire (or reuse) the local mic+cam capture. */
  getLocalStream: () => Promise<MediaStream | null>;
  /** Acquire a screen-share capture (getDisplayMedia). */
  getDisplayMedia: () => Promise<MediaStream | null>;
  /** Send a signaling frame of the given kind to a peer. */
  send: (
    kind: 'offer' | 'answer' | 'ice' | 'hangup' | 'present',
    input: SendInput,
  ) => boolean;
  /** Emit an immutable render snapshot whenever media/participants change. */
  onState: (snapshot: MeshSnapshot) => void;
  /** Structured logger (pino-shaped). */
  log: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void;
};

/** Map key for a (session, peer) peer connection. */
export function pcKey(sessionId: string, peerId: string): string {
  return `${sessionId}::${peerId}`;
}

type PeerEntry = {
  sessionId: string;
  peerId: string;
  pc: RTCPeerConnection;
  /** Senders for the local SCREEN tracks added to this PC (for removeTrack on stop). */
  screenSenders: RTCRtpSender[];
  /** Perfect-negotiation-lite guard against double offers during initial handshake. */
  makingOffer: boolean;
};

export class CallMesh {
  /** Optional callback: fired with the sessionId when only self remains in a call. */
  onEmptyCall: ((sessionId: string) => void) | null = null;

  private readonly deps: CallMeshDeps;
  private readonly createPc: (config: RTCConfiguration) => RTCPeerConnection;

  // ── Mesh state (refs; never trigger React renders directly) ─────────────────
  private readonly peers = new Map<string, PeerEntry>(); // pcKey -> entry
  private readonly peersOfSession = new Map<string, Set<string>>(); // sessionId -> peerIds
  private readonly pendingIce = new Map<string, RTCIceCandidateInit[]>(); // pcKey -> ICE
  private readonly pendingOffers = new Map<string, RTCSessionDescriptionInit>(); // pcKey -> offer

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  // Inbound stream registry + per-peer announced screen ids (classification).
  private readonly remoteStreams = new Map<string, MediaStream>(); // streamId -> stream
  private readonly screenIds = new Map<string, Set<string>>(); // peerId -> announced screen streamIds
  private readonly camStreamOf = new Map<string, string>(); // peerId -> camera streamId
  // peerId -> ordered set of inbound stream ids seen (to recompute classification)
  private readonly inboundStreamsOf = new Map<string, Set<string>>();

  constructor(deps: CallMeshDeps) {
    this.deps = deps;
    this.createPc =
      deps.createPeerConnection ??
      ((config): RTCPeerConnection => new RTCPeerConnection(config));
  }

  // ── Public read accessors ───────────────────────────────────────────────────
  get selfDeviceId(): string {
    return this.deps.selfDeviceId;
  }

  participants(): string[] {
    const set = new Set<string>();
    let any = false;
    for (const ids of this.peersOfSession.values()) {
      for (const id of ids) set.add(id);
      if (ids.size > 0) any = true;
    }
    return any ? [this.deps.selfDeviceId, ...set] : [];
  }

  remoteMedia(): RemoteParticipantMedia[] {
    const out: RemoteParticipantMedia[] = [];
    const peerIds = new Set<string>();
    for (const ids of this.peersOfSession.values()) for (const id of ids) peerIds.add(id);
    for (const peerId of peerIds) {
      const screens = this.screenIds.get(peerId);
      const cam = this.camStreamOf.get(peerId);
      out.push({
        deviceId: peerId,
        camStreamId: cam,
        screenStreamIds: screens ? Array.from(screens) : [],
      });
    }
    return out;
  }

  isPresenting(): boolean {
    return this.screenStream !== null;
  }

  getStream(streamId: string): MediaStream | undefined {
    if (this.localStream && this.localStream.id === streamId) return this.localStream;
    if (this.screenStream && this.screenStream.id === streamId) return this.screenStream;
    return this.remoteStreams.get(streamId);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  // ── Snapshot emission ───────────────────────────────────────────────────────
  private emit(): void {
    this.deps.onState({
      participants: this.participants(),
      remoteMedia: this.remoteMedia(),
      isPresenting: this.isPresenting(),
    });
  }

  // ── Classification ──────────────────────────────────────────────────────────
  /** Recompute camera vs screen for a peer from inbound streams + announced screen ids. */
  private reclassify(peerId: string): void {
    const inbound = this.inboundStreamsOf.get(peerId);
    if (!inbound) return;
    const announced = this.screenIds.get(peerId) ?? new Set<string>();
    // The camera is the most-recent inbound stream that is NOT an announced screen.
    let cam: string | undefined;
    for (const id of inbound) {
      if (!announced.has(id)) cam = id;
    }
    if (cam) this.camStreamOf.set(peerId, cam);
    else this.camStreamOf.delete(peerId);
  }

  // ── Peer connection construction ────────────────────────────────────────────
  private ensurePeerEntry(sessionId: string, peerId: string): PeerEntry {
    const key = pcKey(sessionId, peerId);
    const existing = this.peers.get(key);
    if (existing) return existing;

    const pc = this.createPc(this.deps.rtcConfig);
    const entry: PeerEntry = { sessionId, peerId, pc, screenSenders: [], makingOffer: false };
    this.peers.set(key, entry);
    const set = this.peersOfSession.get(sessionId) ?? new Set<string>();
    set.add(peerId);
    this.peersOfSession.set(sessionId, set);

    pc.onicecandidate = (ev): void => {
      if (!ev.candidate) return;
      this.deps.send('ice', {
        to: peerId,
        sessionId,
        data: ev.candidate.toJSON(),
      });
    };

    pc.ontrack = (ev): void => {
      const stream = ev.streams[0];
      if (!stream) return;
      this.remoteStreams.set(stream.id, stream);
      const seen = this.inboundStreamsOf.get(peerId) ?? new Set<string>();
      seen.add(stream.id);
      this.inboundStreamsOf.set(peerId, seen);
      this.reclassify(peerId);
      this.emit();
    };

    pc.oniceconnectionstatechange = (): void => {
      const s = pc.iceConnectionState;
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        this.deps.log('warn', 'call.ice.degraded', { sessionId, peerId, state: s });
      }
    };

    // Mid-call renegotiation (e.g. a screen track added). Only the lower-deviceId
    // side initiates; guard against firing during the initial offer/answer
    // handshake (makingOffer) and only act from a stable state.
    pc.onnegotiationneeded = (): void => {
      if (!this.selfIsInitiator(peerId)) return;
      if (entry.makingOffer) return;
      if (pc.signalingState !== 'stable') return;
      void this.makeAndSendOffer(entry);
    };

    return entry;
  }

  /** True when self should create the offer for this peer (lower deviceId wins). */
  private selfIsInitiator(peerId: string): boolean {
    return this.deps.selfDeviceId < peerId;
  }

  private async makeAndSendOffer(entry: PeerEntry): Promise<void> {
    const { pc, peerId, sessionId } = entry;
    entry.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.deps.send('offer', { to: peerId, sessionId, data: offer });
    } catch (err) {
      this.deps.log('error', 'call.offer.failed', { sessionId, peerId, error: String(err) });
    } finally {
      entry.makingOffer = false;
    }
  }

  /** Add the local cam+mic tracks (and any active screen tracks) to a fresh PC. */
  private async attachLocalTracks(entry: PeerEntry): Promise<void> {
    const stream = await this.deps.getLocalStream();
    if (stream) {
      this.localStream = stream;
      for (const track of stream.getTracks()) entry.pc.addTrack(track, stream);
    }
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        const sender = entry.pc.addTrack(track, this.screenStream);
        entry.screenSenders.push(sender);
      }
    }
  }

  // ── Connect helpers ─────────────────────────────────────────────────────────
  /**
   * Ensure a PC to `peerId` exists for `sessionId`. If self is the initiator
   * (lower deviceId), create + send the offer; otherwise just stand the PC up
   * and wait for the peer's offer.
   */
  async connectToPeer(sessionId: string, peerId: string): Promise<void> {
    if (peerId === this.deps.selfDeviceId) return;
    const key = pcKey(sessionId, peerId);
    if (this.peers.has(key)) return;
    const entry = this.ensurePeerEntry(sessionId, peerId);
    await this.attachLocalTracks(entry);
    if (this.selfIsInitiator(peerId)) {
      await this.makeAndSendOffer(entry);
    }
    this.emit();
  }

  /** Group placement (1–2 callees). Build a PC to each per the offer-ownership rule. */
  async startGroup(sessionId: string, peerIds: string[]): Promise<void> {
    for (const peerId of peerIds) {
       
      await this.connectToPeer(sessionId, peerId);
    }
    this.emit();
  }

  // ── Inbound signal handlers ─────────────────────────────────────────────────
  /** Apply an inbound offer from `from` for `sessionId` (creates the PC if needed). */
  async handleOffer(sessionId: string, from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const entry = this.ensurePeerEntry(sessionId, from);
    // Attach local tracks if we have not already.
    if (entry.pc.getSenders().length === 0) await this.attachLocalTracks(entry);
    try {
      await entry.pc.setRemoteDescription(offer);
      await this.drainPendingIce(sessionId, from);
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      this.deps.send('answer', { to: from, sessionId, data: answer });
    } catch (err) {
      this.deps.log('error', 'call.offer.apply.failed', { sessionId, peerId: from, error: String(err) });
    }
    this.emit();
  }

  async handleAnswer(sessionId: string, from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const entry = this.peers.get(pcKey(sessionId, from));
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(answer);
      await this.drainPendingIce(sessionId, from);
    } catch (err) {
      this.deps.log('error', 'call.answer.apply.failed', { sessionId, peerId: from, error: String(err) });
    }
  }

  async handleIce(sessionId: string, from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const key = pcKey(sessionId, from);
    const entry = this.peers.get(key);
    if (entry && entry.pc.remoteDescription) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch (err) {
        this.deps.log('warn', 'call.ice.add.failed', { sessionId, peerId: from, error: String(err) });
      }
    } else {
      const list = this.pendingIce.get(key) ?? [];
      list.push(candidate);
      this.pendingIce.set(key, list);
    }
  }

  private async drainPendingIce(sessionId: string, peerId: string): Promise<void> {
    const key = pcKey(sessionId, peerId);
    const pending = this.pendingIce.get(key);
    const entry = this.peers.get(key);
    if (!pending || !entry) return;
    for (const cand of pending) {
      try {
         
        await entry.pc.addIceCandidate(cand);
      } catch (err) {
        this.deps.log('warn', 'call.ice.add.failed', { sessionId, peerId, error: String(err) });
      }
    }
    this.pendingIce.delete(key);
  }

  /** Apply an inbound `present` signal — (re)classify the peer's announced stream. */
  handlePresent(_sessionId: string, from: string, payload: PresentPayload): void {
    const set = this.screenIds.get(from) ?? new Set<string>();
    if (payload.state === 'start') {
      set.add(payload.streamId);
    } else {
      set.delete(payload.streamId);
    }
    this.screenIds.set(from, set);
    this.reclassify(from);
    this.emit();
  }

  /** Apply an inbound hangup from one peer — close just that PC. */
  handleHangupFrom(sessionId: string, from: string): void {
    this.closePeer(sessionId, from);
    // If only self remains in this session, the call is over locally.
    const remaining = this.peersOfSession.get(sessionId);
    if (!remaining || remaining.size === 0) {
      this.onEmptyCall?.(sessionId);
    }
  }

  // ── Presenting ──────────────────────────────────────────────────────────────
  async startPresenting(sessionId: string): Promise<void> {
    if (this.screenStream) return;
    const stream = await this.deps.getDisplayMedia();
    if (!stream) {
      this.deps.log('info', 'call.present.denied', { sessionId });
      return;
    }
    this.screenStream = stream;
    // Stop-sharing via the browser's native control ends the presentation.
    const vid = stream.getVideoTracks()[0];
    if (vid) vid.onended = (): void => this.stopPresenting(sessionId);

    const entries = this.entriesForSession(sessionId);
    for (const entry of entries) {
      for (const track of stream.getTracks()) {
        const sender = entry.pc.addTrack(track, stream);
        entry.screenSenders.push(sender);
      }
      this.deps.send('present', {
        to: entry.peerId,
        sessionId,
        data: { state: 'start', streamId: stream.id } satisfies PresentPayload,
      });
    }
    this.emit();
  }

  stopPresenting(sessionId: string): void {
    const stream = this.screenStream;
    if (!stream) return;
    const entries = this.entriesForSession(sessionId);
    for (const entry of entries) {
      for (const sender of entry.screenSenders) {
        try {
          entry.pc.removeTrack(sender);
        } catch {
          /* noop */
        }
      }
      entry.screenSenders = [];
      this.deps.send('present', {
        to: entry.peerId,
        sessionId,
        data: { state: 'stop', streamId: stream.id } satisfies PresentPayload,
      });
    }
    for (const track of stream.getTracks()) track.stop();
    this.screenStream = null;
    this.emit();
  }

  private entriesForSession(sessionId: string): PeerEntry[] {
    const out: PeerEntry[] = [];
    const ids = this.peersOfSession.get(sessionId);
    if (!ids) return out;
    for (const peerId of ids) {
      const e = this.peers.get(pcKey(sessionId, peerId));
      if (e) out.push(e);
    }
    return out;
  }

  // ── Teardown ────────────────────────────────────────────────────────────────
  closePeer(sessionId: string, peerId: string): void {
    const key = pcKey(sessionId, peerId);
    const entry = this.peers.get(key);
    if (entry) {
      try {
        entry.pc.close();
      } catch {
        /* noop */
      }
      this.peers.delete(key);
    }
    this.pendingIce.delete(key);
    this.pendingOffers.delete(key);
    const set = this.peersOfSession.get(sessionId);
    if (set) {
      set.delete(peerId);
      if (set.size === 0) this.peersOfSession.delete(sessionId);
    }
    this.screenIds.delete(peerId);
    this.camStreamOf.delete(peerId);
    this.inboundStreamsOf.delete(peerId);
    this.emit();
  }

  closeSession(sessionId: string): void {
    const ids = Array.from(this.peersOfSession.get(sessionId) ?? []);
    for (const peerId of ids) this.closePeer(sessionId, peerId);
    this.emit();
  }

  teardownAll(): void {
    for (const sessionId of Array.from(this.peersOfSession.keys())) this.closeSession(sessionId);
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) t.stop();
      this.screenStream = null;
    }
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    this.emit();
  }
}
