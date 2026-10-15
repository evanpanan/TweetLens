import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";

// 刷新某个事件下的所有推文数据
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  const { rows: eventRows } = await sql`SELECT id FROM events WHERE id = ${id}`;
  if (eventRows.length === 0) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  const { rows: tweets } = await sql`
    SELECT id, tweet_id, url FROM tweets WHERE event_id = ${id}
  `;

  let success = 0;
  let failed = 0;

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
      success++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    refreshed: success,
    failed,
    total: tweets.length,
  });
}
