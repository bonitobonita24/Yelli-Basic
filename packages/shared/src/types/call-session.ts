import type { CallRole, EndReason } from "./enums";

export interface CallSession {
  id: string;
  tenantId: string;
  callerDeviceId: string;
  calleeDeviceId: string;
  callerRoleAtCall: CallRole;
  calleeRoleAtCall: CallRole;
  startedAt: Date;
  connectedAt: Date | null;
  endedAt: Date;
  durationSec: number | null;
  endReason: EndReason;
}
