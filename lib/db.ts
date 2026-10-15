import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      tweet_id TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      author_avatar TEXT,
      author_verified INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      retweets INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      bookmarks INTEGER NOT NULL DEFAULT 0,
      views INTEGER,
      media TEXT NOT NULL DEFAULT '[]',
      quoted_tweet TEXT,
      is_reply INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      sentiment TEXT NOT NULL DEFAULT 'neutral',
      sentiment_reason TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE(event_id, tweet_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tweets_event_id ON tweets(event_id);
    CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
  `);

  // 迁移：为旧表添加新字段（如果不存在）
  const columns = db.prepare("PRAGMA table_info(tweets)").all() as { name: string }[];
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes("tags")) {
    db.exec("ALTER TABLE tweets ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  }
  if (!colNames.includes("sentiment")) {
    db.exec("ALTER TABLE tweets ADD COLUMN sentiment TEXT NOT NULL DEFAULT 'neutral'");
  }
  if (!colNames.includes("sentiment_reason")) {
    db.exec("ALTER TABLE tweets ADD COLUMN sentiment_reason TEXT NOT NULL DEFAULT ''");
  }
}

export default getDb;
