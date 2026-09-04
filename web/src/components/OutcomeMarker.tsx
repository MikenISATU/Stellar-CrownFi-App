import { Flag } from "@/components/Flag";
import { binaryOutcomeSymbol } from "@/lib/marketOptions";

export function OutcomeMarker({ label, flagCode, className = "" }: { label: string; flagCode?: string | null; className?: string }) {
  const binary = binaryOutcomeSymbol(label);
  if (binary === "yes") return <span aria-label="Yes" title="Yes" className={`font-bold text-emerald-600 ${className}`}>✓</span>;
  if (binary === "no") return <span aria-label="No" title="No" className={`font-bold text-rose-600 ${className}`}>✕</span>;
  return <Flag sash={flagCode} className={className} />;
}
