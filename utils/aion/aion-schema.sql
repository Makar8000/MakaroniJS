-- 1. Tracked characters. Energy is a snapshot taken at updated_at (unix seconds); current energy is derived.
CREATE TABLE IF NOT EXISTS characters (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    owner_id TEXT NOT NULL,
    energy INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    member INTEGER NOT NULL CHECK (member IN (0, 1)),
    bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus BETWEEN 0 AND 2000),
    large_refills INTEGER NOT NULL DEFAULT 0 CHECK (large_refills >= 0),
    small_refills INTEGER NOT NULL DEFAULT 0 CHECK (small_refills >= 0)
);

-- 2. Cap reminders. One per (character, hours); last_notified_cap prevents re-sending for the same cap time.
CREATE TABLE IF NOT EXISTS odyle_reminders (
    character TEXT NOT NULL COLLATE NOCASE REFERENCES characters (name) ON DELETE CASCADE,
    hours INTEGER NOT NULL,
    last_notified_cap INTEGER,
    PRIMARY KEY (character, hours)
);

-- 3. The current season and ends_at (unix seconds).
CREATE TABLE IF NOT EXISTS season (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ends_at INTEGER NOT NULL
);
