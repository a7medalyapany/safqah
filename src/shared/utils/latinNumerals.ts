/**
 * Convert Arabic-Indic numerals to Latin numerals (0-9)
 * Used for print-friendly output where consistent formatting is needed
 */

const arabicToLatinMap: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function arabicToLatin(arabicStr: string): string {
  if (!arabicStr) return '';
  return arabicStr.replace(/[٠-٩]/g, (digit) => arabicToLatinMap[digit] || digit);
}

/**
 * Format number as Latin numerals with 2 decimal places
 */
export function formatLatinNumeral(num: number): string {
  if (!Number.isFinite(num)) {
    return '0.00';
  }
  return (num / 1000).toFixed(2);
}

/**
 * Format currency value to Latin numerals
 */
export function formatCurrencyLatin(milliemes: number): string {
  if (!Number.isFinite(milliemes)) {
    return '0.00';
  }
  const egpValue = milliemes / 1000;
  return egpValue.toFixed(2);
}
