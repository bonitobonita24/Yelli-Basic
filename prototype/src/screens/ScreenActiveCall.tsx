'use client';

import { callSessions, devices } from '@/lib/sim';

type Screen = 'app' | 'call';

type Props = {
  go: (screen: Screen) => void;
  activeCallId: string | null;
  tenantId: string;
};

export function ScreenActiveCall(props: Props): JSX.Element {
  const { go, activeCallId } = props;

  const session = activeCallId ? callSessions.byId(activeCallId) : null;
  const calleeDevice =
    session ? devices.byId(session.calleeDeviceId) : null;

  if (!session || !calleeDevice) {
    return (
      <div className="min-h-screen bg-[#0a1a1a] text-white grid place-items-center p-6">
        <div className="text-center space-y-4">
          <div className="text-[16px] opacity-80">Call ended or not found</div>
          <button
            onClick={() => go('app')}
            className="h-11 px-5 rounded-[8px] bg-white text-[#0a0a0a] text-[13px] font-semibold"
          >Back</button>
        </div>
      </div>
    );
  }

  const initials = calleeDevice.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('');
  const endCall = (): void => {
    callSessions.end(session.id, 'completed');
    go('app');
  };

  return (
    <div className="min-h-screen bg-[#0a1a1a] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#0a1a1a] to-[#0a0a0a]" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#ffb084] grid place-items-center text-[#0a0a0a]" style={{ fontSize: 56 }}>
          {initials}
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 px-4 md:px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => go('app')} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-[18px] flex-shrink-0">←</button>
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] md:text-[16px] font-semibold truncate">{calleeDevice.displayName}</span>
            <span className="text-[12px] text-white/70 truncate">{calleeDevice.displayName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[13px] font-mono">02:14</span>
        </div>
      </div>

      <div className="absolute bottom-32 right-4 md:right-6 w-28 h-40 md:w-40 md:h-56 rounded-[16px] overflow-hidden border-2 border-white/30 bg-gradient-to-br from-[#b8a4ed] to-[#ff4d8b] grid place-items-center text-[40px] z-10">
        🙂
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 grid place-items-center z-10">
        <div className="flex items-center gap-2 md:gap-3 px-3 py-3 rounded-full bg-black/40 backdrop-blur-lg border border-white/10">
          <button onClick={() => {}} className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Mute">🎤</button>
          <button onClick={() => {}} className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Camera">📷</button>
          <button onClick={endCall} className="w-14 h-11 md:w-16 md:h-12 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] grid place-items-center text-[18px]" title="End call">📞</button>
          <button onClick={() => {}} className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Speaker">🔊</button>
          <button onClick={() => {}} className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Swap PiP">🔄</button>
        </div>
      </div>
    </div>
  );
}
