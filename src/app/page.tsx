import BriefCard from "@/components/BriefCard";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

type NewsSection = {
  title: string;
  query: string;
  items: NewsItem[];
};

type StockItem = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  currency: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Shanghai";

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
] as const;

const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet", currency: "USD" },
  { symbol: "002230.SZ", name: "科大讯飞", currency: "CNY" },
  { symbol: "300308.SZ", name: "中际旭创", currency: "CNY" },
  { symbol: "688111.SH", name: "金山办公", currency: "CNY" },
  { symbol: "600570.SH", name: "恒生电子", currency: "CNY" },
  { symbol: "002415.SZ", name: "海康威视", currency: "CNY" },
] as const;

export const revalidate = 1800;

function stripCData(input: string) {
  return input.replace("<![CDATA[", "").replace("]]>", "").trim();
}

function findAll(tag: string, xml: string) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) results.push(stripCData(match[1]));

  return results;
}

function toLocal(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("zh-CN", { hour12: false, timeZone: TZ });
}

async function fetchGoogleNews(query: string, days: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];

    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const now = Date.now();
    const items: NewsItem[] = [];

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

async function fetchNewsSections(days: number): Promise<NewsSection[]> {
  return Promise.all(
    NEWS_QUERIES.map(async ({ title, query }) => ({
      title,
      query,
      items: await fetchGoogleNews(query, days),
    })),
  );
}

async function fetchStock(symbol: string, name: string, currency: string, days: number): Promise<StockItem> {
  const rangeDays = Math.max(days + 2, 3);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rangeDays}d&interval=1d`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return { symbol, name, currency, price: null, previousClose: null, changePct: null };

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes =
      result?.indicators?.quote?.[0]?.close?.filter((n: number | null) => typeof n === "number") || [];

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

async function fetchStocks(days: number): Promise<StockItem[]> {
  return Promise.all(STOCKS.map((s) => fetchStock(s.symbol, s.name, s.currency, days)));
}

function pctClass(pct: number | null) {
  if (pct === null) return "text-slate-400";
  if (pct > 0) return "text-rose-600 dark:text-rose-400";
  if (pct < 0) return "text-emerald-600 dark:text-emerald-400";
  return "text-slate-500";
}

function fmtPct(pct: number | null) {
  if (pct === null) return "--";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function fmtPrice(price: number | null, currency: string) {
  if (price === null) return "--";
  return `${currency === "USD" ? "$" : "¥"}${price.toFixed(2)}`;
}

function signalScore(items: NewsItem[]) {
  if (items.length === 0) return 0;
  const uniqueSources = new Set(items.map((i) => i.source)).size;
  return Math.min(100, items.length * 12 + uniqueSources * 8);
}

function buildBrief(sections: NewsSection[], stocks: StockItem[], days: number) {
  const lines: string[] = [];
  lines.push(`# AI ${days}天简报`);
  lines.push(`- 时间：${new Date().toLocaleString("zh-CN", { hour12: false, timeZone: TZ })}`);
  lines.push("");
  lines.push(`## 股票 ${days}天涨跌`);
  for (const s of stocks) {
    lines.push(`- ${s.name} (${s.symbol})：${fmtPrice(s.price, s.currency)} / ${fmtPct(s.changePct)}`);
  }
  lines.push("");
  lines.push("## 重点资讯");
  for (const section of sections) {
    lines.push(`### ${section.title}`);
    const top = section.items.slice(0, 3);
    if (top.length === 0) {
      lines.push("- 暂无可用数据");
    } else {
      top.forEach((n) => lines.push(`- ${n.title} (${n.source})`));
    }
    lines.push("");
  }
  return lines.join("\n");
}

const DAY_OPTIONS = [1, 3, 7, 14, 30] as const;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const params = (await searchParams) || {};
  const parsedDays = Number(params.days || "1");
  const days = DAY_OPTIONS.includes(parsedDays as (typeof DAY_OPTIONS)[number]) ? parsedDays : 1;

  const [sections, stocks] = await Promise.all([fetchNewsSections(days), fetchStocks(days)]);
  const now = new Date().toLocaleString("zh-CN", { hour12: false, timeZone: TZ });
  const brief = buildBrief(sections, stocks, days);

  return (
    <main className="min-h-screen px-4 py-8 text-slate-900 dark:text-slate-100 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="glass-card rounded-3xl p-6">
          <h1 className="bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">AI 24h Radar</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            统一口径：过去 {days} 天，时区 Asia/Shanghai。
          </p>
          <p className="mt-1 text-xs text-slate-400">更新时间：{now}</p>
          <form className="mt-4 flex items-center gap-2" method="get">
            <label htmlFor="days" className="text-sm text-slate-600 dark:text-slate-300">
              时间范围
            </label>
            <select
              id="days"
              name="days"
              defaultValue={String(days)}
              className="rounded-xl border border-slate-300/70 bg-white/80 px-2 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  过去 {d} 天
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-slate-300/70 bg-white/80 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800"
            >
              应用
            </button>
          </form>
        </header>

        <section className="glass-card rounded-3xl p-6">
          <h2 className="text-xl font-semibold">AI 概念股 {days}天 涨跌幅</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stocks.map((s) => (
              <div key={s.symbol} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.symbol}</p>
                  </div>
                  <p className={`text-sm font-semibold ${pctClass(s.changePct)}`}>{fmtPct(s.changePct)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">现价：{fmtPrice(s.price, s.currency)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="glass-card rounded-3xl p-5 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <span className="rounded-full border border-slate-200/70 bg-slate-100/80 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  信号强度 {signalScore(section.items)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">查询词：{section.query}</p>

              {section.items.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">暂无可用数据（稍后自动重试）。</p>
              ) : (
                <>
                  <p className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                    摘要：近{days}天捕获 {section.items.length} 条动态，来源 {new Set(section.items.map((i) => i.source)).size} 家。
                  </p>
                  <ul className="mt-3 space-y-3">
                    {section.items.map((item) => (
                      <li key={`${item.link}-${item.title}`} className="text-sm leading-6">
                        <a
                          className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-blue-700 dark:text-slate-100 dark:decoration-slate-600"
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.title}
                        </a>
                        <div className="text-xs text-slate-500">
                          {item.source} · {toLocal(item.publishedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </section>

        <BriefCard markdown={brief} />
      </div>
    </main>
  );
}
