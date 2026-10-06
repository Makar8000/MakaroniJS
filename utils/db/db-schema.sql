-- 1. HSR Inclination Subscriptions Table
CREATE TABLE IF NOT EXISTS hsr_subscriptions (
    user_id TEXT PRIMARY KEY
);

-- 2. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    unix_ts INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    channel_id TEXT,
    mention TEXT,
    message TEXT NOT NULL
);
