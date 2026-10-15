import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";
import { analyzeTweet } from "@/lib/analyzer";
import { translateToChinese } from "@/lib/translator";
import { searchTweets } from "@/lib/twitter-search";

// 主动搜索并添加当前事件的新推文（供客户端轮询调用）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sql = await getDb();

  // 获取事件信息
  const events = await sql`SELECT id, title, keywords FROM events WHERE id = ${id}`;
  const event = events[0] as any;
  if (!event) {
    return NextResponse.json({ error: "事件不存在" }, { status: 404 });
  }

  try {
    const keywords = event.keywords || event.title;
    const foundUrls = await searchTweets(keywords, 15);

    let newCount = 0;
    let skipped = 0;

    for (const url of foundUrls) {
      try {
        const tweetId = url.match(/\/status\/(\d+)/)?.[1] || url.split("/").pop() || "";
        if (!tweetId) continue;

        // 检查是否已存在
        const existing = await sql`
          SELECT id FROM tweets WHERE tweet_id = ${tweetId} AND event_id = ${event.id}
        `;
        if (existing.length > 0) {
          skipped++;
          continue;
        }

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
        newCount++;
      } catch (e: any) {
        if (e?.code !== "23505") {
          console.warn(`[search] 处理推文失败: ${e?.message || e}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      new_tweets: newCount,
      skipped,
      searched: foundUrls.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "搜索失败", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
