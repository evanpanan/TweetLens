import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";

// 刷新单条推文的互动数据
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  const tweetRows = await sql`SELECT * FROM tweets WHERE id = ${id}`;
  const tweet: any = tweetRows[0];
  if (!tweet) {
    return NextResponse.json({ error: "推文不存在" }, { status: 404 });
  }

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
      WHERE id = ${id}
    `;

    const updatedRows = await sql`SELECT * FROM tweets WHERE id = ${id}`;
    const updated: any = updatedRows[0];

    return NextResponse.json({
      tweet: {
        ...updated,
        author_verified: !!updated.author_verified,
        is_reply: !!updated.is_reply,
        media: JSON.parse(updated.media || "[]"),
        quoted_tweet: updated.quoted_tweet ? JSON.parse(updated.quoted_tweet) : null,
        tags: JSON.parse(updated.tags || "[]"),
        views: updated.views === null ? null : updated.views,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刷新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 删除推文
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  const result = await sql`DELETE FROM tweets WHERE id = ${id}`;
  if (result.count === 0) {
    return NextResponse.json({ error: "推文不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
