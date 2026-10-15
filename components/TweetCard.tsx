"use client";

import { useState } from "react";
import type { Tweet } from "@/lib/types";
import { formatCount, formatRelativeTime, formatFullDate } from "@/lib/scraper";

interface TweetCardProps {
  tweet: Tweet;
  onRefresh?: (id: number) => void;
  onDelete?: (id: number) => void;
  showRefresh?: boolean;
}

function VerifiedBadge() {
  return (
    <svg className="h-4 w-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
    </svg>
  );
}

export default function TweetCard({ tweet, onRefresh, onDelete, showRefresh = true }: TweetCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [showFullDate, setShowFullDate] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const hasTranslation = !!tweet.content_zh && tweet.content_zh.trim() !== "" && tweet.content_zh !== tweet.content;

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    await onRefresh(tweet.id);
    setRefreshing(false);
  };

  const metrics = [
    {
      label: "回复",
      value: tweet.replies,
      icon: (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
    {
      label: "转发",
      value: tweet.retweets,
      icon: (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
    {
      label: "点赞",
      value: tweet.likes,
      icon: (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      label: "引用",
      value: tweet.quotes,
      icon: (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      ),
    },
    {
      label: "收藏",
      value: tweet.bookmarks,
      icon: (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ];

  // 渲染推文内容中的链接
  const renderContent = (text: string) => {
    const parts = text.split(/(https?:\/\/\S+|@\w+|#\w+)/g);
    return parts.map((part, i) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      if (part.match(/^@\w+/)) {
        return (
          <a key={i} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      if (part.match(/^#\w+/)) {
        return (
          <a key={i} href={`https://x.com/hashtag/${part.slice(1)}`} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // 情感标签配置
  const sentimentConfig = {
    bullish: { label: "利好", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
    bearish: { label: "利空", color: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-400" },
    neutral: { label: "中性", color: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40", dot: "bg-zinc-400" },
  } as const;
  const sentiment = sentimentConfig[tweet.sentiment] || sentimentConfig.neutral;

  return (
    <article className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700 hover:bg-zinc-900">
      {/* 时间线圆点 */}
      <div className="absolute -left-[29px] top-5 h-3 w-3 rounded-full border-2 border-sky-500 bg-[#0a0a0b]" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {tweet.author_avatar ? (
            <img
              src={tweet.author_avatar}
              alt={tweet.author_name}
              className="h-10 w-10 shrink-0 rounded-full ring-1 ring-zinc-700"
              loading="lazy"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
              {tweet.author_name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-bold text-white">{tweet.author_name}</span>
              {tweet.author_verified && <VerifiedBadge />}
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${sentiment.color}`}
                title={tweet.sentiment_reason}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sentiment.dot}`} />
                {sentiment.label}
              </span>
            </div>
            <a
              href={`https://x.com/${tweet.author_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm text-zinc-500 hover:text-zinc-400"
            >
              @{tweet.author_handle}
            </a>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {tweet.is_reply && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">回复</span>
          )}
          {tweet.source === "auto" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-inset ring-violet-500/20" title="系统自动抓取">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              自动
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-inset ring-sky-500/20" title="用户手动提交">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              手动
            </span>
          )}
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="刷新数据"
              className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-sky-400 disabled:opacity-40"
            >
              <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(tweet.id)}
              title="移除"
              className="rounded-full p-1.5 text-zinc-500 transition hover:bg-red-900/30 hover:text-red-400"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 推文内容 */}
      <div className="tweet-content mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">
        {renderContent(tweet.content)}
      </div>

      {/* 翻译内容 */}
      {hasTranslation && showTranslation && (
        <div className="tweet-content mt-2 whitespace-pre-wrap break-words border-l-2 border-sky-500/40 bg-sky-500/5 pl-3 text-[15px] leading-relaxed text-sky-100/90">
          {renderContent(tweet.content_zh)}
        </div>
      )}

      {/* 翻译切换按钮 */}
      {hasTranslation && (
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-zinc-700/60 hover:text-sky-400"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
          {showTranslation ? "隐藏翻译" : "查看翻译"}
        </button>
      )}

      {/* 标签 */}
      {tweet.tags && tweet.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tweet.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-inset ring-sky-500/20"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 媒体 */}
      {tweet.media.length > 0 && (
        <div className={`mt-3 grid gap-2 ${tweet.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {tweet.media.map((m, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-zinc-800">
              {m.type === "photo" ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={m.url}
                    alt=""
                    className="w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <video
                  src={m.url}
                  poster={m.thumbnail_url}
                  controls
                  className="w-full"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 引用推文 */}
      {tweet.quoted_tweet && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            引用推文
          </div>
          <div className="mt-1 font-semibold text-zinc-200">
            {tweet.quoted_tweet.author_name}{" "}
            <span className="font-normal text-zinc-500">@{tweet.quoted_tweet.author_handle}</span>
          </div>
          <div className="tweet-content mt-1 text-sm text-zinc-300">{renderContent(tweet.quoted_tweet.content)}</div>
        </div>
      )}

      {/* 时间 + 互动指标 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 pt-3">
        <a
          href={tweet.url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setShowFullDate(true)}
          onMouseLeave={() => setShowFullDate(false)}
          className="text-xs text-zinc-500 hover:text-zinc-400"
          title={formatFullDate(tweet.posted_at)}
        >
          {showFullDate ? formatFullDate(tweet.posted_at) : formatRelativeTime(tweet.posted_at)}
        </a>
        <span className="text-zinc-700">·</span>
        {tweet.views !== null && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="tabular-nums">{formatCount(tweet.views)}</span>
            <span>阅读</span>
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-zinc-500 transition hover:bg-zinc-800/50"
            title={`${m.label}: ${m.value.toLocaleString()}`}
          >
            {m.icon}
            <span className="tabular-nums text-[11px] font-medium text-zinc-400">
              {formatCount(m.value)}
            </span>
          </div>
        ))}
      </div>

      {/* 数据获取时间 */}
      <div className="mt-2 text-right text-[10px] text-zinc-600">
        数据更新于 {formatRelativeTime(tweet.fetched_at)}
      </div>
    </article>
  );
}
