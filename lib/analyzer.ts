/**
 * 推文标签与情感分析模块（基于关键词规则匹配，免费方案）
 */

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface AnalysisResult {
  tags: string[];
  sentiment: Sentiment;
  sentiment_reason: string;
}

// 标签关键词库：{ 标签名: [匹配关键词列表] }
// 匹配时不区分大小写，支持中英文
const TAG_KEYWORDS: Record<string, string[]> = {
  发射: ["launch", "liftoff", "发射", "升空", "起飞", "起飞", "ignition", "点火"],
  成功: ["success", "successful", "成功", "顺利", "completed", "完成", "achieved", "实现", "landed", "着陆成功"],
  失败: ["fail", "failed", "failure", "爆炸", "explosion", "explode", "crash", "失败", "异常", "abort", "终止"],
  技术突破: ["breakthrough", "突破", "record", "纪录", "first", "首次", "new", "创新", "里程碑", "milestone"],
  合作: ["partner", "合作", "collaborate", "agreement", "协议", "deal", "签署", "joint", "联合"],
  融资: ["funding", "融资", "raise", "募资", "investment", "投资", "valuation", "估值", "ipo", "上市"],
  产品发布: ["release", "launch", "发布", "unveil", "推出", "announce", "宣布", "available", "上线"],
  监管: ["regulation", "监管", "approval", "批准", "license", "许可", "fda", "sec", "compliance", "合规"],
  财报: ["earnings", "财报", "revenue", "营收", "profit", "利润", "quarterly", "q1", "q2", "q3", "q4", "guidance"],
  人事变动: ["ceo", "hire", "任命", "离职", "resign", "step down", "appoint", "cfo", "cto"],
  安全: ["safety", "安全", "recall", "召回", "incident", "事故", "investigation", "调查"],
  测试: ["test", "测试", "trial", "试验", "demo", "演示", "prototype", "原型"],
};

// 利好关键词
const BULLISH_KEYWORDS = [
  "success", "successful", "成功", "顺利", "breakthrough", "突破", "record", "纪录",
  "first", "首次", "milestone", "里程碑", "surge", "暴涨", "soar", "飙升", "beat", "超出预期",
  "exceed", "超过", "growth", "增长", "profit", "盈利", "approved", "批准", "launch", "发布",
  "innovation", "创新", "landed", "着陆成功", "completed", "完成", "achieved", "实现",
  "strong", "强劲", "impressive", "令人印象深刻", "revolutionary", "革命性",
];

// 利空关键词
const BEARISH_KEYWORDS = [
  "fail", "failed", "failure", "失败", "explosion", "爆炸", "explode", "crash", "坠毁",
  "delay", "延迟", "推迟", "postpone", "recall", "召回", "investigation", "调查",
  "lawsuit", "诉讼", "fine", "罚款", "penalty", "处罚", "decline", "下降", "drop", "下跌",
  "loss", "亏损", "miss", "未达预期", "weak", "疲软", "risk", "风险", "concern", "担忧",
  "cut", "削减", "layoff", "裁员", "bankruptcy", "破产", "ban", "禁止", "restrict", "限制",
  "abort", "终止", "anomaly", "异常", "issue", "问题", "problem", "麻烦",
];

function matchKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      count++;
    }
  }
  return count;
}

/**
 * 分析推文内容，返回标签和情感评价
 */
export function analyzeTweet(content: string): AnalysisResult {
  const text = content || "";

  // 1. 提取标签
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (matchKeywords(text, keywords) > 0) {
      tags.push(tag);
    }
  }
  // 最多保留 5 个标签
  const finalTags = tags.slice(0, 5);

  // 2. 情感分析
  const bullishCount = matchKeywords(text, BULLISH_KEYWORDS);
  const bearishCount = matchKeywords(text, BEARISH_KEYWORDS);

  let sentiment: Sentiment = "neutral";
  let reason = "内容中性，无明显利好或利空信号";

  if (bullishCount > bearishCount && bullishCount > 0) {
    sentiment = "bullish";
    const matched = BULLISH_KEYWORDS.filter((kw) =>
      text.toLowerCase().includes(kw.toLowerCase())
    ).slice(0, 3);
    reason = `检测到积极信号：${matched.join("、")}`;
  } else if (bearishCount > bullishCount && bearishCount > 0) {
    sentiment = "bearish";
    const matched = BEARISH_KEYWORDS.filter((kw) =>
      text.toLowerCase().includes(kw.toLowerCase())
    ).slice(0, 3);
    reason = `检测到消极信号：${matched.join("、")}`;
  }

  return {
    tags: finalTags,
    sentiment,
    sentiment_reason: reason,
  };
}
