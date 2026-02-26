import fs from "node:fs/promises";
import path from "node:path";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Shanghai";
const DAY_OPTIONS = [1, 3, 7, 14, 30];

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

function stripCData(input) {
  return input.replace("<![CDATA[", "").replace("]]>", "").trim();
}

function findAll(tag, xml) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const results = [];
  let match;
  while ((match = regex.exec(xml)) !== null) results.push(stripCData(match[1]));
  return results;
}

async function fetchGoogleNews(query, days) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const now = Date.now();
    const items = [];
    for (const block of blocks) {
      const title = findAll("title", block)[0] || "(无标题)";
      const link = findAll("link", block)[0] || "#";
      const pubDate = findAll("pubDate", block)[0] || "";
      const source = findAll("source", block)[0] || "Google News";
      const ts = Date.parse(pubDate);
      if (!Number.isNaN(ts) && now - ts > ONE_DAY_MS * days) continue;
      items.push({ title, link, source, publishedAt: pubDate });
      if (items.length >= 6) break;
    }
    return items;
  } catch {
    return [];
  }
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
  const [sections, stocks] = await Promise.all([
    Promise.all(
      NEWS_QUERIES.map(async ({ title, query }) => ({
        title,
        query,
        items: await fetchGoogleNews(query, days),
      })),
    ),
    Promise.all(STOCKS.map((s) => fetchStock(s.symbol, s.name, s.currency, days))),
  ]);
  return { sections, stocks };
}

async function main() {
  const byDays = {};
  for (const d of DAY_OPTIONS) {
    byDays[d] = await generateForDay(d);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    timezone: TZ,
    dayOptions: DAY_OPTIONS,
    byDays,
  };

  const outPath = path.resolve("src/data/snapshot.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`snapshot updated: ${outPath}`);
}

main();
