import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";

// 刷新某个事件下的所有推文数据
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const event = db.prepare("SELECT id FROM events WHERE id = ?").get(id);
  if (!event) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  const tweets = db
    .prepare("SELECT id, tweet_id, url FROM tweets WHERE event_id = ?")
    .all(id) as { id: number; tweet_id: string; url: string }[];

  let success = 0;
  let failed = 0;

  for (const tweet of tweets) {
    try {
      const data = await scrapeTweet(tweet.url);
      const analysis = analyzeTweet(data.content);
      db.prepare(
        `UPDATE tweets SET
          likes = ?, retweets = ?, replies = ?, quotes = ?, bookmarks = ?,
          views = ?, media = ?, quoted_tweet = ?,
          tags = ?, sentiment = ?, sentiment_reason = ?,
          fetched_at = datetime('now')
         WHERE id = ?`
      ).run(
        data.likes,
        data.retweets,
        data.replies,
        data.quotes,
        data.bookmarks,
        data.views,
        JSON.stringify(data.media),
        data.quoted_tweet ? JSON.stringify(data.quoted_tweet) : null,
        JSON.stringify(analysis.tags),
        analysis.sentiment,
        analysis.sentiment_reason,
        tweet.id
      );
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
