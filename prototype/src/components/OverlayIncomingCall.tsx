'use client';

type Props = {
  callerName: string;
  callerDeviceName: string;
  onAccept: () => void;
  onReject: () => void;
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

export default function OverlayIncomingCall(props: Props): JSX.Element {
  const { callerName, callerDeviceName, onAccept, onReject } = props;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[20px] bg-white shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8 grid place-items-center text-center">
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">
            Incoming call
          </div>
          <div className="mt-4 w-24 h-24 rounded-full bg-[#ffb084] grid place-items-center text-[#0a0a0a] text-[32px] font-semibold">
            {initials(callerName)}
          </div>
          <div className="mt-4 text-[20px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
            {callerName}
          </div>
          <div className="mt-1 text-[13px] text-[#6a6a6a]">{callerDeviceName}</div>
          <div className="mt-4 text-[12px] text-[#6a6a6a] leading-[1.55] max-w-[300px]">
            In-app ring while the tab is open. Native push wakes the device when the app
            is closed (PWA installed only).
          </div>
        </div>
        <div className="px-6 md:px-8 pb-6 md:pb-8 flex items-center justify-center gap-8">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] text-white grid place-items-center text-[24px] transition"
            title="Reject"
          >
            ✕
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-[#22c55e] hover:bg-[#15803d] text-white grid place-items-center text-[24px] transition"
            title="Accept"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
