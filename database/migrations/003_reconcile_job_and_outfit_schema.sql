-- Migration 003: reconcile the early migration baseline with the active ORM.
--
-- 001_initial_schema.sql predates the queue payload/result model used by the
-- worker.  This upgrade is safe for databases created from that baseline and
-- is a no-op for columns already present in the Docker initialization schema.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'recommendation_jobs' AND column_name = 'anchor_article_id'
    ) THEN
        ALTER TABLE recommendation_jobs ALTER COLUMN anchor_article_id DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE recommendation_jobs
    ADD COLUMN IF NOT EXISTS job_type VARCHAR(64);

ALTER TABLE recommendation_jobs
    ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE recommendation_jobs
    ADD COLUMN IF NOT EXISTS result JSONB;

ALTER TABLE recommendation_jobs
    ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE recommendation_jobs
SET job_type = COALESCE(job_type, 'outfit_synthesis');

ALTER TABLE recommendation_jobs
    ALTER COLUMN job_type SET NOT NULL;

ALTER TABLE outfit_items
    ADD COLUMN IF NOT EXISTS item_score REAL DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_jobs_user
    ON recommendation_jobs(user_id, created_at DESC);
