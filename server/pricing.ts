import { and, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { captainStatus, ordersAndRides } from "../db/schema.js";
import { boundingBox, haversineKm } from "./geo.js";
import { roundPi } from "./http.js";

export type TransportType = "CAR" | "MOTORCYCLE" | "BICYCLE";

// Tariffs in Pi. Fare = (B + C_d * D + C_t * T) * S
export const TAXI_RATES: Record<"CAR" | "MOTORCYCLE", { base: number; perKm: number; perMin: number; speedKmh: number }> = {
  CAR: { base: 0.05, perKm: 0.02, perMin: 0.004, speedKmh: 30 },
  MOTORCYCLE: { base: 0.03, perKm: 0.012, perMin: 0.003, speedKmh: 35 },
};
export const DELIVERY_RATE = { base: 0.02, perKm: 0.01, perMin: 0.002, speedKmh: 25 };

export const ROAD_FACTOR = 1.3; // straight-line to road distance
export const VIP_RIDE_DISCOUNT = 0.1;
export const COUPON_RIDE_DISCOUNT = 0.1;
export const PLATFORM_RIDE_FEE = 0.1;
export const PLATFORM_DELIVERY_FEE = 0.1;
export const DEFAULT_COMMISSION_RATE = 0.1;
export const MIN_COMMISSION_RATE = 0.05;
export const MAX_COMMISSION_RATE = 0.15;
export const VIP_MONTHLY_FEE_PI = 1;
export const MERCHANT_MONTHLY_FEE_PI = 5;
export const MAX_SURGE = 2.5;
const SURGE_RADIUS_KM = 3;

export function routeMetrics(fromLat: number, fromLng: number, toLat: number, toLng: number, speedKmh: number) {
  const distanceKm = haversineKm(fromLat, fromLng, toLat, toLng) * ROAD_FACTOR;
  const durationMin = (distanceKm / speedKmh) * 60 + 2; // +2 min for pickup / traffic lights
  return { distanceKm: Math.round(distanceKm * 100) / 100, durationMin: Math.round(durationMin) };
}

// Approximates local time from longitude so peak hours apply without trusting the client clock.
function isPeakHour(lng: number, now = new Date()): boolean {
  const localHour = (now.getUTCHours() + Math.round(lng / 15) + 24) % 24;
  return (localHour >= 7 && localHour < 10) || (localHour >= 17 && localHour < 20);
}

/**
 * Adaptive surge multiplier S in [1.0, 2.5], driven by the ratio of open requests to
 * online captains within 3 km, plus a small bump during local rush hours.
 */
export async function surgeMultiplier(lat: number, lng: number, category: "TAXI" | "DELIVERY"): Promise<number> {
  const box = boundingBox(lat, lng, SURGE_RADIUS_KM);
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [openJobs, captains] = await Promise.all([
    db
      .select({ lat: ordersAndRides.pickupLat, lng: ordersAndRides.pickupLng })
      .from(ordersAndRides)
      .where(
        and(
          eq(ordersAndRides.serviceType, category === "TAXI" ? "TAXI_RIDE" : "FOOD_DELIVERY"),
          inArray(ordersAndRides.status, category === "TAXI" ? ["SEARCHING"] : ["PREPARING", "READY"]),
          gt(ordersAndRides.createdAt, since),
          gte(ordersAndRides.pickupLat, box.minLat),
          lte(ordersAndRides.pickupLat, box.maxLat),
          gte(ordersAndRides.pickupLng, box.minLng),
          lte(ordersAndRides.pickupLng, box.maxLng),
        ),
      ),
    db
      .select({ lat: captainStatus.lat, lng: captainStatus.lng })
      .from(captainStatus)
      .where(
        and(
          eq(captainStatus.category, category),
          eq(captainStatus.isOnline, true),
          gt(captainStatus.lastSeenAt, new Date(Date.now() - 60 * 1000)),
          gte(captainStatus.lat, box.minLat),
          lte(captainStatus.lat, box.maxLat),
          gte(captainStatus.lng, box.minLng),
          lte(captainStatus.lng, box.maxLng),
        ),
      ),
  ]);
  const within = (p: { lat: number | null; lng: number | null }) =>
    p.lat !== null && p.lng !== null && haversineKm(lat, lng, p.lat, p.lng) <= SURGE_RADIUS_KM;
  const demand = openJobs.filter(within).length + 1; // include the request being priced
  const supply = captains.filter(within).length;

  // With no captains online there is no one to rebalance, so the base multiplier applies.
  let surge = 1;
  if (supply > 0 && demand > supply) surge = 1 + 0.25 * (demand / supply - 1);
  if (isPeakHour(lng)) surge += 0.2;
  return Math.round(Math.min(MAX_SURGE, Math.max(1, surge)) * 100) / 100;
}

export async function estimateRide(opts: {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  vehicleType: "CAR" | "MOTORCYCLE";
  isVip: boolean;
  useCoupon: boolean;
}) {
  const rate = TAXI_RATES[opts.vehicleType];
  const { distanceKm, durationMin } = routeMetrics(
    opts.pickup.lat,
    opts.pickup.lng,
    opts.dropoff.lat,
    opts.dropoff.lng,
    rate.speedKmh,
  );
  const surge = await surgeMultiplier(opts.pickup.lat, opts.pickup.lng, "TAXI");
  const grossFare = (rate.base + rate.perKm * distanceKm + rate.perMin * durationMin) * surge;
  const discountRate = (opts.isVip ? VIP_RIDE_DISCOUNT : 0) + (opts.useCoupon ? COUPON_RIDE_DISCOUNT : 0);
  const discount = grossFare * discountRate;
  return {
    vehicleType: opts.vehicleType,
    distanceKm,
    durationMin,
    surgeMultiplier: surge,
    grossFarePi: roundPi(grossFare),
    discountPi: roundPi(discount),
    farePi: roundPi(Math.max(grossFare - discount, 0.01)),
    breakdown: { base: rate.base, perKm: rate.perKm, perMin: rate.perMin },
  };
}

export async function estimateDeliveryFee(opts: {
  merchant: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}) {
  const { distanceKm, durationMin } = routeMetrics(
    opts.merchant.lat,
    opts.merchant.lng,
    opts.dropoff.lat,
    opts.dropoff.lng,
    DELIVERY_RATE.speedKmh,
  );
  const surge = await surgeMultiplier(opts.merchant.lat, opts.merchant.lng, "DELIVERY");
  const fee = (DELIVERY_RATE.base + DELIVERY_RATE.perKm * distanceKm + DELIVERY_RATE.perMin * durationMin) * surge;
  return { distanceKm, durationMin, surgeMultiplier: surge, deliveryFeePi: roundPi(fee) };
}
