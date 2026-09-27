-- 9. User Usage Tracking Architecture (AI & TTS Quota / Monetization Foundation)
CREATE TABLE IF NOT EXISTS user_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    request_type TEXT NOT NULL, -- 'ai_starter', 'ai_branch', 'tts_narrate'
    units INTEGER DEFAULT 1,     -- tokens count or character count
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_usage_lookup ON user_usage(user_id, created_at);
