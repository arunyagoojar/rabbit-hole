-- 7. Analytics Events Table (Admin aggregate performance & privacy-first tracking)
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id TEXT,
    topic_id TEXT,
    consume_mode TEXT,
    metadata TEXT,
    duration_seconds REAL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_topic_id ON analytics_events(topic_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
