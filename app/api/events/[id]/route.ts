import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Tweet, TweetMedia, QuotedTweet } from "@/lib/types";

// 获取单个事件及其所有推文（按时间线排序）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!event) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  const tweets = db
    .prepare(
      `SELECT * FROM tweets WHERE event_id = ? ORDER BY posted_at ASC`
    )
    .all(id) as any[];

  const parsedTweets: Tweet[] = tweets.map((t) => ({
    ...t,
    author_verified: !!t.author_verified,
    is_reply: !!t.is_reply,
    media: JSON.parse(t.media || "[]") as TweetMedia[],
    quoted_tweet: t.quoted_tweet
      ? (JSON.parse(t.quoted_tweet) as QuotedTweet)
      : null,
    tags: JSON.parse(t.tags || "[]") as string[],
    views: t.views === null ? null : t.views,
  }));

  const tweetCount = tweets.length;

  return NextResponse.json({
    event: { ...event, tweet_count: tweetCount },
    tweets: parsedTweets,
  });
}

// 删除事件
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const result = db.prepare("DELETE FROM events WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
