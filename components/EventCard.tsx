"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/scraper";

interface EventCardProps {
  event: {
    id: number;
    title: string;
    description: string;
    cover_url: string | null;
    auto_refresh?: boolean;
    created_at: string;
    tweet_count: number;
  };
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition hover:border-sky-500/50 hover:bg-zinc-900"
    >
      {event.cover_url && (
        <div className="h-32 w-full overflow-hidden bg-zinc-800">
          <img
            src={event.cover_url}
            alt={event.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-white transition group-hover:text-sky-400">
            {event.title}
          </h2>
          <span className="shrink-0 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400">
            {event.tweet_count} 条推文
          </span>
        </div>
        {event.description && (
          <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{event.description}</p>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          {event.auto_refresh && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              自动更新
            </span>
          )}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          创建于 {formatRelativeTime(event.created_at)}
        </div>
      </div>
    </Link>
  );
}
