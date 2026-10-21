-- H48: two_factor never reached every database, and the migration record cannot re-run it.
--
-- 20261020085105_wonderful_swordsman created this table. The hand-written
-- 20261020090000_search_index_fulltext snapshot that followed had lost its entries, so every
-- drizzle-kit generate re-emitted them; that root cause is fixed (the snapshot carries them
-- again). But a database whose __drizzle_migrations already records wonderful_swordsman never
-- re-runs it, so a database that lost the table -- restored from an older backup, migrated
-- from an earlier copy of that migration file, or simply never applied it -- would stay
-- without it, and every two-factor enrolment would fail at the first write.
--
-- This migration is idempotent: where the table exists it changes nothing, and where it does
-- not it restores exactly the shape in packages/db/src/schema/auth.ts (the Better Auth
-- twoFactor plugin's own model).
CREATE TABLE IF NOT EXISTS "two_factor" (
	"backup_codes" text NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY,
	"locked_until" timestamp with time zone,
	"secret" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" ("secret");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_user_id_idx" ON "two_factor" ("user_id");
--> statement-breakpoint
-- A constraint has no IF NOT EXISTS, so the catalog is asked first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'two_factor_user_id_user_id_fkey'
      AND conrelid = 'public.two_factor'::regclass
  ) THEN
    ALTER TABLE "two_factor"
      ADD CONSTRAINT "two_factor_user_id_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
