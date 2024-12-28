-- Create users table
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_username ON users(username);

-- Create clips table
DROP TABLE IF EXISTS clip;
CREATE TABLE clip (
    clip_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME,
    created_by_ip TEXT,
    user_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_expires_at ON clip(expires_at);
CREATE INDEX idx_created_by_ip_time ON clip(created_by_ip, created_at);
CREATE INDEX idx_user_clips ON clip(user_id);
