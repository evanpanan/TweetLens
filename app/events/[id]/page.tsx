"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import TweetCard from "@/components/TweetCard";
import type { Tweet } from "@/lib/types";
import { formatRelativeTime } from "@/lib/scraper";

interface EventDetail {
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  keywords: string;
  auto_refresh: boolean;
  created_at: string;
  tweet_count: number;
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [togglingAutoRefresh, setTogglingAutoRefresh] = useState(false);
  const [error, setError] = useState("");

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (res.ok) {
        setEvent(data.event);
        setTweets(data.tweets);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // 客户端自动轮询：如果开启了自动更新，每 2.5 分钟自动刷新页面数据
  useEffect(() => {
    if (!event?.auto_refresh) return;
    const interval = setInterval(() => {
      fetchEvent();
    }, 2.5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [event?.auto_refresh, fetchEvent]);

  // 切换自动更新开关
  const handleToggleAutoRefresh = async () => {
    if (!event || togglingAutoRefresh) return;
    setTogglingAutoRefresh(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_refresh: !event.auto_refresh }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
      }
    } finally {
      setTogglingAutoRefresh(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = eventId;
    if (!submitUrl.trim()) {
      setSubmitError("请输入推文链接");
      return;
    }

    // 解析多条链接（支持换行、逗号、空格分隔）
    const urls = submitUrl
      .split(/[\n,;\s]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      setSubmitError("请输入推文链接");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await fetch("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(id),
          urls,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "提交失败");
      }

      // 多条提交的返回格式
      if (data.results) {
        const success = data.success_count || 0;
        const fail = data.fail_count || 0;
        if (fail > 0) {
          const failDetails = data.results
            .filter((r: any) => !r.success)
            .map((r: any) => r.error)
            .join("；");
          setSubmitError(`成功 ${success} 条，失败 ${fail} 条：${failDetails}`);
        } else {
          setSubmitSuccess(`成功添加 ${success} 条推文到时间线！`);
        }
      } else {
        // 单条提交（向后兼容）
        setSubmitSuccess("推文已添加到时间线！");
      }

      setSubmitUrl("");
      await fetchEvent();
      setTimeout(() => {
        setSubmitSuccess("");
        setSubmitError("");
      }, 5000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async (tweetId: number) => {
    await fetch(`/api/tweets/${tweetId}`, { method: "POST" });
    await fetchEvent();
  };

  const handleDelete = async (tweetId: number) => {
    if (!confirm("确定要移除这条推文吗？")) return;
    await fetch(`/api/tweets/${tweetId}`, { method: "DELETE" });
    await fetchEvent();
  };

  const handleDeleteEvent = async () => {
    if (!confirm("确定要删除这个事件吗？所有推文也会被删除。")) return;
    await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    router.push("/");
  };

  const handleRefreshAll = async () => {
    if (refreshingAll) return;
    setRefreshingAll(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/refresh`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await fetchEvent();
        if (data.failed > 0) {
          setError(`刷新完成：成功 ${data.refreshed} 条，失败 ${data.failed} 条`);
        }
      }
    } catch {
      setError("刷新失败，请稍后重试");
    } finally {
      setRefreshingAll(false);
    }
  };

  // 按月份分组
  const groupedTweets: { [key: string]: Tweet[] } = {};
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  for (const t of tweets) {
    const date = new Date(t.posted_at);
    const key = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
    if (!groupedTweets[key]) groupedTweets[key] = [];
    groupedTweets[key].push(t);
    if (t.sentiment === "bullish") bullishCount++;
    else if (t.sentiment === "bearish") bearishCount++;
    else neutralCount++;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-sky-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-20 text-center text-zinc-400">事件不存在</div>
    );
  }

  return (
    <div>
      {/* 事件头部 */}
      <button
        onClick={() => router.push("/")}
        className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        全部事件
      </button>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          {error}
        </div>
      )}

      {event.cover_url && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-800">
          <img src={event.cover_url} alt={event.title} className="h-40 w-full object-cover sm:h-48" />
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">{event.title}</h1>
            {event.keywords && (
              <div className="mt-1 text-xs text-zinc-500">
                搜索关键词：<span className="text-zinc-400">{event.keywords}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* 自动更新开关 */}
            <button
              onClick={handleToggleAutoRefresh}
              disabled={togglingAutoRefresh}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                event.auto_refresh
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400 ring-1 ring-inset ring-zinc-700"
              } disabled:opacity-50`}
              title={event.auto_refresh ? "已开启自动更新，点击关闭" : "点击开启自动更新"}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${event.auto_refresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              {event.auto_refresh ? "自动更新中" : "自动更新"}
            </button>
            <button
              onClick={handleDeleteEvent}
              className="rounded-full p-2 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400"
              title="删除事件"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        {event.description && (
          <p className="mt-2 text-sm text-zinc-400">{event.description}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
          <span>{event.tweet_count} 条推文</span>
          <span>·</span>
          <span>创建于 {formatRelativeTime(event.created_at)}</span>
          {event.tweet_count > 0 && (
            <>
              <span>·</span>
              <button
                onClick={handleRefreshAll}
                disabled={refreshingAll}
                className="inline-flex items-center gap-1 text-zinc-400 transition hover:text-sky-400 disabled:opacity-50"
              >
                <svg className={`h-3 w-3 ${refreshingAll ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                {refreshingAll ? "刷新中..." : "刷新全部"}
              </button>
            </>
          )}
        </div>

        {/* 情感分布概览 */}
        {tweets.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              情感分布
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                {bullishCount > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${(bullishCount / tweets.length) * 100}%` }} />
                )}
                {neutralCount > 0 && (
                  <div className="bg-zinc-500" style={{ width: `${(neutralCount / tweets.length) * 100}%` }} />
                )}
                {bearishCount > 0 && (
                  <div className="bg-red-500" style={{ width: `${(bearishCount / tweets.length) * 100}%` }} />
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />利好 {bullishCount}
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />中性 {neutralCount}
                </span>
                <span className="inline-flex items-center gap-1 text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />利空 {bearishCount}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 提交推文 */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-5 w-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <h2 className="font-bold">提交推文</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={submitUrl}
              onChange={(e) => setSubmitUrl(e.target.value)}
              placeholder="粘贴推文链接，支持多条（每行一条，如：&#10;https://x.com/user/status/123&#10;https://x.com/user/status/456"
              rows={3}
              className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="shrink-0 self-start rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
            >
              {submitting ? "抓取中..." : "添加"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            支持 twitter.com / x.com 的推文链接。可一次性粘贴多条链接，用换行或逗号分隔
          </p>
          {submitError && (
            <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {submitSuccess}
            </div>
          )}
        </form>
      </div>

      {/* 时间线 */}
      <div className="relative">
        {/* 时间线竖线 */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-500/50 via-zinc-800 to-transparent" />

        {Object.entries(groupedTweets).map(([month, monthTweets]) => (
          <div key={month} className="mb-8">
            <div className="sticky top-14 z-10 mb-4 ml-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-[#0a0a0b] px-3 py-1 text-xs font-semibold text-zinc-400">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {month}
                <span className="text-zinc-600">· {monthTweets.length} 条</span>
              </span>
            </div>

            <div className="ml-8 space-y-4">
              {monthTweets.map((tweet) => (
              <TweetCard
                key={tweet.id}
                tweet={tweet}
                onRefresh={handleRefresh}
                onDelete={handleDelete}
              />
            ))}
            </div>
          </div>
        ))}
      </div>

      {tweets.length === 0 && (
        <div className="ml-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">还没有推文</p>
          <p className="mt-1 text-xs text-zinc-600">在上方粘贴推文链接，开始构建时间线</p>
        </div>
      )}
    </div>
  );
}
