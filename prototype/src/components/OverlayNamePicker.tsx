'use client';

import { useState } from 'react';

type Props = {
  initialName: string;
  onSave: (name: string) => void;
  onClose?: () => void;
};

const MAX_LEN = 24;

export default function OverlayNamePicker(props: Props): JSX.Element {
  const { initialName, onSave, onClose } = props;
  const [value, setValue] = useState(initialName);
  const trimmed = value.trim();
  const isFirstJoin = initialName.trim().length === 0;
  const canSave = trimmed.length > 0 && trimmed !== initialName.trim();
  const canCancel = !isFirstJoin && typeof onClose === 'function';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[20px] bg-white shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8">
          <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
            What should we call you?
          </h3>
          <p className="mt-2 text-[13px] text-[#6a6a6a]">
            This is the name your colleagues see when you appear in the directory.
          </p>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={MAX_LEN}
            placeholder="e.g. Maria"
            autoFocus
            className="mt-6 w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]"
          />
          <div className="mt-2 text-[11px] text-[#9a9a9a]">
            {trimmed.length}/{MAX_LEN} characters
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
            {canCancel && (
              <button
                onClick={onClose}
                className="w-full sm:w-auto h-11 px-5 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[#0a0a0a] text-[14px] font-semibold hover:border-[#0a0a0a]"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => canSave && onSave(trimmed)}
              disabled={!canSave}
              className="w-full sm:w-auto h-11 px-5 rounded-[8px] bg-[#0a0a0a] text-white text-[14px] font-semibold hover:bg-[#1f1f1f] disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
