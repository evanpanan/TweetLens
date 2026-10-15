import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet, extractTweetId } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";
import { translateToChinese } from "@/lib/translator";
import { z } from "zod";

// 支持单条 url 字符串，或多条 urls 数组
const submitSchema = z
  .object({
    event_id: z.number().int().positive(),
    url: z.string().min(1).optional(),
    urls: z.array(z.string().min(1)).optional(),
    submitted_by: z.string().max(100).optional(),
  })
  .refine((data) => data.url || (data.urls && data.urls.length > 0), {
    message: "请提供至少一条推文链接",
    path: ["url"],
  });

// 解析单条推文并存储，返回标准化结果
async function processTweet(
  sql: any,
  eventId: number,
  url: string,
  submittedBy?: string
): Promise<{ success: boolean; tweet?: any; error?: string }> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return { success: false, error: `无法识别链接：${url}` };
  }

  // 检查是否已提交过
  const existing = await sql`
    SELECT id FROM tweets WHERE tweet_id = ${tweetId} AND event_id = ${eventId}
  `;
  if (existing.length > 0) {
    return { success: false, error: `已存在：${url}` };
  }

  // 抓取推文数据
  const data = await scrapeTweet(url);

  // 分析标签与情感
  const analysis = analyzeTweet(data.content);

  // 翻译为中文（异步，不阻塞主流程太久）
  const contentZh = await translateToChinese(data.content);

  // 存储到数据库
  const rows = await sql`
    INSERT INTO tweets
      (event_id, tweet_id, url, author_name, author_handle, author_avatar,
       author_verified, content, content_zh, posted_at, likes, retweets, replies,
       quotes, bookmarks, views, media, quoted_tweet, is_reply,
       tags, sentiment, sentiment_reason, submitted_by, source)
    VALUES
      (${eventId}, ${data.tweet_id}, ${data.url}, ${data.author_name},
       ${data.author_handle}, ${data.author_avatar},
       ${data.author_verified ? 1 : 0}, ${data.content}, ${contentZh}, ${data.posted_at},
       ${data.likes}, ${data.retweets}, ${data.replies},
       ${data.quotes}, ${data.bookmarks}, ${data.views},
       ${JSON.stringify(data.media)},
       ${data.quoted_tweet ? JSON.stringify(data.quoted_tweet) : null},
       ${data.is_reply ? 1 : 0},
       ${JSON.stringify(analysis.tags)}, ${analysis.sentiment},
       ${analysis.sentiment_reason}, ${submittedBy || null}, 'user')
    RETURNING *
  `;

  const tweet: any = rows[0];
  return {
    success: true,
    tweet: {
      ...tweet,
      author_verified: !!tweet.author_verified,
      is_reply: !!tweet.is_reply,
      media: JSON.parse(tweet.media || "[]"),
      quoted_tweet: tweet.quoted_tweet ? JSON.parse(tweet.quoted_tweet) : null,
      tags: JSON.parse(tweet.tags || "[]"),
      views: tweet.views === null ? null : tweet.views,
    },
  };
}

// 提交推文链接（支持单条或多条）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitSchema.parse(body);

    const sql = await getDb();

    // 检查事件是否存在
    const eventRows = await sql`SELECT id FROM events WHERE id = ${parsed.event_id}`;
    if (eventRows.length === 0) {
      return NextResponse.json({ error: "事件不存在" }, { status: 404 });
    }

    // 收集所有 URL（单条或多条）
    const urls: string[] = [];
    if (parsed.url) urls.push(parsed.url);
    if (parsed.urls) urls.push(...parsed.urls);

    // 去重
    const uniqueUrls = [...new Set(urls)];

    // 单条提交：返回旧格式保持兼容
    if (uniqueUrls.length === 1) {
      const result = await processTweet(sql, parsed.event_id, uniqueUrls[0], parsed.submitted_by);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ tweet: result.tweet }, { status: 201 });
    }

    // 多条提交：逐个处理，返回每条的结果
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const url of uniqueUrls) {
      try {
        const r = await processTweet(sql, parsed.event_id, url, parsed.submitted_by);
        if (r.success) {
          successCount++;
          results.push({ url, success: true, tweet: r.tweet });
        } else {
          failCount++;
          results.push({ url, success: false, error: r.error });
        }
      } catch (e: any) {
        failCount++;
        results.push({
          url,
          success: false,
          error: e?.code === "23505" ? "已存在" : e?.message || "处理失败",
        });
      }
    }

    return NextResponse.json(
      {
        results,
        success_count: successCount,
        fail_count: failCount,
        total: uniqueUrls.length,
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
    const message = error instanceof Error ? error.message : "提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
