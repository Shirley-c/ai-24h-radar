import fs from "node:fs/promises";
import path from "node:path";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Shanghai";
const DAY_OPTIONS = [1, 3, 7, 14, 30];

// 资讯分类（用于页面分区）
const NEWS_QUERIES = [
  { title: "技术突破", query: "AI breakthrough" },
  { title: "产品范式", query: "AI product launch" },
  {
    title: "国外大厂动作",
    query:
      "(Microsoft OR Google OR Alphabet OR Amazon OR Meta OR Apple OR IBM OR Oracle OR Salesforce OR NVIDIA OR AMD OR Intel OR Qualcomm OR Arm OR OpenAI OR Anthropic OR Cohere OR xAI OR Hugging Face OR Mistral AI OR Databricks OR Snowflake OR Palantir OR ServiceNow) AI",
  },
  {
    title: "国内大厂动作",
    query:
      "(腾讯 OR 阿里巴巴 OR 百度 OR 字节跳动 OR 美团 OR 京东 OR 拼多多 OR 网易 OR 快手 OR 小米 OR 华为 OR 中兴通讯 OR 联想 OR 海康威视 OR 大华 OR 科大讯飞 OR 比亚迪 OR 吉利 OR 奇瑞 OR 长城 OR 理想 OR 小鹏 OR 蔚来 OR 零跑 OR 鸿蒙智行 OR 问界 OR Huawei OR Tencent OR Alibaba OR Baidu OR ByteDance OR OPPO OR vivo OR 荣耀) AI",
  },
  { title: "代理式 AI", query: "AI agents agentic" },
  { title: "推理成本和 Token 经济", query: "LLM inference cost token economics" },
  { title: "AI-UX", query: "AI UX design" },
  { title: "商业 ROI", query: "AI ROI enterprise" },
];

const SECTION_KEYWORDS = {
  技术突破: ["breakthrough", "research", "paper", "model", "benchmark", "sota", "arxiv", "发布", "突破", "论文"],
  产品范式: ["launch", "product", "feature", "tool", "platform", "app", "release", "上线", "产品", "功能"],
  国外大厂动作: [
    "openai",
    "anthropic",
    "google",
    "google ai",
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
    "release",
    "announcement",
  ],
  国内大厂动作: ["腾讯", "阿里", "百度", "字节", "华为", "京东", "小米", "科大讯飞", "美团", "拼多多", "网易", "快手"],
  "代理式 AI": ["agent", "agentic", "workflow", "automation", "multi-agent", "智能体", "代理"],
  "推理成本和 Token 经济": ["inference", "token", "cost", "efficiency", "latency", "serving", "quantization", "推理", "成本", "token"],
  "AI-UX": ["ux", "ui", "design", "interaction", "copilot", "experience", "界面", "交互", "体验"],
  "商业 ROI": ["roi", "enterprise", "adoption", "pricing", "revenue", "business", "commercial", "营收", "商业", "企业"],
};

const SECTION_FALLBACK_CHANNELS = {
  国外大厂动作: ["openai_blog", "anthropic_news", "google_ai_blog", "huggingface_blog", "github_trending_ai"],
};

// 八个渠道配置模板（可按需复制为 src/data/channel-config.json 自定义）
const CHANNEL_CONFIG_TEMPLATE = {
  version: 1,
  timezone: TZ,
  default: {
    maxItemsPerChannel: 30,
    maxItemsPerSection: 6,
    fetchEveryMinutes: 30,
    weight: 1,
  },
  channels: [
    {
      id: "openai_blog",
      name: "OpenAI Blog",
      enabled: true,
      kind: "rss",
      feedUrl: "https://openai.com/news/rss.xml",
      fetchEveryMinutes: 60,
      weight: 1.0,
    },
    {
      id: "anthropic_news",
      name: "Anthropic News",
      enabled: true,
      kind: "rss",
      feedUrl: "https://www.anthropic.com/news/rss.xml",
      fetchEveryMinutes: 60,
      weight: 1.0,
    },
    {
      id: "google_ai_blog",
      name: "Google AI Blog",
      enabled: true,
      kind: "rss",
      feedUrl: "https://blog.google/technology/ai/rss/",
      fetchEveryMinutes: 60,
      weight: 0.95,
    },
    {
      id: "huggingface_blog",
      name: "Hugging Face Blog",
      enabled: true,
      kind: "rss",
      feedUrl: "https://huggingface.co/blog/feed.xml",
      fetchEveryMinutes: 60,
      weight: 0.9,
    },
    {
      id: "github_trending_ai",
      name: "GitHub Trending (AI关键词)",
      enabled: true,
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
      enabled: true,
      kind: "rss-keyword",
      feedUrl: "https://hnrss.org/newest",
      keywords: ["llm", "ai", "agent", "openai", "anthropic", "google ai", "rag"],
      fetchEveryMinutes: 15,
      weight: 0.8,
    },
    {
      id: "arxiv_cs_daily",
      name: "arXiv cs.CL/cs.LG（每日）",
      enabled: true,
      kind: "rss-multi",
      feedUrls: ["https://rss.arxiv.org/rss/cs.CL", "https://rss.arxiv.org/rss/cs.LG"],
      fetchEveryMinutes: 1440,
      weight: 0.95,
    },
    {
      id: "producthunt_ai",
      name: "Product Hunt AI",
      enabled: true,
      kind: "rss-keyword",
      feedUrl: "https://www.producthunt.com/feed",
      keywords: ["ai", "llm", "agent", "copilot", "automation"],
      fetchEveryMinutes: 60,
      weight: 0.75,
    },
  ],
  sectionWeights: {
    技术突破: 1.0,
    产品范式: 0.95,
    国外大厂动作: 0.9,
    国内大厂动作: 0.9,
    "代理式 AI": 1.0,
    "推理成本和 Token 经济": 0.95,
    "AI-UX": 0.8,
    "商业 ROI": 0.85,
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
      const title = findAll("title", block)[0] || "(无标题)";
      const link = findAll("link", block)[0] || (block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "#");
      const publishedAt =
        findAll("pubDate", block)[0] || findAll("published", block)[0] || findAll("updated", block)[0] || "";
      const source = findAll("source", block)[0] || "RSS";
      const summary = findAll("description", block)[0] || findAll("summary", block)[0] || "";
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

async function fetchGoogleNews(query, days) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  try {
    const res = await fetch(url);
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
      const res = await fetch(channel.feedUrl);
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssItems(xml)
        .filter((x) => inDaysWindow(x.publishedAt, days))
        .slice(0, cap)
        .map((x) => normalize(x, channel));
    }

    if (channel.kind === "rss-keyword") {
      const res = await fetch(channel.feedUrl);
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
          const res = await fetch(feedUrl);
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
      const res = await fetch(api, { headers: { "user-agent": "ai-24h-radar" } });
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
  if (sectionTitle === "国外大厂动作" && ["openai_blog", "anthropic_news", "google_ai_blog", "huggingface_blog"].includes(item.channelId)) score += 2;
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
      .map((item) => ({ item, score: rankForSection(section.title, item) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerSection * 2)
      .map((x) => x.item);

    let items = dedupeItems([...base, ...scoredCandidates]).slice(0, maxPerSection);

    if (items.length === 0 && SECTION_FALLBACK_CHANNELS[section.title]) {
      const fallbackChannels = SECTION_FALLBACK_CHANNELS[section.title];
      const fallback = dedupeItems(
        fallbackChannels.flatMap((channelId) => channelMap[channelId] || []),
      )
        .filter((item) => !used.has(`${item.link}::${item.title}`))
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
