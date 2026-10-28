import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type Role = "CUSTOMER" | "TAXI_CAPTAIN" | "DELIVERY_CAPTAIN" | "MERCHANT";

// Pioneer accounts. Pi Network identity is the primary login (pi_uid); email/password is an optional fallback.
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  piUid: varchar("pi_uid", { length: 255 }).unique(),
  username: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 255 }).unique(),
  passwordHash: text("password_hash"),
  role: varchar({ length: 20 }).$type<Role>().notNull().default("CUSTOMER"),
  vipUntil: timestamp("vip_until", { withTimezone: true }),
  xpPoints: integer("xp_points").notNull().default(0),
  reputationScore: doublePrecision("reputation_score").notNull().default(5),
  ratingCount: integer("rating_count").notNull().default(0),
  walletBalancePi: doublePrecision("wallet_balance_pi").notNull().default(0),
  walletAddress: varchar("wallet_address", { length: 120 }),
  rideCoupons: integer("ride_coupons").notNull().default(0),
  language: varchar({ length: 5 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Taxi and delivery captain vehicles (one per captain and category).
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid().primaryKey().defaultRandom(),
    driverId: uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: varchar({ length: 20 }).$type<"TAXI" | "DELIVERY">().notNull(),
    transportType: varchar("transport_type", { length: 20 }).$type<"CAR" | "MOTORCYCLE" | "BICYCLE">().notNull(),
    plateNumber: varchar("plate_number", { length: 50 }),
    modelInfo: varchar("model_info", { length: 100 }),
    color: varchar({ length: 40 }),
    licenseNumber: varchar("license_number", { length: 80 }),
    documentsVerified: boolean("documents_verified").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_driver_category_idx").on(t.driverId, t.category)],
);

// Live availability and GPS position of captains.
export const captainStatus = pgTable(
  "captain_status",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    category: varchar({ length: 20 }).$type<"TAXI" | "DELIVERY">().notNull(),
    isOnline: boolean("is_online").notNull().default(false),
    lat: doublePrecision(),
    lng: doublePrecision(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("captain_status_online_idx").on(t.category, t.isOnline)],
);

export const merchants = pgTable("merchants", {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 150 }).notNull(),
  description: text().notNull().default(""),
  cuisine: varchar({ length: 60 }).notNull().default(""),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  address: varchar({ length: 255 }).notNull().default(""),
  openingTime: varchar("opening_time", { length: 5 }).notNull().default("09:00"),
  closingTime: varchar("closing_time", { length: 5 }).notNull().default("23:00"),
  isOpen: boolean("is_open").notNull().default(true),
  subscriptionType: varchar("subscription_type", { length: 30 })
    .$type<"MONTHLY_FIXED" | "COMMISSION_PERCENTAGE">()
    .notNull()
    .default("COMMISSION_PERCENTAGE"),
  commissionRate: doublePrecision("commission_rate").notNull().default(0.1),
  subscriptionPaidUntil: timestamp("subscription_paid_until", { withTimezone: true }),
  promoText: varchar("promo_text", { length: 200 }),
  rating: doublePrecision().notNull().default(5),
  ratingCount: integer("rating_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuItems = pgTable("menu_items", {
  id: uuid().primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  title: varchar({ length: 150 }).notNull(),
  description: text().notNull().default(""),
  ingredients: text().notNull().default(""),
  category: varchar({ length: 60 }).notNull().default(""),
  pricePi: doublePrecision("price_pi").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JobStatus =
  | "PENDING_PAYMENT"
  | "SEARCHING"
  | "PLACED"
  | "PREPARING"
  | "READY"
  | "ACCEPTED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type OrderItem = { menuItemId: string; title: string; quantity: number; unitPricePi: number };

// Taxi rides and food deliveries share one lifecycle table.
export const ordersAndRides = pgTable(
  "orders_and_rides",
  {
    id: uuid().primaryKey().defaultRandom(),
    serviceType: varchar("service_type", { length: 20 }).$type<"TAXI_RIDE" | "FOOD_DELIVERY">().notNull(),
    customerId: uuid("customer_id").notNull().references(() => users.id),
    providerId: uuid("provider_id").references(() => users.id),
    merchantId: uuid("merchant_id").references(() => merchants.id),
    vehicleType: varchar("vehicle_type", { length: 20 }),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupLabel: varchar("pickup_label", { length: 255 }),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffLabel: varchar("dropoff_label", { length: 255 }),
    distanceKm: doublePrecision("distance_km").notNull().default(0),
    durationMin: doublePrecision("duration_min").notNull().default(0),
    surgeMultiplier: doublePrecision("surge_multiplier").notNull().default(1),
    status: varchar({ length: 20 }).$type<JobStatus>().notNull().default("PENDING_PAYMENT"),
    items: jsonb().$type<OrderItem[]>(),
    subtotalPi: doublePrecision("subtotal_pi").notNull().default(0),
    deliveryFeePi: doublePrecision("delivery_fee_pi").notNull().default(0),
    discountPi: doublePrecision("discount_pi").notNull().default(0),
    farePi: doublePrecision("fare_pi").notNull(),
    tipPi: doublePrecision("tip_pi").notNull().default(0),
    isVip: boolean("is_vip").notNull().default(false),
    // Dispatch state: the captain currently holding the offer and who already passed on it.
    offeredTo: uuid("offered_to").references(() => users.id),
    offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),
    declinedCaptainIds: jsonb("declined_captain_ids").$type<string[]>().notNull().default([]),
    dispatchRound: integer("dispatch_round").notNull().default(0),
    customerRating: integer("customer_rating"),
    paymentIdentifier: varchar("payment_identifier", { length: 255 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jobs_customer_idx").on(t.customerId),
    index("jobs_provider_idx").on(t.providerId),
    index("jobs_merchant_idx").on(t.merchantId),
    index("jobs_status_idx").on(t.status),
  ],
);

export type PaymentPurpose = "RIDE" | "ORDER" | "TIP" | "VIP" | "MERCHANT_SUBSCRIPTION";

// Server-side record of every User-to-App payment. Fulfilment only happens after server completion.
export const payments = pgTable("payments", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  purpose: varchar({ length: 30 }).$type<PaymentPurpose>().notNull(),
  referenceId: uuid("reference_id"),
  amountPi: doublePrecision("amount_pi").notNull(),
  memo: varchar({ length: 255 }).notNull(),
  status: varchar({ length: 20 })
    .$type<"CREATED" | "APPROVED" | "COMPLETED" | "CANCELLED" | "FAILED">()
    .notNull()
    .default("CREATED"),
  piPaymentId: varchar("pi_payment_id", { length: 255 }).unique(),
  txid: varchar({ length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Internal Pi wallet ledger (earnings, refunds, payouts).
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountPi: doublePrecision("amount_pi").notNull(),
    kind: varchar({ length: 30 })
      .$type<"RIDE_EARNING" | "DELIVERY_EARNING" | "SALE_EARNING" | "TIP" | "REFUND" | "PAYOUT" | "PAYOUT_REVERSAL">()
      .notNull(),
    referenceId: uuid("reference_id"),
    note: varchar({ length: 255 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_tx_user_idx").on(t.userId)],
);

// App-to-User payouts of captain and merchant earnings.
export const payouts = pgTable("payouts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amountPi: doublePrecision("amount_pi").notNull(),
  status: varchar({ length: 20 }).$type<"REQUESTED" | "SENT" | "FAILED">().notNull().default("REQUESTED"),
  piPaymentId: varchar("pi_payment_id", { length: 255 }),
  txid: varchar({ length: 255 }),
  error: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Verified Pi rewarded-ad views; the unique ad id prevents replaying the same reward.
export const adRewards = pgTable("ad_rewards", {
  adId: varchar("ad_id", { length: 255 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  xpGranted: integer("xp_granted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
