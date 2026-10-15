"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("请输入事件标题");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          cover_url: coverUrl.trim(),
          keywords: keywords.trim(),
          auto_refresh: autoRefresh,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "创建失败");
      }

      router.push(`/events/${data.event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>

      <h1 className="mb-6 text-2xl font-black">创建事件</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            事件标题 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：某公司 Q3 财报发布会"
            maxLength={200}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">事件描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简单描述一下这个事件的背景..."
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          <div className="mt-1 text-right text-xs text-zinc-600">{description.length}/2000</div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">封面图链接（可选）</label>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://example.com/cover.jpg"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          {coverUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
              <img src={coverUrl} alt="封面预览" className="max-h-40 w-full object-cover" />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            搜索关键词
            <span className="ml-2 text-xs font-normal text-zinc-500">
              用于自动抓取相关推文，留空则使用事件标题
            </span>
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="例如：某公司 财报 2024"
            maxLength={500}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-200">自动抓取更新</div>
            <div className="text-xs text-zinc-500">开启后，打开页面时每 2.5 分钟自动搜索并添加相关推文</div>
          </div>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              autoRefresh ? "bg-sky-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                autoRefresh ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "创建中..." : "创建事件"}
        </button>
      </form>
    </div>
  );
}
