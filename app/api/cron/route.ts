import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";
import { translateToChinese } from "@/lib/translator";
import { searchTweets } from "@/lib/twitter-search";

// Vercel Cron 会带上 Authorization: Bearer {CRON_SECRET} 头
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 验证请求来源（Vercel Cron 会带 CRON_SECRET）
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 如果配置了 CRON_SECRET，则必须验证
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
  }

  const sql = await getDb();

  // 获取所有开启了自动更新的事件
  const events = await sql`
    SELECT id, title, keywords FROM events WHERE auto_refresh = true
  `;

  console.log(`[cron] 找到 ${events.length} 个开启自动更新的事件`);

  const results: any[] = [];

  for (const event of events as any[]) {
    const eventResult = {
      event_id: event.id,
      title: event.title,
      new_tweets: 0,
      refreshed: 0,
      errors: [] as string[],
    };

    try {
      // 1. 搜索新推文
      const keywords = event.keywords || event.title;
      const foundUrls = await searchTweets(keywords, 15);
      console.log(`[cron] 事件 "${event.title}" 搜索到 ${foundUrls.length} 条推文`);

      for (const url of foundUrls) {
        try {
          // 检查是否已存在
          const tweetId = url.match(/\/status\/(\d+)/)?.[1] || url.split("/").pop() || "";
          if (!tweetId) continue;
          const existing = await sql`
            SELECT id FROM tweets WHERE tweet_id = ${tweetId} AND event_id = ${event.id}
          `;
          if (existing.length > 0) continue;

          // 抓取并存储
          const data = await scrapeTweet(url);
          const analysis = analyzeTweet(data.content);
          const contentZh = await translateToChinese(data.content);

          await sql`
            INSERT INTO tweets
              (event_id, tweet_id, url, author_name, author_handle, author_avatar,
               author_verified, content, content_zh, posted_at, likes, retweets, replies,
               quotes, bookmarks, views, media, quoted_tweet, is_reply,
               tags, sentiment, sentiment_reason, source)
            VALUES
              (${event.id}, ${data.tweet_id}, ${data.url}, ${data.author_name},
               ${data.author_handle}, ${data.author_avatar},
               ${data.author_verified ? 1 : 0}, ${data.content}, ${contentZh}, ${data.posted_at},
               ${data.likes}, ${data.retweets}, ${data.replies},
               ${data.quotes}, ${data.bookmarks}, ${data.views},
               ${JSON.stringify(data.media)},
               ${data.quoted_tweet ? JSON.stringify(data.quoted_tweet) : null},
               ${data.is_reply ? 1 : 0},
               ${JSON.stringify(analysis.tags)}, ${analysis.sentiment},
               ${analysis.sentiment_reason}, 'auto')
          `;
          eventResult.new_tweets++;
        } catch (e: any) {
          // 唯一约束冲突或抓取失败，跳过
          if (e?.code !== "23505") {
            eventResult.errors.push(e?.message || "处理失败");
          }
        }
      }

      // 2. 刷新已有推文的互动数据（最近的 10 条，避免超时）
      const tweets = await sql`
        SELECT id, url FROM tweets WHERE event_id = ${event.id}
        ORDER BY created_at DESC LIMIT 10
      `;

      for (const tweet of tweets as any[]) {
        try {
          const data = await scrapeTweet(tweet.url);
          const analysis = analyzeTweet(data.content);

          await sql`
            UPDATE tweets SET
              likes = ${data.likes}, retweets = ${data.retweets},
              replies = ${data.replies}, quotes = ${data.quotes},
              bookmarks = ${data.bookmarks}, views = ${data.views},
              media = ${JSON.stringify(data.media)},
              quoted_tweet = ${data.quoted_tweet ? JSON.stringify(data.quoted_tweet) : null},
              tags = ${JSON.stringify(analysis.tags)},
              sentiment = ${analysis.sentiment},
              sentiment_reason = ${analysis.sentiment_reason},
              fetched_at = NOW()
            WHERE id = ${tweet.id}
          `;
          eventResult.refreshed++;
        } catch {
          // 单条刷新失败不影响其他
        }
      }
    } catch (e: any) {
      eventResult.errors.push(e?.message || "事件处理失败");
    }

    results.push(eventResult);
  }

  return NextResponse.json({
    success: true,
    processed: events.length,
    results,
  });
}
