import "server-only";

export function plusPriceId() {
  return process.env.STRIPE_PRICE_ID?.trim() || "price_1Ua5KUDpv9sPAKUVzVvp32dD";
}
