-- Store complete structured action context for the operations audit trail.
-- SQLite accepts any string length; its migration runner safely skips the
-- PostgreSQL-specific ALTER statement while PostgreSQL applies it directly.
ALTER TABLE user_interactions
    ALTER COLUMN context TYPE TEXT;
