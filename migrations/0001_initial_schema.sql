-- Rabbit Hole Initial D1 Schema Migration

-- 1. Users Table (Maps to Firebase UID)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    photo_url TEXT,
    streak INTEGER DEFAULT 0,
    last_read_date TEXT,
    theme TEXT DEFAULT 'dark',
    onboarded INTEGER DEFAULT 0,
    schema_version INTEGER DEFAULT 2,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. User Interests Table
CREATE TABLE IF NOT EXISTS user_interests (
    user_id TEXT NOT NULL,
    interest_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, interest_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);

-- 3. Topics Table (System static topics + AI generated explore topics)
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    blurb TEXT,
    reading_time TEXT,
    cover_image TEXT,
    content_data TEXT,
    is_system INTEGER DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);

-- 4. Saved Topics (User Bookmarks)
CREATE TABLE IF NOT EXISTS saved_topics (
    user_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, topic_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_topics(user_id);

-- 5. Reading Sessions & History
CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    cards_read INTEGER DEFAULT 0,
    total_cards INTEGER DEFAULT 0,
    read_date TEXT NOT NULL,
    last_updated INTEGER NOT NULL,
    selected_prompt TEXT,
    cards_data TEXT,
    topic_snapshot TEXT,
    audio_url TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON reading_sessions(user_id, read_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON reading_sessions(user_id, last_updated DESC);

-- 6. Media & Audio Cache (R2 assets)
CREATE TABLE IF NOT EXISTS media_cache (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    source_url TEXT,
    content_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_type ON media_cache(type);
