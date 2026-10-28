CREATE TABLE "ad_rewards" (
	"ad_id" varchar(255) PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"xp_granted" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captain_status" (
	"user_id" uuid PRIMARY KEY,
	"category" varchar(20) NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"merchant_id" uuid NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"category" varchar(60) DEFAULT '' NOT NULL,
	"price_pi" double precision NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" uuid NOT NULL UNIQUE,
	"business_name" varchar(150) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cuisine" varchar(60) DEFAULT '' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"address" varchar(255) DEFAULT '' NOT NULL,
	"opening_time" varchar(5) DEFAULT '09:00' NOT NULL,
	"closing_time" varchar(5) DEFAULT '23:00' NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"subscription_type" varchar(30) DEFAULT 'COMMISSION_PERCENTAGE' NOT NULL,
	"commission_rate" double precision DEFAULT 0.1 NOT NULL,
	"subscription_paid_until" timestamp with time zone,
	"promo_text" varchar(200),
	"rating" double precision DEFAULT 5 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders_and_rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"service_type" varchar(20) NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider_id" uuid,
	"merchant_id" uuid,
	"vehicle_type" varchar(20),
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_label" varchar(255),
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_label" varchar(255),
	"distance_km" double precision DEFAULT 0 NOT NULL,
	"duration_min" double precision DEFAULT 0 NOT NULL,
	"surge_multiplier" double precision DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"items" jsonb,
	"subtotal_pi" double precision DEFAULT 0 NOT NULL,
	"delivery_fee_pi" double precision DEFAULT 0 NOT NULL,
	"discount_pi" double precision DEFAULT 0 NOT NULL,
	"fare_pi" double precision NOT NULL,
	"tip_pi" double precision DEFAULT 0 NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"offered_to" uuid,
	"offer_expires_at" timestamp with time zone,
	"declined_captain_ids" jsonb DEFAULT '[]' NOT NULL,
	"dispatch_round" integer DEFAULT 0 NOT NULL,
	"customer_rating" integer,
	"payment_identifier" varchar(255),
	"accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"purpose" varchar(30) NOT NULL,
	"reference_id" uuid,
	"amount_pi" double precision NOT NULL,
	"memo" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'CREATED' NOT NULL,
	"pi_payment_id" varchar(255) UNIQUE,
	"txid" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"amount_pi" double precision NOT NULL,
	"status" varchar(20) DEFAULT 'REQUESTED' NOT NULL,
	"pi_payment_id" varchar(255),
	"txid" varchar(255),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" varchar(64) PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pi_uid" varchar(255) UNIQUE,
	"username" varchar(100) NOT NULL,
	"email" varchar(255) UNIQUE,
	"password_hash" text,
	"role" varchar(20) DEFAULT 'CUSTOMER' NOT NULL,
	"vip_until" timestamp with time zone,
	"xp_points" integer DEFAULT 0 NOT NULL,
	"reputation_score" double precision DEFAULT 5 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"wallet_balance_pi" double precision DEFAULT 0 NOT NULL,
	"wallet_address" varchar(120),
	"ride_coupons" integer DEFAULT 0 NOT NULL,
	"language" varchar(5),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"driver_id" uuid NOT NULL,
	"category" varchar(20) NOT NULL,
	"transport_type" varchar(20) NOT NULL,
	"plate_number" varchar(50),
	"model_info" varchar(100),
	"color" varchar(40),
	"license_number" varchar(80),
	"documents_verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"amount_pi" double precision NOT NULL,
	"kind" varchar(30) NOT NULL,
	"reference_id" uuid,
	"note" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "captain_status_online_idx" ON "captain_status" ("category","is_online");--> statement-breakpoint
CREATE INDEX "jobs_customer_idx" ON "orders_and_rides" ("customer_id");--> statement-breakpoint
CREATE INDEX "jobs_provider_idx" ON "orders_and_rides" ("provider_id");--> statement-breakpoint
CREATE INDEX "jobs_merchant_idx" ON "orders_and_rides" ("merchant_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "orders_and_rides" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_driver_category_idx" ON "vehicles" ("driver_id","category");--> statement-breakpoint
CREATE INDEX "wallet_tx_user_idx" ON "wallet_transactions" ("user_id");--> statement-breakpoint
ALTER TABLE "ad_rewards" ADD CONSTRAINT "ad_rewards_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "captain_status" ADD CONSTRAINT "captain_status_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_merchant_id_merchants_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders_and_rides" ADD CONSTRAINT "orders_and_rides_customer_id_users_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders_and_rides" ADD CONSTRAINT "orders_and_rides_provider_id_users_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders_and_rides" ADD CONSTRAINT "orders_and_rides_merchant_id_merchants_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id");--> statement-breakpoint
ALTER TABLE "orders_and_rides" ADD CONSTRAINT "orders_and_rides_offered_to_users_id_fkey" FOREIGN KEY ("offered_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_users_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;