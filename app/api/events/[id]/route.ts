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

// 更新事件（切换自动更新开关等）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  // 检查事件是否存在
  const existing = await sql`SELECT id FROM events WHERE id = ${id}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  try {
    const body = await request.json();

    // 支持更新的字段
    const updates: string[] = [];
    const values: any[] = [];

    if (typeof body.auto_refresh === "boolean") {
      updates.push(`auto_refresh = $${updates.length + 1}`);
      values.push(body.auto_refresh);
    }

    if (typeof body.keywords === "string") {
      updates.push(`keywords = $${updates.length + 1}`);
      values.push(body.keywords);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
    }

    values.push(Number(id));
    const query = `UPDATE events SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`;
    const rows = await sql.unsafe(query, values);

    return NextResponse.json({ event: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "更新失败" },
      { status: 500 }
    );
  }
}
