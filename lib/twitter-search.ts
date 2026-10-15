/**
 * 推特搜索模块（免费、免登录、免 API Key）
 *
 * 原理：
 * 1. 使用推特公开的 Bearer Token（Web 客户端使用的）获取 guest token
 * 2. 使用 guest token 调用推特内部 GraphQL 搜索接口
 * 3. 解析返回的推文 ID 列表
 */

// 推特 Web 客户端使用的公开 Bearer Token
const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// 缓存 guest token（guest token 有效期较长，缓存避免频繁请求）
let cachedGuestToken: string | null = null;
let guestTokenExpiry = 0;

/**
 * 获取 guest token
 */
async function getGuestToken(): Promise<string | null> {
  // 使用缓存（guest token 通常有效期数小时）
  if (cachedGuestToken && Date.now() < guestTokenExpiry) {
    return cachedGuestToken;
  }

  try {
    const res = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-twitter-client-language": "en",
        "x-twitter-active-user": "yes",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.guest_token) {
      cachedGuestToken = data.guest_token;
      // 缓存 3 小时
      guestTokenExpiry = Date.now() + 3 * 60 * 60 * 1000;
      return cachedGuestToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 搜索推特，返回推文 URL 列表
 * @param query 搜索关键词
 * @param count 返回数量（最多约 20）
 * @returns 推文 URL 数组
 */
export async function searchTweets(
  query: string,
  count = 20
): Promise<string[]> {
  if (!query || !query.trim()) return [];

  const guestToken = await getGuestToken();
  if (!guestToken) {
    console.warn("[search] 无法获取 guest token");
    return [];
  }

  // 推特 GraphQL 搜索接口
  // 注意：queryId 会随版本更新，这里使用近期可用的值
  const queryId = "9Nq2cL9XqY0s1mK4n4lYpg";

  const variables = {
    rawQuery: query,
    count: Math.min(count, 20),
    querySource: "typed_query",
    product: "Latest",
  };

  const features = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  };

  const url = `https://x.com/i/api/graphql/${queryId}/SearchTimeline?variables=${encodeURIComponent(
    JSON.stringify(variables)
  )}&features=${encodeURIComponent(JSON.stringify(features))}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        "x-guest-token": guestToken,
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "en",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.warn(`[search] 搜索请求失败: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();

    // 解析推文 ID
    const tweetIds: string[] = [];

    // 递归查找所有推文 ID
    function findTweetIds(obj: any) {
      if (!obj || typeof obj !== "object") return;

      // 查找 tweet_results 中的 rest_id
      if (obj.tweet_results?.result?.rest_id) {
        const id = obj.tweet_results.result.rest_id;
        if (!tweetIds.includes(id)) tweetIds.push(id);
      }
      if (obj.tweet_results?.result?.tweet?.rest_id) {
        const id = obj.tweet_results.result.tweet.rest_id;
        if (!tweetIds.includes(id)) tweetIds.push(id);
      }

      // 递归遍历
      for (const key of Object.keys(obj)) {
        if (key === "__typename") continue;
        findTweetIds(obj[key]);
      }
    }

    findTweetIds(data);

    // 转换为 URL
    return tweetIds.map((id) => `https://x.com/i/web/status/${id}`);
  } catch (err) {
    console.warn("[search] 搜索异常:", err instanceof Error ? err.message : err);
    return [];
  }
}
