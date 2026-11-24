-- Apply during coordinated API deployment; old API requires content.
BEGIN;
ALTER TABLE coinpsi.knowledge_posts
 ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255),
 ADD COLUMN IF NOT EXISTS drive_url VARCHAR(1000),
 ADD COLUMN IF NOT EXISTS document_type VARCHAR(30) NOT NULL DEFAULT 'research',
 ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS publication_date DATE,
 ADD COLUMN IF NOT EXISTS views_count BIGINT NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS downloads_count BIGINT NOT NULL DEFAULT 0;
-- Legacy publications without a document must be re-registered before publishing.
UPDATE coinpsi.knowledge_posts SET status='draft', show_on_landing=FALSE, display_order=NULL WHERE drive_file_id IS NULL;
ALTER TABLE coinpsi.knowledge_posts DROP COLUMN IF EXISTS content;
ALTER TABLE coinpsi.knowledge_posts ADD CONSTRAINT knowledge_posts_published_drive_check CHECK (status <> 'published' OR (drive_file_id IS NOT NULL AND drive_url IS NOT NULL));
CREATE INDEX IF NOT EXISTS knowledge_catalog_idx ON coinpsi.knowledge_posts (published_at DESC, id DESC) WHERE status='published';
COMMIT;
