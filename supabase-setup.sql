-- ============================================================
-- SNR Web App — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Family Tree table ────────────────────────────────────────
-- Stores the entire family tree as a single JSON blob per user
CREATE TABLE IF NOT EXISTS family_trees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Kids Tasks table ─────────────────────────────────────────
-- One row per task, keyed by the task's own UUID
CREATE TABLE IF NOT EXISTS kids_tasks (
  id         TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE family_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids_tasks   ENABLE ROW LEVEL SECURITY;

-- Family Tree policy: users can only access their own tree
CREATE POLICY "own family tree" ON family_trees
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Kids Tasks policy: users can only access their own tasks
CREATE POLICY "own kids tasks" ON kids_tasks
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Enable Realtime (for live cross-device sync) ─────────────
-- Run this after creating the tables:
ALTER PUBLICATION supabase_realtime ADD TABLE family_trees;

-- ── Unique index (ensures upsert on user_id works for family_trees) ──
CREATE UNIQUE INDEX IF NOT EXISTS family_trees_user_id_idx ON family_trees (user_id);

-- ── DONE ─────────────────────────────────────────────────────
-- Your tables are ready. Now update environment.ts with your
-- Supabase project URL and anon key, then run the Angular app.
