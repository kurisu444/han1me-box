export function parseVideoViewCount(text?: string | null): number {
  if (!text) return 0;
  const normalized = text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/,/g, '');
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return 0;
  const unit = normalized.match(/(?<=[0-9.])([万萬亿億KkMmWw])/)?.[1];
  return Math.round(Number(match[1]) * unitMultiplier(unit));
}

export function meetsMinimumVideoViews(
  text: string | null | undefined,
  minimumInTenThousands: number,
): boolean {
  return minimumInTenThousands <= 0 || parseVideoViewCount(text) >= minimumInTenThousands * 10000;
}

function unitMultiplier(unit?: string): number {
  switch (unit) {
    case '万':
    case '萬':
    case 'w':
    case 'W':
      return 10000;
    case '亿':
    case '億':
      return 100000000;
    case 'k':
    case 'K':
      return 1000;
    case 'm':
    case 'M':
      return 1000000;
    default:
      return 1;
  }
}
