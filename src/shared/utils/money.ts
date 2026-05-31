const arabicEgyptianFormatter = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
