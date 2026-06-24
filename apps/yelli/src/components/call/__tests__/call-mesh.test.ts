// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CallMesh, pcKey, type MeshSnapshot } from '../call-mesh';

/**
 * CallMesh unit tests — the framework-agnostic mesh engine that backs
 * CallEngineProvider. WebRTC primitives (RTCPeerConnection, getUserMedia,
 * getDisplayMedia) do not exist in node/jsdom, so we provide minimal fakes.
 *
 * Covers spec §6/§9:
 *   - one PC per peer on a 2-callee group placement
 *   - glare rule: lower deviceId initiates the offer
 *   - present:start routes a stream into remoteMedia[].screenStreamIds
 *     (BOTH arrival orders: present-then-track and track-then-present)
 *   - per-peer hangup closes only that PC, keeps the other
 *   - full teardown closes everything
 */

// ─── Fakes ───────────────────────────────────────────────────────────────────

class FakeMediaStreamTrack {
  kind: string;
  readonly id: string;
  onended: (() => void) | null = null;
  private _stopped = false;
  constructor(kind: string, id: string) {
    this.kind = kind;
    this.id = id;
  }
  stop(): void {
    this._stopped = true;
  }
  get stopped(): boolean {
    return this._stopped;
  }
}

let streamSeq = 0;
class FakeMediaStream {
  readonly id: string;
  private tracks: FakeMediaStreamTrack[];
  constructor(tracks: FakeMediaStreamTrack[], id?: string) {
    this.id = id ?? `stream-${++streamSeq}`;
    this.tracks = tracks;
  }
  getTracks(): FakeMediaStreamTrack[] {
    return this.tracks;
  }
  getVideoTracks(): FakeMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  getAudioTracks(): FakeMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

type FakeSender = { track: FakeMediaStreamTrack | null; _id: number };

class FakeRTCPeerConnection {
  static instances: FakeRTCPeerConnection[] = [];
  onicecandidate: ((ev: { candidate: unknown }) => void) | null = null;
  ontrack: ((ev: { streams: FakeMediaStream[]; track: FakeMediaStreamTrack }) => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  iceConnectionState = 'new';
  signalingState: 'stable' | 'have-local-offer' | 'have-remote-offer' = 'stable';
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  closed = false;
  senders: FakeSender[] = [];
  addedCandidates: unknown[] = [];
  private senderSeq = 0;

  constructor() {
    FakeRTCPeerConnection.instances.push(this);
  }
  addTrack(track: FakeMediaStreamTrack): FakeSender {
    const s: FakeSender = { track, _id: ++this.senderSeq };
    this.senders.push(s);
    return s;
  }
  removeTrack(sender: FakeSender): void {
    sender.track = null;
  }
  getSenders(): FakeSender[] {
    return this.senders;
  }
  async createOffer(): Promise<{ type: 'offer'; sdp: string }> {
    return { type: 'offer', sdp: 'fake-offer' };
  }
  async createAnswer(): Promise<{ type: 'answer'; sdp: string }> {
    return { type: 'answer', sdp: 'fake-answer' };
  }
  async setLocalDescription(desc: unknown): Promise<void> {
    this.localDescription = desc;
    const d = desc as { type?: string };
    if (d?.type === 'offer') this.signalingState = 'have-local-offer';
  }
  async setRemoteDescription(desc: unknown): Promise<void> {
    this.remoteDescription = desc;
    const d = desc as { type?: string };
    if (d?.type === 'answer') this.signalingState = 'stable';
    if (d?.type === 'offer') this.signalingState = 'have-remote-offer';
  }
  async addIceCandidate(cand: unknown): Promise<void> {
    this.addedCandidates.push(cand);
  }
  close(): void {
    this.closed = true;
  }
  // test helpers
  emitTrack(stream: FakeMediaStream): void {
    this.ontrack?.({ streams: [stream], track: stream.getTracks()[0]! });
  }
}

// ─── Harness ─────────────────────────────────────────────────────────────────

const SELF = 'device-self';

function makeMesh(selfId = SELF) {
  const sent: { kind: string; to: string; sessionId: string; data: unknown }[] = [];
  const snapshots: MeshSnapshot[] = [];
  const localStream = new FakeMediaStream([
    new FakeMediaStreamTrack('audio', 'local-audio'),
    new FakeMediaStreamTrack('video', 'local-video'),
  ]);

  const mesh = new CallMesh({
    selfDeviceId: selfId,
    rtcConfig: { iceServers: [] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createPeerConnection: () => new FakeRTCPeerConnection() as any,
    getLocalStream: async () => localStream as unknown as MediaStream,
    getDisplayMedia: async () =>
      new FakeMediaStream([new FakeMediaStreamTrack('video', 'screen-video')], 'screen-stream-1') as unknown as MediaStream,
    send: (kind, input) => {
      sent.push({ kind, to: input.to, sessionId: input.sessionId, data: input.data });
      return true;
    },
    onState: (s) => snapshots.push(s),
    log: () => undefined,
  });
  return { mesh, sent, snapshots, localStream };
}

afterEach(() => {
  FakeRTCPeerConnection.instances = [];
});
beforeEach(() => {
  streamSeq = 0;
});

describe('pcKey', () => {
  it('combines session and peer deterministically', () => {
    expect(pcKey('s1', 'pX')).toBe('s1::pX');
  });
});

describe('CallMesh — group placement', () => {
  it('builds one PC per peer when placing to two callees', async () => {
    const { mesh } = makeMesh();
    // self < both peers alphabetically? choose ids so self is lower for determinism check below
    await mesh.startGroup('sess-1', ['peer-b', 'peer-c']);
    expect(FakeRTCPeerConnection.instances.length).toBe(2);
    expect(mesh.participants().sort()).toEqual([SELF, 'peer-b', 'peer-c'].sort());
  });
});

describe('CallMesh — glare rule', () => {
  it('self initiates the offer to a higher peerId', async () => {
    const { mesh, sent } = makeMesh('aaa-self');
    await mesh.startGroup('sess-1', ['zzz-peer']);
    // self 'aaa-self' < 'zzz-peer' => self offers
    expect(sent.some((m) => m.kind === 'offer' && m.to === 'zzz-peer')).toBe(true);
  });

  it('self does NOT initiate (waits) when peerId is lower', async () => {
    const { mesh, sent } = makeMesh('zzz-self');
    await mesh.startGroup('sess-1', ['aaa-peer']);
    // self 'zzz-self' > 'aaa-peer' => peer offers; self sends no offer
    expect(sent.some((m) => m.kind === 'offer' && m.to === 'aaa-peer')).toBe(false);
    // but the PC still exists, ready to answer
    expect(FakeRTCPeerConnection.instances.length).toBe(1);
  });
});

describe('CallMesh — present classification (both arrival orders)', () => {
  it('present:start BEFORE the track routes the stream to screenStreamIds', async () => {
    const { mesh } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b']);
    const pc = FakeRTCPeerConnection.instances[0]!;

    // present arrives first
    mesh.handlePresent('sess-1', 'peer-b', { state: 'start', streamId: 'screen-xyz' });
    // then the track arrives carrying that stream id
    pc.emitTrack(new FakeMediaStream([new FakeMediaStreamTrack('video', 'v1')], 'screen-xyz'));

    const rm = mesh.remoteMedia().find((m) => m.deviceId === 'peer-b');
    expect(rm?.screenStreamIds).toContain('screen-xyz');
  });

  it('present:start AFTER the track reclassifies the stream as screen', async () => {
    const { mesh } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b']);
    const pc = FakeRTCPeerConnection.instances[0]!;

    // track arrives first — classified as camera initially
    pc.emitTrack(new FakeMediaStream([new FakeMediaStreamTrack('video', 'v1')], 'screen-xyz'));
    let rm = mesh.remoteMedia().find((m) => m.deviceId === 'peer-b');
    expect(rm?.camStreamId).toBe('screen-xyz');
    expect(rm?.screenStreamIds).not.toContain('screen-xyz');

    // present:start arrives later — reclassify
    mesh.handlePresent('sess-1', 'peer-b', { state: 'start', streamId: 'screen-xyz' });
    rm = mesh.remoteMedia().find((m) => m.deviceId === 'peer-b');
    expect(rm?.screenStreamIds).toContain('screen-xyz');
    expect(rm?.camStreamId).not.toBe('screen-xyz');
  });

  it('present:stop removes the stream from screenStreamIds', async () => {
    const { mesh } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b']);
    const pc = FakeRTCPeerConnection.instances[0]!;
    mesh.handlePresent('sess-1', 'peer-b', { state: 'start', streamId: 'screen-xyz' });
    pc.emitTrack(new FakeMediaStream([new FakeMediaStreamTrack('video', 'v1')], 'screen-xyz'));
    mesh.handlePresent('sess-1', 'peer-b', { state: 'stop', streamId: 'screen-xyz' });
    const rm = mesh.remoteMedia().find((m) => m.deviceId === 'peer-b');
    expect(rm?.screenStreamIds ?? []).not.toContain('screen-xyz');
  });
});

describe('CallMesh — local presenting', () => {
  it('startPresenting adds screen tracks to every peer and announces present:start', async () => {
    const { mesh, sent } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b', 'peer-c']);
    await mesh.startPresenting('sess-1');
    expect(mesh.isPresenting()).toBe(true);
    const presents = sent.filter((m) => m.kind === 'present');
    expect(presents.length).toBe(2); // one per peer
    expect(presents.every((p) => (p.data as { state: string }).state === 'start')).toBe(true);
  });

  it('stopPresenting sends present:stop to every peer and stops screen tracks', async () => {
    const { mesh, sent } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b']);
    await mesh.startPresenting('sess-1');
    mesh.stopPresenting('sess-1');
    expect(mesh.isPresenting()).toBe(false);
    const stops = sent.filter(
      (m) => m.kind === 'present' && (m.data as { state: string }).state === 'stop',
    );
    expect(stops.length).toBe(1);
  });
});

describe('CallMesh — per-peer teardown', () => {
  it('hangup from one peer closes only that PC, keeps the other open', async () => {
    const { mesh } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b', 'peer-c']);
    const pcB = FakeRTCPeerConnection.instances[0]!;
    const pcC = FakeRTCPeerConnection.instances[1]!;

    mesh.handleHangupFrom('sess-1', 'peer-b');
    expect(pcB.closed).toBe(true);
    expect(pcC.closed).toBe(false);
    expect(mesh.participants()).toContain('peer-c');
    expect(mesh.participants()).not.toContain('peer-b');
  });

  it('when only self remains after a hangup, onEmptyCall fires for the session', async () => {
    const onEmpty = vi.fn();
    const { mesh } = makeMesh();
    mesh.onEmptyCall = onEmpty;
    await mesh.startGroup('sess-1', ['peer-b']);
    mesh.handleHangupFrom('sess-1', 'peer-b');
    expect(onEmpty).toHaveBeenCalledWith('sess-1');
  });

  it('teardownAll closes every PC and stops local media', async () => {
    const { mesh, localStream } = makeMesh();
    await mesh.startGroup('sess-1', ['peer-b', 'peer-c']);
    mesh.teardownAll();
    expect(FakeRTCPeerConnection.instances.every((pc) => pc.closed)).toBe(true);
    expect(localStream.getTracks().every((t) => t.stopped)).toBe(true);
  });
});
