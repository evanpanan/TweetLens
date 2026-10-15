import Link from "next/link";
import { getDb } from "@/lib/db";
import EventCard from "@/components/EventCard";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let events: Event[] = [];
  let dbError = "";

  try {
    const sql = await getDb();
    const { rows } = await sql`
      SELECT e.*, COUNT(t.id)::int as tweet_count
      FROM events e
      LEFT JOIN tweets t ON t.event_id = e.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;
    events = rows as Event[];
  } catch (err) {
    dbError =
      err instanceof Error ? err.message : "数据库连接失败";
  }

  if (dbError) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
          <svg className="h-6 w-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-amber-300">数据库未配置</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-amber-200/80">
          请在 Vercel 项目中创建 Postgres 数据库并连接到本项目。
          进入 Vercel Dashboard → 你的项目 → Storage → Create Database → Postgres，
          创建后自动注入 <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs">POSTGRES_URL</code> 环境变量，然后重新部署即可。
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
          实时梳理 · 免费抓取
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          把重要事件的推特
          <br />
          <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            按时间线串起来
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
          任何人都可以创建事件、提交推文链接。系统自动抓取点赞、转发、评论等互动数据，按发布时间线呈现事件全貌。
        </p>
      </section>

      {/* 事件列表 */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            全部事件
            <span className="ml-2 text-sm font-normal text-zinc-500">({events.length})</span>
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">还没有事件</p>
            <p className="mt-1 text-xs text-zinc-600">点击「创建事件」开始梳理你的第一条时间线</p>
            <Link
              href="/events/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              创建事件
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
