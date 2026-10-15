import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Tweet, TweetMedia, QuotedTweet } from "@/lib/types";

// 获取单个事件及其所有推文（按时间线排序）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  const events = await sql`SELECT * FROM events WHERE id = ${id}`;
  const event = events[0];
  if (!event) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  const tweets = await sql`
    SELECT * FROM tweets WHERE event_id = ${id} ORDER BY posted_at ASC
  `;

  const parsedTweets: Tweet[] = tweets.map((t: any) => ({
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

  return NextResponse.json({
    event: { ...event, tweet_count: tweets.length },
    tweets: parsedTweets,
  });
}

// 删除事件
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  const result = await sql`DELETE FROM events WHERE id = ${id}`;
  if (result.count === 0) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
