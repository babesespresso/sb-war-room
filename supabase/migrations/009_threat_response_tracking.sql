-- ============================================================
-- Add response_status to competitor_activities for feedback loop
-- Allows threats to be marked as resolved, improving Campaign Health score
-- ============================================================

-- Add response_status column with default 'unresolved'
ALTER TABLE competitor_activities
ADD COLUMN IF NOT EXISTS response_status TEXT
  CHECK (response_status IN ('unresolved', 'acknowledged', 'resolved'))
  DEFAULT NULL;

-- Add resolved_at timestamp
ALTER TABLE competitor_activities
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;

-- Add resolved_by (who resolved it)
ALTER TABLE competitor_activities
ADD COLUMN IF NOT EXISTS resolved_by TEXT DEFAULT NULL;

-- Index for efficient filtering of unresolved threats
CREATE INDEX IF NOT EXISTS idx_comp_activities_response_status
  ON competitor_activities(response_status)
  WHERE response_status IS NULL OR response_status = 'unresolved';

-- ============================================================
-- Social follower snapshots use the existing performance_metrics table.
-- No new table needed — performance_metrics already has:
--   followers INTEGER, followers_change INTEGER
--   with unique index on (tenant_id, metric_date, platform)
-- ============================================================
