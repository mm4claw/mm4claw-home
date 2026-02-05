-- Agent Identity Protocol Database Schema
-- D1 (SQLite) compatible

-- 身份表
CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,           -- base58 编码的公钥
    public_key BLOB NOT NULL,      -- 原始公钥 (32 bytes)
    metadata TEXT,                 -- JSON 格式的元数据
    created_at INTEGER NOT NULL,   -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL
);

-- VDM 评分历史表
CREATE TABLE IF NOT EXISTS vdm_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id TEXT NOT NULL,
    identity_score REAL NOT NULL,
    signal_score REAL NOT NULL,
    entropy_score REAL NOT NULL,
    compute_score REAL NOT NULL,
    level TEXT NOT NULL,
    calculated_at INTEGER NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

-- 背书记录表
CREATE TABLE IF NOT EXISTS endorsements (
    id TEXT PRIMARY KEY,           -- 唯一标识
    endorser_id TEXT NOT NULL,     -- 背书者身份 ID
    recipient_id TEXT NOT NULL,    -- 被背书者身份 ID
    score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
    signature BLOB NOT NULL,       -- 签名
    message TEXT,                  -- 可选消息
    created_at INTEGER NOT NULL,
    FOREIGN KEY (endorser_id) REFERENCES identities(id),
    FOREIGN KEY (recipient_id) REFERENCES identities(id)
);

-- 活动记录表（用于 VDM 计算）
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entropy REAL NOT NULL,
    compute REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_vdm_identity ON vdm_scores(identity_id);
CREATE INDEX IF NOT EXISTS idx_vdm_calculated ON vdm_scores(calculated_at);
CREATE INDEX IF NOT EXISTS idx_endorsements_recipient ON endorsements(recipient_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_endorser ON endorsements(endorser_id);
CREATE INDEX IF NOT EXISTS idx_activities_identity ON activities(identity_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
