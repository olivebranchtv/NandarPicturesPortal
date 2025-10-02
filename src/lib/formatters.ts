export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCurrency(value: number): string {
  return `$${roundToTwoDecimals(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function calculateDistributionFee(grossAmount: number): number {
  return roundToTwoDecimals(grossAmount * 0.25);
}

export function calculateNetAmount(grossAmount: number): number {
  const fee = calculateDistributionFee(grossAmount);
  return roundToTwoDecimals(grossAmount - fee);
}
