import fs from "node:fs/promises";
import path from "node:path";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Shanghai";
const DAY_OPTIONS = [1, 3, 7, 14, 30];

// 资讯分类（用于页面分区）
const NEWS_QUERIES = [
  { title: "OpenClaw 生态", query: "OpenClaw 小龙虾 AI 助手" },
  {
    title: "国内外大厂动作",
    query:
      "(腾讯 OR 阿里巴巴 OR 百度 OR 字节跳动 OR 华为 OR 京东 OR OpenAI OR Anthropic OR Google OR Microsoft OR Meta OR Amazon OR NVIDIA) AI",
  },
  { title: "技术突破", query: "AI 技术 突破" },
  { title: "AI-UX", query: "AI 产品 交互 体验" },
  { title: "产品范式", query: "AI 产品 发布" },
  { title: "推理成本和 Token 经济", query: "AI 推理 成本 Token" },
  { title: "代理式 AI", query: "AI 智能体" },
  { title: "商业 ROI", query: "AI 商业化 ROI" },
];

const SECTION_KEYWORDS = {
  技术突破: ["breakthrough", "research", "paper", "model", "benchmark", "sota", "arxiv", "发布", "突破", "论文"],
  产品范式: ["launch", "product", "feature", "tool", "platform", "app", "release", "上线", "产品", "功能"],
  国内外大厂动作: [
    "openai",
    "anthropic",
    "google",
    "deepmind",
    "microsoft",
    "meta",
    "amazon",
    "apple",
    "nvidia",
    "hugging face",
    "mistral",
    "xai",
    "claude",
    "chatgpt",
    "gemini",
    "llama",
    "copilot",
    "腾讯",
    "阿里",
    "百度",
    "字节",
    "华为",
    "京东",
    "小米",
    "科大讯飞",
    "美团",
    "拼多多",
    "网易",
    "快手",
    "release",
    "announcement",
  ],
  "代理式 AI": ["agent", "agentic", "workflow", "automation", "multi-agent", "智能体", "代理"],
  "推理成本和 Token 经济": [
    "inference",
    "token",
    "cost",
    "efficiency",
    "latency",
    "serving",
    "quantization",
    "推理",
    "成本",
    "token",
    "算力",
    "训练成本",
    "推理成本",
    "tokens",
    "吞吐",
    "时延",
    "降本",
    "蒸馏",
    "量化",
    "边缘部署",
  ],
  "AI-UX": [
    "ux",
    "ui",
    "design",
    "interaction",
    "copilot",
    "experience",
    "界面",
    "交互",
    "体验",
    "工作流",
    "助手",
    "智能助理",
    "可用性",
    "产品设计",
    "人机交互",
    "agent",
    "智能体",
  ],
  "商业 ROI": ["roi", "enterprise", "adoption", "pricing", "revenue", "business", "commercial", "营收", "商业", "企业"],
  "OpenClaw 生态": ["openclaw", "clawd", "小龙虾", "ai 助手", "agent", "多平台", "discord bot"],
};

const CN_CHANNEL_POOL = [
  "36kr_ai",
  "huxiu_ai",
  "technode_cn_ai",
  "geekpark_ai",
  "ifanr_ai",
  "ithome_ai",
  "mydrivers_ai",
  "zol_ai",
  "thepaper_tech_ai",
  "jiemian_ai",
  "huanqiu_tech_ai",
  "krasia_ai",
  "caixin_global_ai",
];

const SECTION_FALLBACK_CHANNELS = {
  国内外大厂动作: CN_CHANNEL_POOL,
  "推理成本和 Token 经济": CN_CHANNEL_POOL,
  "AI-UX": CN_CHANNEL_POOL,
  "OpenClaw 生态": CN_CHANNEL_POOL,
};

const FETCH_TIMEOUT_MS = 12000;

// 八个渠道配置模板（可按需复制为 src/data/channel-config.json 自定义）
const CHANNEL_CONFIG_TEMPLATE = {
  version: 1,
  timezone: TZ,
  default: {
    maxItemsPerChannel: 30,
    maxItemsPerSection: 30,
    fetchEveryMinutes: 30,
    weight: 1,
  },
  channels: [
    {
      id: "openai_blog",
      name: "OpenAI Blog",
      enabled: false,
      kind: "rss",
      feedUrl: "https://openai.com/news/rss.xml",
      fetchEveryMinutes: 60,
      weight: 1.0,
    },
    {
      id: "anthropic_news",
      name: "Anthropic News",
      enabled: false,
      kind: "rss",
      feedUrl: "https://www.anthropic.com/news/rss.xml",
      fetchEveryMinutes: 60,
      weight: 1.0,
    },
    {
      id: "google_ai_blog",
      name: "Google AI Blog",
      enabled: false,
      kind: "rss",
      feedUrl: "https://blog.google/technology/ai/rss/",
      fetchEveryMinutes: 60,
      weight: 0.95,
    },
    {
      id: "huggingface_blog",
      name: "Hugging Face Blog",
      enabled: false,
      kind: "rss",
      feedUrl: "https://huggingface.co/blog/feed.xml",
      fetchEveryMinutes: 60,
      weight: 0.9,
    },
    {
      id: "github_trending_ai",
      name: "GitHub Trending (AI关键词)",
      enabled: false,
      kind: "github-trending",
      query: "(llm OR gpt OR agent OR diffusion OR rag OR ai)",
      language: "all",
      since: "daily",
      fetchEveryMinutes: 30,
      weight: 0.85,
    },
    {
      id: "hackernews_ai",
      name: "Hacker News（LLM/AI关键词）",
      enabled: false,
      kind: "rss-keyword",
      feedUrl: "https://hnrss.org/newest",
      keywords: ["llm", "ai", "agent", "openai", "anthropic", "google ai", "rag"],
      fetchEveryMinutes: 15,
      weight: 0.8,
    },
    {
      id: "arxiv_cs_daily",
      name: "arXiv cs.CL/cs.LG（每日）",
      enabled: false,
      kind: "rss-multi",
      feedUrls: ["https://rss.arxiv.org/rss/cs.CL", "https://rss.arxiv.org/rss/cs.LG"],
      fetchEveryMinutes: 1440,
      weight: 0.95,
    },
    {
      id: "producthunt_ai",
      name: "Product Hunt AI",
      enabled: false,
      kind: "rss-keyword",
      feedUrl: "https://www.producthunt.com/feed",
      keywords: ["ai", "llm", "agent", "copilot", "automation"],
      fetchEveryMinutes: 60,
      weight: 0.75,
    },

    // 国内直连主链（双层架构第一层）
    { id: "36kr_ai", name: "36氪 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://36kr.com/feed", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 1.0 },
    { id: "huxiu_ai", name: "虎嗅 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.huxiu.com/rss/0.xml", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 1.0 },
    { id: "technode_cn_ai", name: "动点科技 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://cn.technode.com/feed/", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.95 },
    { id: "geekpark_ai", name: "极客公园 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.geekpark.net/rss", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.95 },
    { id: "ifanr_ai", name: "爱范儿 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.ifanr.com/feed", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.95 },
    { id: "ithome_ai", name: "IT之家 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.ithome.com/rss/", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 1.0 },
    { id: "mydrivers_ai", name: "快科技 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://rss.mydrivers.com/rss.aspx", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.9 },
    { id: "zol_ai", name: "ZOL AI", enabled: true, kind: "rss-keyword", feedUrl: "https://news.zol.com.cn/rss.xml", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.85 },
    { id: "thepaper_tech_ai", name: "澎湃科技 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.thepaper.cn/rss_newsDetail_forward_25950", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.9 },
    { id: "jiemian_ai", name: "界面新闻 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.jiemian.com/rss/index.xml", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.9 },
    { id: "huanqiu_tech_ai", name: "环球科技 AI", enabled: true, kind: "rss-keyword", feedUrl: "https://tech.huanqiu.com/rss.xml", keywords: ["AI", "人工智能", "大模型", "智能体"], fetchEveryMinutes: 120, weight: 0.85 },
    { id: "krasia_ai", name: "KrASIA AI", enabled: true, kind: "rss-keyword", feedUrl: "https://kr-asia.com/feed", keywords: ["AI", "artificial intelligence", "LLM", "agent"], fetchEveryMinutes: 120, weight: 0.85 },
    { id: "caixin_global_ai", name: "Caixin Global AI", enabled: true, kind: "rss-keyword", feedUrl: "https://www.caixinglobal.com/feed", keywords: ["AI", "artificial intelligence", "LLM", "agent"], fetchEveryMinutes: 120, weight: 0.8 },
  ],
  sectionWeights: {
    技术突破: 1.0,
    产品范式: 0.95,
    国内外大厂动作: 0.95,
    "代理式 AI": 1.0,
    "推理成本和 Token 经济": 0.95,
    "AI-UX": 0.8,
    "商业 ROI": 0.85,
    "OpenClaw 生态": 0.9,
  },
};

const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet", currency: "USD" },
  { symbol: "002230.SZ", name: "科大讯飞", currency: "CNY" },
  { symbol: "300308.SZ", name: "中际旭创", currency: "CNY" },
  { symbol: "688111.SS", name: "金山办公", currency: "CNY" },
  { symbol: "600570.SS", name: "恒生电子", currency: "CNY" },
  { symbol: "002415.SZ", name: "海康威视", currency: "CNY" },
];

function stripCData(input = "") {
  return input.replace("<![CDATA[", "").replace("]]>", "").trim();
}

function decodeXml(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHtml(text = "") {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text = "", maxLen = 220) {
  const decoded = decodeXml(stripCData(text));
  const plain = stripHtml(decoded);
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

function findAll(tag, xml) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results = [];
  let match;
  while ((match = regex.exec(xml)) !== null) results.push(decodeXml(stripCData(match[1])));
  return results;
}

function parseRssItems(xml) {
  const blocks = [...(xml.match(/<item>[\s\S]*?<\/item>/gi) || []), ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) || [])];

  return blocks
    .map((block) => {
      const rawTitle = findAll("title", block)[0] || "(无标题)";
      const link = findAll("link", block)[0] || (block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "#");
      const publishedAt =
        findAll("pubDate", block)[0] || findAll("published", block)[0] || findAll("updated", block)[0] || "";
      const rawSource = findAll("source", block)[0] || "RSS";
      const rawSummary = findAll("description", block)[0] || findAll("summary", block)[0] || "";
      const title = cleanText(rawTitle, 180) || "(无标题)";
      const source = cleanText(rawSource, 40) || "RSS";
      const summary = cleanText(rawSummary, 260);
      return { title, link, source, publishedAt, summary };
    })
    .filter((x) => x.title && x.link && x.link !== "#");
}

function inDaysWindow(publishedAt, days) {
  if (!publishedAt) return true;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts <= ONE_DAY_MS * days;
}

function normalize(item, channel) {
  return {
    title: item.title,
    link: item.link,
    source: item.source || channel.name,
    publishedAt: item.publishedAt || "",
    channelId: channel.id,
  };
}

function hasKeyword(text, keywords = []) {
  const t = (text || "").toLowerCase();
  return keywords.some((k) => t.includes(String(k).toLowerCase()));
}

function isMostlyChinese(text = "") {
  if (!text) return false;
  const all = text.replace(/\s/g, "");
  if (!all) return false;
  const zh = (all.match(/[\u4e00-\u9fff]/g) || []).length;
  return zh / all.length >= 0.2;
}

function isChineseItem(item) {
  return isMostlyChinese(`${item.title || ""} ${item.summary || ""} ${item.source || ""}`);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogleNews(query, days) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml)
      .filter((x) => inDaysWindow(x.publishedAt, days))
      .slice(0, 6)
      .map((x) => ({ ...x, channelId: "google_news" }));
  } catch {
    return [];
  }
}

async function fetchChannelItems(channel, days, cap) {
  try {
    if (channel.kind === "rss") {
      const res = await fetchWithTimeout(channel.feedUrl);
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssItems(xml)
        .filter((x) => inDaysWindow(x.publishedAt, days))
        .slice(0, cap)
        .map((x) => normalize(x, channel));
    }

    if (channel.kind === "rss-keyword") {
      const res = await fetchWithTimeout(channel.feedUrl);
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssItems(xml)
        .filter((x) => inDaysWindow(x.publishedAt, days))
        .filter((x) => hasKeyword(`${x.title} ${x.summary} ${x.source}`, channel.keywords || []))
        .slice(0, cap)
        .map((x) => normalize(x, channel));
    }

    if (channel.kind === "rss-multi") {
      const outputs = await Promise.all(
        (channel.feedUrls || []).map(async (feedUrl) => {
          const res = await fetchWithTimeout(feedUrl);
          if (!res.ok) return [];
          const xml = await res.text();
          return parseRssItems(xml)
            .filter((x) => inDaysWindow(x.publishedAt, days))
            .map((x) => normalize(x, channel));
        }),
      );
      return outputs.flat().slice(0, cap);
    }

    if (channel.kind === "github-trending") {
      const sinceDate = new Date(Date.now() - ONE_DAY_MS * days).toISOString().slice(0, 10);
      const q = `${channel.query || "ai"} pushed:>=${sinceDate}`;
      const api = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(cap, 20)}`;
      const res = await fetchWithTimeout(api, { headers: { "user-agent": "ai-24h-radar" } });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items || []).slice(0, cap).map((repo) => ({
        title: `${repo.full_name} - ${repo.description || "GitHub repo"}`,
        link: repo.html_url,
        source: "GitHub",
        publishedAt: repo.updated_at || repo.created_at || "",
        channelId: channel.id,
      }));
    }

    return [];
  } catch {
    return [];
  }
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.link}::${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function rankForSection(sectionTitle, item) {
  const keywords = SECTION_KEYWORDS[sectionTitle] || [];
  const text = `${item.title} ${item.source}`;
  let score = 0;
  for (const kw of keywords) {
    if (text.toLowerCase().includes(String(kw).toLowerCase())) score += 1;
  }
  if (sectionTitle === "技术突破" && item.channelId === "arxiv_cs_daily") score += 2;
  if (sectionTitle === "产品范式" && item.channelId === "producthunt_ai") score += 2;
  if (sectionTitle === "国内外大厂动作" && ["openai_blog", "anthropic_news", "google_ai_blog", "huggingface_blog", "ithome_ai", "36kr_ai", "huxiu_ai"].includes(item.channelId)) score += 2;
  if (sectionTitle === "OpenClaw 生态" && ["ithome_ai", "36kr_ai", "huxiu_ai"].includes(item.channelId)) score += 2;
  return score;
}

async function fetchStock(symbol, name, currency, days) {
  const rangeDays = Math.max(days + 2, 3);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rangeDays}d&interval=1d`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { symbol, name, currency, price: null, previousClose: null, changePct: null };
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close?.filter((n) => typeof n === "number") || [];
    if (closes.length < 2) return { symbol, name, currency, price: null, previousClose: null, changePct: null };
    const price = closes[closes.length - 1];
    const baseIndex = Math.max(0, closes.length - 1 - days);
    const previousClose = closes[baseIndex];
    const changePct = ((price - previousClose) / previousClose) * 100;
    return { symbol, name, currency, price, previousClose, changePct };
  } catch {
    return { symbol, name, currency, price: null, previousClose: null, changePct: null };
  }
}

async function generateForDay(days) {
  const cap = CHANNEL_CONFIG_TEMPLATE.default.maxItemsPerChannel;
  const maxPerSection = CHANNEL_CONFIG_TEMPLATE.default.maxItemsPerSection;

  const [googleSections, stocks, channelResults] = await Promise.all([
    Promise.all(
      NEWS_QUERIES.map(async ({ title, query }) => ({
        title,
        query,
        items: await fetchGoogleNews(query, days),
      })),
    ),
    Promise.all(STOCKS.map((s) => fetchStock(s.symbol, s.name, s.currency, days))),
    Promise.all(
      CHANNEL_CONFIG_TEMPLATE.channels
        .filter((c) => c.enabled)
        .map(async (c) => ({ channelId: c.id, items: await fetchChannelItems(c, days, cap) })),
    ),
  ]);

  const pool = dedupeItems(channelResults.flatMap((x) => x.items));
  const channelMap = Object.fromEntries(channelResults.map((x) => [x.channelId, x.items]));
  const diagnostics = [];

  const sections = googleSections.map((section) => {
    const base = dedupeItems(section.items);
    const used = new Set(base.map((x) => `${x.link}::${x.title}`));

    const scoredCandidates = pool
      .filter((item) => !used.has(`${item.link}::${item.title}`))
      .filter((item) => isChineseItem(item))
      .map((item) => ({ item, score: rankForSection(section.title, item) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerSection * 2)
      .map((x) => x.item);

    let items = dedupeItems([...base, ...scoredCandidates]).filter((item) => isChineseItem(item)).slice(0, maxPerSection);

    if (items.length === 0 && SECTION_FALLBACK_CHANNELS[section.title]) {
      const fallbackChannels = SECTION_FALLBACK_CHANNELS[section.title];
      const fallback = dedupeItems(
        fallbackChannels.flatMap((channelId) => channelMap[channelId] || []),
      )
        .filter((item) => !used.has(`${item.link}::${item.title}`))
        .filter((item) => isChineseItem(item))
        .slice(0, maxPerSection);

      if (fallback.length > 0) {
        items = fallback;
        diagnostics.push({
          days,
          section: section.title,
          reason: "scoring-empty-then-fallback",
          fallbackChannels,
          fallbackCount: fallback.length,
        });
      }
    }

    if (items.length === 0) {
      diagnostics.push({
        days,
        section: section.title,
        reason: "still-empty",
        googleBaseCount: base.length,
        scoredPoolSize: scoredCandidates.length,
      });
    }

    return { ...section, items };
  });

  return {
    sections,
    stocks,
    channels: channelResults.map((c) => ({ channelId: c.channelId, count: c.items.length })),
    diagnostics,
  };
}

async function writeChannelTemplate() {
  const templatePath = path.resolve("src/data/channel-config.template.json");
  await fs.mkdir(path.dirname(templatePath), { recursive: true });
  await fs.writeFile(templatePath, `${JSON.stringify(CHANNEL_CONFIG_TEMPLATE, null, 2)}\n`, "utf8");
  return templatePath;
}

function buildHealthReport(byDays) {
  const report = {
    totalNewsItems: 0,
    emptySections: [],
    totalStocks: 0,
    stocksWithPrice: 0,
    channels: {},
    diagnostics: [],
  };

  for (const d of DAY_OPTIONS) {
    const dayData = byDays[d] || { sections: [], stocks: [], channels: [], diagnostics: [] };

    for (const section of dayData.sections || []) {
      const count = section.items?.length || 0;
      report.totalNewsItems += count;
      if (count === 0) {
        report.emptySections.push({ days: d, title: section.title });
      }
    }

    for (const stock of dayData.stocks || []) {
      report.totalStocks += 1;
      if (typeof stock.price === "number") report.stocksWithPrice += 1;
    }

    for (const channel of dayData.channels || []) {
      report.channels[channel.channelId] = (report.channels[channel.channelId] || 0) + channel.count;
    }

    for (const diag of dayData.diagnostics || []) {
      report.diagnostics.push(diag);
    }
  }

  return report;
}

async function main() {
  const byDays = {};
  for (const d of DAY_OPTIONS) {
    byDays[d] = await generateForDay(d);
  }

  const health = buildHealthReport(byDays);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    timezone: TZ,
    dayOptions: DAY_OPTIONS,
    channelConfigTemplateVersion: CHANNEL_CONFIG_TEMPLATE.version,
    byDays,
    health,
  };

  const outPath = path.resolve("src/data/snapshot.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const templatePath = await writeChannelTemplate();

  console.log(`snapshot updated: ${outPath}`);
  console.log(`channel template updated: ${templatePath}`);
  console.log(
    `[health] totalNewsItems=${health.totalNewsItems}, emptySections=${health.emptySections.length}, stocksWithPrice=${health.stocksWithPrice}/${health.totalStocks}`,
  );

  if (health.emptySections.length > 0) {
    const preview = health.emptySections
      .slice(0, 8)
      .map((x) => `${x.days}d:${x.title}`)
      .join(", ");
    console.warn(`[health][warn] empty sections detected: ${preview}${health.emptySections.length > 8 ? " ..." : ""}`);
  }

  if (health.diagnostics.length > 0) {
    const preview = health.diagnostics
      .slice(0, 8)
      .map((x) => `${x.days}d:${x.section}:${x.reason}`)
      .join(", ");
    console.warn(`[health][diag] ${preview}${health.diagnostics.length > 8 ? " ..." : ""}`);
  }

  if (health.totalNewsItems === 0) {
    throw new Error("health check failed: no news items captured across all day windows");
  }
}

main().catch((err) => {
  console.error("update-snapshot failed:", err);
  process.exit(1);
});
