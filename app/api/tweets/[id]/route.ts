import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";

// 刷新单条推文的互动数据
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const tweet = db.prepare("SELECT * FROM tweets WHERE id = ?").get(id) as any;
  if (!tweet) {
    return NextResponse.json({ error: "推文不存在" }, { status: 404 });
  }

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
      id
    );

    const updated = db.prepare("SELECT * FROM tweets WHERE id = ?").get(id) as any;

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
  const db = getDb();

  const result = db.prepare("DELETE FROM tweets WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "推文不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
