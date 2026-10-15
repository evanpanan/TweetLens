import type { ScrapeResult, TweetMedia, QuotedTweet } from "./types";

/**
 * 从推特 URL 中提取 tweet ID
 * 支持格式:
 *   https://twitter.com/user/status/123456789
 *   https://x.com/user/status/123456789
 *   https://mobile.twitter.com/user/status/123456789
 */
export function extractTweetId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const match = u.pathname.match(/\/status\/(\d+)/);
    if (match) return match[1];
    // 也支持直接传 ID
    if (/^\d+$/.test(url.trim())) return url.trim();
    return null;
  } catch {
    // 非 URL 格式，尝试纯数字
    if (/^\d+$/.test(url.trim())) return url.trim();
    return null;
  }
}

// FxTwitter API 响应类型
interface FxAuthor {
  screen_name: string;
  name: string;
  avatar_url?: string;
  followers?: number;
  verification?: { verified?: boolean };
}

interface FxMediaItem {
  type: string;
  url: string;
  width?: number;
  height?: number;
  thumbnail_url?: string;
}

interface FxTweet {
  id: string;
  url: string;
  text: string;
  author: FxAuthor;
  replies?: number;
  retweets?: number;
  likes?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number | null;
  created_at: string;
  media?: { all?: FxMediaItem[]; photos?: FxMediaItem[]; videos?: FxMediaItem[] };
  quoted_tweet?: FxTweet;
  replying_to_status?: string | null;
}

interface FxResponse {
  code: number;
  message: string;
  tweet: FxTweet | null;
}

function parseMedia(tweet: FxTweet): TweetMedia[] {
  const media: TweetMedia[] = [];
  const seen = new Set<string>();

  const items = tweet.media?.all || tweet.media?.photos || tweet.media?.videos || [];

  for (const m of items) {
    if (seen.has(m.url)) continue;
    seen.add(m.url);

    const type = m.type;
    if (type === "photo") {
      media.push({ type: "photo", url: m.url, width: m.width, height: m.height });
    } else if (type === "video") {
      media.push({
        type: "video",
        url: m.url,
        thumbnail_url: m.thumbnail_url,
        width: m.width,
        height: m.height,
      });
    } else if (type === "gif") {
      media.push({ type: "gif", url: m.url, width: m.width, height: m.height });
    }
  }

  return media;
}

function parseQuotedTweet(qt: FxTweet | undefined): QuotedTweet | null {
  if (!qt || !qt.id) return null;
  return {
    tweet_id: qt.id,
    author_name: qt.author?.name || "Unknown",
    author_handle: qt.author?.screen_name || "unknown",
    content: qt.text || "",
    posted_at: qt.created_at,
  };
}

/**
 * 通过 FxTwitter 公开 API 抓取单条推文数据
 * 免费、免登录、免 API Key
 * 数据源: https://api.fxtwitter.com/status/{tweetId}
 */
export async function scrapeTweet(url: string): Promise<ScrapeResult> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error("无法从链接中提取推文 ID，请检查链接格式");
  }

  const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error("网络连接失败，无法获取推文数据，请稍后重试");
  }

  if (!res.ok) {
    if (res.status === 404) throw new Error("推文不存在或已被删除");
    if (res.status === 429) throw new Error("请求过于频繁，请稍后再试");
    throw new Error(`抓取失败 (HTTP ${res.status})，请稍后重试`);
  }

  let data: FxResponse;
  try {
    data = (await res.json()) as FxResponse;
  } catch {
    throw new Error("解析推文数据失败");
  }

  if (data.code !== 200 || !data.tweet) {
    if (data.code === 404) throw new Error("推文不存在或已被删除");
    throw new Error(`抓取失败：${data.message || "未知错误"}`);
  }

  const t = data.tweet;
  const handle = t.author?.screen_name || "unknown";

  const result: ScrapeResult = {
    tweet_id: t.id,
    url: t.url || `https://x.com/${handle}/status/${t.id}`,
    author_name: t.author?.name || "Unknown",
    author_handle: handle,
    author_avatar: t.author?.avatar_url || null,
    author_verified: !!t.author?.verification?.verified,
    content: t.text || "",
    posted_at: t.created_at,
    likes: t.likes ?? 0,
    retweets: t.retweets ?? 0,
    replies: t.replies ?? 0,
    quotes: t.quotes ?? 0,
    bookmarks: t.bookmarks ?? 0,
    views: t.views ?? null,
    media: parseMedia(t),
    quoted_tweet: parseQuotedTweet(t.quoted_tweet),
    is_reply: !!t.replying_to_status,
  };

  return result;
}

/**
 * 格式化数字（如 1.2K, 3.4M）
 */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0";
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, "") + "M";
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
}

/**
 * 格式化时间为相对时间（如 "2小时前"）
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * 格式化完整日期时间
 */
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
