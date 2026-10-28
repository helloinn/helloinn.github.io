import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { captainStatus, ordersAndRides, vehicles } from "../db/schema.js";
import { boundingBox, haversineKm } from "./geo.js";

export type Job = typeof ordersAndRides.$inferSelect;

export const OFFER_SECONDS = 15;
export const SEARCH_RADII_KM = [3, 5, 8]; // start at 3 km and widen only if nobody is available
const CAPTAIN_ACTIVE_SECONDS = 45;

// States in which a captain is actively working a job.
export const BUSY_STATUSES = ["ACCEPTED", "ARRIVED", "IN_PROGRESS", "PREPARING", "READY"] as const;

export function needsCaptain(job: Job): boolean {
  if (job.providerId) return false;
  if (job.serviceType === "TAXI_RIDE") return job.status === "SEARCHING";
  return job.status === "PREPARING" || job.status === "READY";
}

/**
 * Offers a job to the nearest eligible captain for 15 seconds. When an offer times out or is
 * declined, that captain is skipped and the next closest one is offered the job.
 */
export async function dispatchJob(jobId: string): Promise<Job | undefined> {
  const [job] = await db.select().from(ordersAndRides).where(eq(ordersAndRides.id, jobId)).limit(1);
  if (!job || !needsCaptain(job)) return job;
  if (job.offeredTo && job.offerExpiresAt && job.offerExpiresAt.getTime() > Date.now()) return job;

  const skipped = new Set(job.declinedCaptainIds);
  if (job.offeredTo) skipped.add(job.offeredTo); // timed out without answering

  const category = job.serviceType === "TAXI_RIDE" ? "TAXI" : "DELIVERY";
  const maxRadius = SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1];
  const box = boundingBox(job.pickupLat, job.pickupLng, maxRadius);

  const candidates = await db
    .select({ userId: captainStatus.userId, lat: captainStatus.lat, lng: captainStatus.lng })
    .from(captainStatus)
    .innerJoin(vehicles, and(eq(vehicles.driverId, captainStatus.userId), eq(vehicles.category, category)))
    .where(
      and(
        eq(captainStatus.category, category),
        eq(captainStatus.isOnline, true),
        gt(captainStatus.lastSeenAt, new Date(Date.now() - CAPTAIN_ACTIVE_SECONDS * 1000)),
        gte(captainStatus.lat, box.minLat),
        lte(captainStatus.lat, box.maxLat),
        gte(captainStatus.lng, box.minLng),
        lte(captainStatus.lng, box.maxLng),
        job.serviceType === "TAXI_RIDE" && job.vehicleType ? eq(vehicles.transportType, job.vehicleType as "CAR") : undefined,
      ),
    );

  const ranked = candidates
    .filter((c) => !skipped.has(c.userId) && c.lat !== null && c.lng !== null)
    .map((c) => ({ ...c, distanceKm: haversineKm(job.pickupLat, job.pickupLng, c.lat!, c.lng!) }))
    .filter((c) => c.distanceKm <= maxRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  let next: (typeof ranked)[number] | undefined;
  if (ranked.length) {
    const busy = await busyCaptains(
      ranked.map((c) => c.userId),
      job.id,
    );
    const free = ranked.filter((c) => !busy.has(c.userId));
    for (const radius of SEARCH_RADII_KM) {
      next = free.find((c) => c.distanceKm <= radius);
      if (next) break;
    }
  }

  // Optimistic concurrency: only update if nobody else re-dispatched this job in the meantime.
  const [updated] = await db
    .update(ordersAndRides)
    .set({
      offeredTo: next?.userId ?? null,
      offerExpiresAt: next ? new Date(Date.now() + OFFER_SECONDS * 1000) : null,
      declinedCaptainIds: [...skipped],
    })
    .where(
      and(
        eq(ordersAndRides.id, job.id),
        isNull(ordersAndRides.providerId),
        job.offeredTo ? eq(ordersAndRides.offeredTo, job.offeredTo) : isNull(ordersAndRides.offeredTo),
      ),
    )
    .returning();
  return updated ?? job;
}

async function busyCaptains(captainIds: string[], excludeJobId: string): Promise<Set<string>> {
  const rows = await db
    .select({ providerId: ordersAndRides.providerId, offeredTo: ordersAndRides.offeredTo })
    .from(ordersAndRides)
    .where(
      and(
        ne(ordersAndRides.id, excludeJobId),
        or(
          and(inArray(ordersAndRides.providerId, captainIds), inArray(ordersAndRides.status, [...BUSY_STATUSES])),
          and(inArray(ordersAndRides.offeredTo, captainIds), gt(ordersAndRides.offerExpiresAt, new Date())),
        ),
      ),
    );
  const busy = new Set<string>();
  for (const r of rows) {
    if (r.providerId) busy.add(r.providerId);
    if (r.offeredTo) busy.add(r.offeredTo);
  }
  return busy;
}

/**
 * Advances dispatch for jobs whose offer has lapsed (or that have no offer yet).
 * VIP jobs are processed first so they get priority matching during busy periods.
 */
export async function sweepDispatch(category: "TAXI" | "DELIVERY") {
  const stale = await db
    .select({ id: ordersAndRides.id })
    .from(ordersAndRides)
    .where(
      and(
        isNull(ordersAndRides.providerId),
        category === "TAXI"
          ? and(eq(ordersAndRides.serviceType, "TAXI_RIDE"), eq(ordersAndRides.status, "SEARCHING"))
          : and(eq(ordersAndRides.serviceType, "FOOD_DELIVERY"), inArray(ordersAndRides.status, ["PREPARING", "READY"])),
        or(isNull(ordersAndRides.offerExpiresAt), lt(ordersAndRides.offerExpiresAt, new Date())),
      ),
    )
    .orderBy(desc(ordersAndRides.isVip), asc(ordersAndRides.createdAt))
    .limit(20);
  for (const { id } of stale) await dispatchJob(id);
}

export async function restartSearch(jobId: string) {
  await db
    .update(ordersAndRides)
    .set({ declinedCaptainIds: [], offeredTo: null, offerExpiresAt: null, dispatchRound: sql`${ordersAndRides.dispatchRound} + 1` })
    .where(and(eq(ordersAndRides.id, jobId), isNull(ordersAndRides.providerId)));
  return dispatchJob(jobId);
}
