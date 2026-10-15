/**
 * 免费翻译模块
 * 使用 Google Translate 非官方公共端点，无需 API Key
 * 端点: https://translate.googleapis.com/translate_a/single
 */

const TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/**
 * 将文本翻译为中文（zh-CN）
 * @param text 要翻译的文本
 * @param sourceLang 源语言，默认 auto 自动检测
 * @returns 翻译后的中文文本，如果翻译失败返回空字符串
 */
export async function translateToChinese(
  text: string,
  sourceLang = "auto"
): Promise<string> {
  if (!text || !text.trim()) return "";

  // 简单判断：如果已经主要是中文，就不翻译了
  if (isMostlyChinese(text)) return text;

  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLang,
      tl: "zh-CN",
      dt: "t",
      q: text,
    });

    const res = await fetch(`${TRANSLATE_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (!res.ok) {
      return "";
    }

    const data = await res.json();

    // Google Translate 返回格式: [[["翻译片段", "原文片段", null, null, 1]], ...]
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return "";
    }

    // 拼接所有翻译片段
    const translated = data[0]
      .map((seg: any) => (Array.isArray(seg) && seg[0] ? seg[0] : ""))
      .join("");

    return translated.trim();
  } catch {
    // 翻译失败时静默返回空，不影响主流程
    return "";
  }
}

/**
 * 判断文本是否主要由中文组成
 * 用于跳过已经是中文的文本
 */
function isMostlyChinese(text: string): boolean {
  // 移除 URL、@提及、#标签 后再判断
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .trim();

  if (!cleaned) return true;

  // 统计中文字符
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) || [];
  // 统计英文字符
  const englishChars = cleaned.match(/[a-zA-Z]/g) || [];

  // 中文字符数 > 英文字符数，且中文字符占比超过 30%
  return (
    chineseChars.length > englishChars.length &&
    chineseChars.length / cleaned.length > 0.3
  );
}
