// 事件
export interface Event {
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  created_at: string;
  tweet_count: number;
}

// 推文
export interface Tweet {
  id: number;
  event_id: number;
  tweet_id: string;
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  author_verified: boolean;
  content: string;
  content_zh: string;
  posted_at: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  views: number | null;
  media: TweetMedia[];
  quoted_tweet: QuotedTweet | null;
  is_reply: boolean;
  tags: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  sentiment_reason: string;
  fetched_at: string;
  submitted_by: string | null;
  source: "user" | "auto";
}

export interface TweetMedia {
  type: "photo" | "video" | "gif";
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export interface QuotedTweet {
  tweet_id: string;
  author_name: string;
  author_handle: string;
  content: string;
  posted_at: string;
}

// 创建事件的请求
export interface CreateEventInput {
  title: string;
  description: string;
  cover_url?: string;
}

// 提交推文的请求
export interface SubmitTweetInput {
  event_id: number;
  url: string;
  submitted_by?: string;
}

// 抓取结果
export interface ScrapeResult {
  tweet_id: string;
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  author_verified: boolean;
  content: string;
  posted_at: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  views: number | null;
  media: TweetMedia[];
  quoted_tweet: QuotedTweet | null;
  is_reply: boolean;
}
