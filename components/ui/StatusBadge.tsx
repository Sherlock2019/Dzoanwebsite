import { statusTone } from "@/lib/options";

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (!status) return null;
  return <span className={`badge tone-${statusTone(status)}${className ? ` ${className}` : ""}`}>{status}</span>;
}
