export function formatPriceTTC(prixHT: number): string {
  const ttc = prixHT * 1.2;
  return ttc.toFixed(2).replace(".", ",") + " €";
}

export function formatPriceTTCNumber(prixHT: number): number {
  return Math.round(prixHT * 1.2 * 100) / 100;
}