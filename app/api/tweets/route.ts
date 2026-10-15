import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet, extractTweetId } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";
import { z } from "zod";

const submitSchema = z.object({
  event_id: z.number().int().positive(),
  url: z.string().min(1, "推文链接不能为空"),
  submitted_by: z.string().max(100).optional(),
});

// 提交推文链接，抓取并存储
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitSchema.parse(body);

    const tweetId = extractTweetId(parsed.url);
    if (!tweetId) {
      return NextResponse.json(
        { error: "无法识别推文链接，请粘贴完整的推特/X 链接" },
        { status: 400 }
      );
    }

    const sql = await getDb();

    // 检查事件是否存在
    const eventRows = await sql`SELECT id FROM events WHERE id = ${parsed.event_id}`;
    if (eventRows.length === 0) {
      return NextResponse.json({ error: "事件不存在" }, { status: 404 });
    }

    // 检查是否已提交过
    const existingRows = await sql`
      SELECT id FROM tweets WHERE tweet_id = ${tweetId} AND event_id = ${parsed.event_id}
    `;
    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "该推文已在此事件中" },
        { status: 409 }
      );
    }

    // 抓取推文数据
    const data = await scrapeTweet(parsed.url);

    // 分析标签与情感
    const analysis = analyzeTweet(data.content);

    // 存储到数据库
    const rows = await sql`
      INSERT INTO tweets
        (event_id, tweet_id, url, author_name, author_handle, author_avatar,
         author_verified, content, posted_at, likes, retweets, replies,
         quotes, bookmarks, views, media, quoted_tweet, is_reply,
         tags, sentiment, sentiment_reason, submitted_by)
      VALUES
        (${parsed.event_id}, ${data.tweet_id}, ${data.url}, ${data.author_name},
         ${data.author_handle}, ${data.author_avatar},
         ${data.author_verified ? 1 : 0}, ${data.content}, ${data.posted_at},
         ${data.likes}, ${data.retweets}, ${data.replies},
         ${data.quotes}, ${data.bookmarks}, ${data.views},
         ${JSON.stringify(data.media)},
         ${data.quoted_tweet ? JSON.stringify(data.quoted_tweet) : null},
         ${data.is_reply ? 1 : 0},
         ${JSON.stringify(analysis.tags)}, ${analysis.sentiment},
         ${analysis.sentiment_reason}, ${parsed.submitted_by || null})
      RETURNING *
    `;

    const tweet: any = rows[0];

    return NextResponse.json(
      {
        tweet: {
          ...tweet,
          author_verified: !!tweet.author_verified,
          is_reply: !!tweet.is_reply,
          media: JSON.parse(tweet.media || "[]"),
          quoted_tweet: tweet.quoted_tweet ? JSON.parse(tweet.quoted_tweet) : null,
          tags: JSON.parse(tweet.tags || "[]"),
          views: tweet.views === null ? null : tweet.views,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数错误" },
        { status: 400 }
      );
    }
    // PostgreSQL 唯一约束冲突
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "该推文已在此事件中" },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
