import postgres from "postgres";

// 从环境变量获取数据库连接字符串
// Vercel 连接 Supabase 时会自动注入 POSTGRES_URL
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    "[db] 未检测到 POSTGRES_URL 环境变量。请在 Vercel 项目中创建 Postgres 数据库并连接到本项目。"
  );
}

// 创建 sql 客户端
// - ssl: "require" 确保加密连接（Supabase 要求）
// - max: 1 serverless 环境下只保留一个连接
// - prepare: false 兼容 Supabase 的 PgBouncer（不支持 prepared statements）
// - connect_timeout: 连接超时 10 秒
const sql = postgres(DATABASE_URL || "postgresql://localhost:5432/placeholder", {
  ssl: "require",
  max: 1,
  prepare: false,
  connect_timeout: 10,
});

// Schema 初始化（只在每次冷启动时执行一次）
const initSchemaPromise = (async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cover_url TEXT,
        keywords TEXT NOT NULL DEFAULT '',
        auto_refresh BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tweets (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        tweet_id TEXT NOT NULL,
        url TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_handle TEXT NOT NULL,
        author_avatar TEXT,
        author_verified INTEGER NOT NULL DEFAULT 0,
        content TEXT NOT NULL,
        content_zh TEXT NOT NULL DEFAULT '',
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
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, tweet_id)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_tweets_event_id ON tweets(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at)`;

    // 迁移：为已存在的表添加 content_zh 列（翻译内容）
    try {
      await sql`ALTER TABLE tweets ADD COLUMN IF NOT EXISTS content_zh TEXT NOT NULL DEFAULT ''`;
    } catch {
      // 忽略已存在列的错误
    }

    // 迁移：为 events 表添加 keywords 和 auto_refresh 列
    try {
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT ''`;
    } catch {}
    try {
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS auto_refresh BOOLEAN NOT NULL DEFAULT false`;
    } catch {}
  } catch (err) {
    console.error("[db] Schema 初始化失败:", err);
    throw err;
  }
})();

/**
 * 获取数据库客户端（确保 schema 已初始化）
 */
export async function getDb() {
  await initSchemaPromise;
  return sql;
}

export { sql };
export default getDb;
