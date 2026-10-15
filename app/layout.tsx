import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TweetLens · 推特事件时间线",
  description: "梳理重要事件的相关推特，按时间线呈现，任何人都可以创建事件并提交推文",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable}`}>
      <body className="min-h-screen bg-[#0a0a0b] text-zinc-100">
        <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-black text-white shadow-lg shadow-blue-500/20">
                T
              </div>
              <span className="text-base font-bold tracking-tight">
                Tweet<span className="text-sky-400">Lens</span>
              </span>
            </Link>
            <Link
              href="/events/new"
              className="flex items-center gap-1.5 rounded-full bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              创建事件
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="border-t border-zinc-800/60 py-8 text-center text-xs text-zinc-500">
          <p>TweetLens · 任何人都可以创建事件、提交推文链接</p>
          <p className="mt-1">数据来源于 X (Twitter) 公开 FxTwitter API · 仅供事件梳理参考</p>
        </footer>
      </body>
    </html>
  );
}
