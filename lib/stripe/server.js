import "server-only";
import Stripe from "stripe";

let stripe;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripe ??= new Stripe(secretKey);
  return stripe;
}

export function getAppUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("APP_URL is not configured.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS outside local development.");
  }
  return url.origin;
}
