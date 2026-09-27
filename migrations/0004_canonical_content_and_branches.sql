-- 7. Canonical Topic Content (Reusable across all users)
CREATE TABLE IF NOT EXISTS topic_content (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL UNIQUE,
    overview TEXT,
    sections_data TEXT NOT NULL,
    questions_data TEXT NOT NULL,
    audio_chunks_data TEXT,
    version INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_topic_content_topic ON topic_content(topic_id);

-- 8. Reusable Topic Branches (Curiosity questions explored across users)
CREATE TABLE IF NOT EXISTS topic_branches (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    content_data TEXT NOT NULL,
    questions_data TEXT NOT NULL,
    audio_chunks_data TEXT,
    times_used INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    UNIQUE(topic_id, prompt_hash),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_topic_branches_lookup ON topic_branches(topic_id, prompt_hash);
