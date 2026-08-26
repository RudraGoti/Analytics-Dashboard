CREATE TABLE "daily_expenses" (
	"id" serial PRIMARY KEY,
	"date" text NOT NULL UNIQUE,
	"counter" integer NOT NULL,
	"expenses" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
