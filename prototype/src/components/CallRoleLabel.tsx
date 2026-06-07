import Pill from "./Pill";

interface CallRoleLabelProps {
  role: "both" | "caller" | "receiver";
}

function CallRoleLabel({ role }: CallRoleLabelProps) {
  if (role === "both") return <Pill tone="both">Caller + Receiver</Pill>;
  if (role === "caller") return <Pill tone="caller">Caller</Pill>;
  return <Pill tone="receiver">Receiver only</Pill>;
}

export default CallRoleLabel;
