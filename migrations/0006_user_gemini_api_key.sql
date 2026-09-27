-- Migration 0006: Add user-aligned Google Gemini API key to users table
ALTER TABLE users ADD COLUMN gemini_api_key TEXT;
