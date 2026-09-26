-- 1. Global Configurations Table
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Participants Table
CREATE TABLE IF NOT EXISTS participants (
    discord_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pairings Table
CREATE TABLE IF NOT EXISTS pairings (
    santa_id TEXT PRIMARY KEY,
    receiver_id TEXT NOT NULL UNIQUE,
    gift_status TEXT NOT NULL DEFAULT 'NOT_SENT' CHECK (
      gift_status IN (
        'NOT_SENT',
        'SENT',
        'DELIVERED'
      )
    ),
    gift_status_timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (santa_id) REFERENCES participants (discord_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES participants (discord_id) ON DELETE CASCADE,
    CHECK (santa_id <> receiver_id)
);

-- 4. Restricted Pairs Table
CREATE TABLE IF NOT EXISTS restricted_pairs (
    giver_id TEXT,
    receiver_id TEXT,
    PRIMARY KEY (giver_id, receiver_id)
);

-- 5. Message History Table
CREATE TABLE IF NOT EXISTS message_history (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (
      direction IN (
        'SANTA_TO_RECEIVER',
        'RECEIVER_TO_SANTA',
        'SANTA_TO_PUBLIC'
      )
    ),
    original_content TEXT NOT NULL,
    processed_content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES participants (discord_id) ON DELETE CASCADE
);

