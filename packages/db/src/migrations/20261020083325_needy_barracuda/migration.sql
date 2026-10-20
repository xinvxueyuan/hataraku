CREATE TABLE "login_attempts" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"email_hash" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ip_hash" text,
	"outcome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"body_md" text,
	"changes" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"highlight" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"released_at" date,
	"slug" text NOT NULL,
	"source_hash" text,
	"source_path" text,
	"title" text,
	"version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"avatar_key" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "micro_posts" (
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"image_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"music" jsonb,
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"slug" text NOT NULL,
	"source_hash" text,
	"source_path" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"type" text DEFAULT 'text' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"body_md" text,
	"cover" jsonb,
	"cover_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"link" text,
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"repo" text,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"status" text DEFAULT 'active' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"category" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"icon_key" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"level" integer DEFAULT 0 NOT NULL,
	"level_label" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"category" text DEFAULT 'dev' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"icon_key" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"link" text,
	"name" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_photos" (
	"album_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"height" integer,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"image_key" text NOT NULL,
	"slug" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"taken_at" timestamp with time zone,
	"thumb_key" text,
	"title" text,
	"width" integer
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"cover" jsonb,
	"cover_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"brand" text,
	"category" text DEFAULT 'gear' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"image_key" text,
	"link" text,
	"name" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"specs" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"image_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"location" text,
	"mood" text,
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"slug" text NOT NULL,
	"source_hash" text,
	"source_path" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"title" text,
	"weather" text
);
--> statement-breakpoint
CREATE TABLE "site_profile" (
	"author" text,
	"avatar_key" text,
	"avatar_url" text,
	"description" text,
	"email" text,
	"hero" jsonb,
	"id" integer PRIMARY KEY DEFAULT 1,
	"name" text NOT NULL,
	"name_en" text,
	"nav" jsonb,
	"social" jsonb,
	"tagline" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_profile_single_row" CHECK ("id" = 1)
);
--> statement-breakpoint
CREATE TABLE "timeline_entries" (
	"category" text DEFAULT 'milestone' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date,
	"description" text,
	"highlight" boolean DEFAULT false NOT NULL,
	"icon" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"link" text,
	"published" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_hash" text,
	"source_path" text,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"body_md" text,
	"category_id" uuid,
	"category_slug" text,
	"comment" boolean DEFAULT true NOT NULL,
	"cover" jsonb,
	"cover_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"draft" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"reading_minutes" integer,
	"slug" text NOT NULL,
	"source_hash" text,
	"source_path" text,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"body" text,
	"description" text,
	"post_id" uuid PRIMARY KEY,
	"published_at" timestamp with time zone,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"title" text NOT NULL,
	"tsv" tsvector
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"accent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" uuid,
	"tag_id" uuid,
	CONSTRAINT "post_tags_pkey" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"accent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_attempts_created_idx" ON "login_attempts" ("created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_created_idx" ON "login_attempts" ("email_hash","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_created_idx" ON "login_attempts" ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_outcome_created_idx" ON "login_attempts" ("outcome","created_at");--> statement-breakpoint
CREATE INDEX "changelog_entries_released_at_idx" ON "changelog_entries" ("released_at");--> statement-breakpoint
CREATE UNIQUE INDEX "changelog_entries_slug_key" ON "changelog_entries" ("slug");--> statement-breakpoint
CREATE INDEX "friends_sort_order_idx" ON "friends" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "friends_slug_key" ON "friends" ("slug");--> statement-breakpoint
CREATE INDEX "micro_posts_published_at_idx" ON "micro_posts" ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "micro_posts_slug_key" ON "micro_posts" ("slug");--> statement-breakpoint
CREATE INDEX "projects_featured_idx" ON "projects" ("featured");--> statement-breakpoint
CREATE INDEX "projects_sort_order_idx" ON "projects" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" ("slug");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" ("category");--> statement-breakpoint
CREATE INDEX "skills_sort_order_idx" ON "skills" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_key" ON "skills" ("slug");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" ("category");--> statement-breakpoint
CREATE INDEX "tools_sort_order_idx" ON "tools" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_slug_key" ON "tools" ("slug");--> statement-breakpoint
CREATE INDEX "album_photos_album_idx" ON "album_photos" ("album_id","sort_order");--> statement-breakpoint
CREATE INDEX "albums_date_idx" ON "albums" ("date");--> statement-breakpoint
CREATE INDEX "albums_sort_order_idx" ON "albums" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_slug_key" ON "albums" ("slug");--> statement-breakpoint
CREATE INDEX "devices_category_idx" ON "devices" ("category");--> statement-breakpoint
CREATE INDEX "devices_sort_order_idx" ON "devices" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_slug_key" ON "devices" ("slug");--> statement-breakpoint
CREATE INDEX "diary_entries_date_idx" ON "diary_entries" ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entries_slug_key" ON "diary_entries" ("slug");--> statement-breakpoint
CREATE INDEX "timeline_entries_date_idx" ON "timeline_entries" ("date");--> statement-breakpoint
CREATE INDEX "timeline_entries_sort_order_idx" ON "timeline_entries" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_entries_slug_key" ON "timeline_entries" ("slug");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" ("category_id");--> statement-breakpoint
CREATE INDEX "posts_draft_published_idx" ON "posts" ("draft","published");--> statement-breakpoint
CREATE INDEX "posts_published_at_idx" ON "posts" ("published_at");--> statement-breakpoint
CREATE INDEX "posts_views_idx" ON "posts" ("views");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_key" ON "posts" ("slug");--> statement-breakpoint
CREATE INDEX "search_index_published_at_idx" ON "search_index" ("published_at");--> statement-breakpoint
CREATE INDEX "search_index_tsv_gin" ON "search_index" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "categories_sort_order_idx" ON "categories" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" ("slug");--> statement-breakpoint
CREATE INDEX "post_tags_tag_idx" ON "post_tags" ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_key" ON "tags" ("slug");--> statement-breakpoint
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;