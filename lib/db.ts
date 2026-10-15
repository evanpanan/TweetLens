import postgres from "postgres";

// 兼容多种数据库集成注入的环境变量名：
// - POSTGRES_URL / POSTGRES_URL_NON_POOLING：Vercel Postgres / Supabase 集成
// - DATABASE_URL / DATABASE_URL_UNPOOLED：Neon 集成
// - POSTGRES_PRISMA_URL：带连接池的 Prisma 兼容串
const DATABASE_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_PRISMA_URL;

if (!DATABASE_URL) {
  console.warn(
    "[db] 未检测到数据库连接串。请在 Vercel 项目的 Storage 中创建 Postgres 数据库并连接到本项目。"
  );
}

// 创建 sql 客户端
// - ssl: "require" 确保加密连接（Supabase 要求）
// - max: 1 serverless 环境下只保留一个连接
// - prepare: false 兼容 Supabase 的 PgBouncer（不支持 prepared statements）
// - connect_timeout: 连接超时 30 秒（避免冷启动时短暂超时）
// - idle_timeout: 空闲连接 10 秒后关闭，避免占用连接池
// - max_lifetime: 连接最大存活时间，避免长时间连接出问题
const sql = postgres(DATABASE_URL || "postgresql://localhost:5432/placeholder", {
  ssl: "require",
  max: 1,
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 10,
  max_lifetime: 60 * 30, // 30 分钟
});

// 重试工具：用于冷启动时连接数据库失败的情况
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[db] 连接重试 ${i + 1}/${maxRetries}: ${err instanceof Error ? err.message : err}`);
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// Schema 初始化（只在每次冷启动时执行一次，带重试）
const initSchemaPromise = withRetry(async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cover_url TEXT,
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
        source TEXT NOT NULL DEFAULT 'user',
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

    // 迁移：为 tweets 表添加 source 列（区分用户提交和自动抓取）
    try {
      await sql`ALTER TABLE tweets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'`;
    } catch {}
  } catch (err) {
    console.error("[db] Schema 初始化失败:", err);
    throw err;
  }
});

/**
 * 获取数据库客户端（确保 schema 已初始化）
 */
export async function getDb() {
  await initSchemaPromise;
  return sql;
}

export { sql };
export default getDb;
