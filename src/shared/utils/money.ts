const arabicEgyptianFormatter = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const arabicPercentFormatter = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const arabicIntegerFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 0,
});

// For chart axis ticks: the app renders charts in a forced dir="ltr"
// container (recharts doesn't lay out RTL well), but every other number in
// the UI uses Arabic-Indic digits — this keeps axis ticks consistent with
// that.
export function formatAxisNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return arabicIntegerFormatter.format(value);
}

export function toMillieme(input: string | number): number {
  if (typeof input === "string") {
    const trimmed = input.trim();

    if (trimmed === "") {
      return 0;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
      throw new Error("Invalid money value");
    }

    return Math.round(parsed * 1000);
  }

  if (!Number.isFinite(input)) {
    throw new Error("Invalid money value");
  }

  return Math.round(input * 1000);
}

export function formatEGP(milliemes: number): string {
  if (!Number.isFinite(milliemes)) {
    throw new Error("Invalid money value");
  }

  const egpValue = milliemes / 1000;
  return `${arabicEgyptianFormatter.format(egpValue)}`;
}

// `value` is a percentage already (e.g. 20.4 for 20.40%), matching the
// backend's `*_percent` fields — kept separate from Intl's `style: "percent"`
// which expects a 0-1 ratio.
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid percent value");
  }

  return `${arabicPercentFormatter.format(value)}%`;
}
