CREATE TABLE "api_tokens" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"last_used_at" timestamp with time zone,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"token_hash" text NOT NULL UNIQUE
);
