import { cn } from "@/lib/utils";
import { formatEGP } from "@/shared/utils/money";

export type PartyKind = "customer" | "supplier";

type BalanceTone = "debt" | "credit" | "settled";

type BalanceDescriptor = {
  tone: BalanceTone;
  label: string;
  amountMillieme: number;
};

/**
 * Translates a signed balance into a human-readable descriptor.
 *
 * The balance is stored signed (single source of truth); the UI never shows a
 * raw minus sign. A positive balance is an outstanding obligation (the customer
 * owes you / you owe the supplier) -> red; a negative balance is credit in the
 * other party's favor -> green; zero is settled -> neutral.
 */
export function describeBalance(
  balanceMillieme: number,
  kind: PartyKind = "customer",
): BalanceDescriptor {
  if (balanceMillieme === 0) {
    return { tone: "settled", label: "مسدّد", amountMillieme: 0 };
  }

  const isPositive = balanceMillieme > 0;
  const amountMillieme = Math.abs(balanceMillieme);

  if (kind === "customer") {
    return isPositive
      ? { tone: "debt", label: "عليه", amountMillieme }
      : { tone: "credit", label: "له", amountMillieme };
  }

  return isPositive
    ? { tone: "debt", label: "مستحق للمورد", amountMillieme }
    : { tone: "credit", label: "رصيد لك", amountMillieme };
}

const toneClasses: Record<BalanceTone, string> = {
  debt: "border-red-200 bg-red-50 text-red-700",
  credit: "border-emerald-200 bg-emerald-50 text-emerald-700",
  settled: "border-border bg-muted text-muted-foreground",
};

const dotClasses: Record<BalanceTone, string> = {
  debt: "bg-red-500",
  credit: "bg-emerald-500",
  settled: "bg-muted-foreground/40",
};

export function BalanceBadge({
  balanceMillieme,
  kind = "customer",
  className,
}: {
  balanceMillieme: number;
  kind?: PartyKind;
  className?: string;
}) {
  const { tone, label, amountMillieme } = describeBalance(balanceMillieme, kind);

  return (
    <span
      dir="rtl"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />
      {tone === "settled" ? label : `${label} ${formatEGP(amountMillieme)}`}
    </span>
  );
}
