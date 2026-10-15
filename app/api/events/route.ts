import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

// 获取所有事件（含推文数量）
export async function GET() {
  const sql = await getDb();
  const events = await sql`
    SELECT e.*, COUNT(t.id)::int as tweet_count
    FROM events e
    LEFT JOIN tweets t ON t.event_id = e.id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;

  return NextResponse.json({ events });
}

const createSchema = z.object({
  title: z.string().min(1, "事件标题不能为空").max(200),
  description: z.string().max(2000).optional().default(""),
  cover_url: z.string().url("封面链接格式不正确").optional().or(z.literal("")),
});

// 创建事件
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);

    const sql = await getDb();
    const rows = await sql`
      INSERT INTO events (title, description, cover_url)
      VALUES (${parsed.title}, ${parsed.description}, ${parsed.cover_url || null})
      RETURNING *
    `;

    return NextResponse.json({ event: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数错误" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建事件失败" },
      { status: 500 }
    );
  }
}
