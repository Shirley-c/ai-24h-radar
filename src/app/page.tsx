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
  { title: "国内外大厂动作", query: "OpenAI Google Microsoft Meta Baidu Alibaba AI" },
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

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

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
      if (!Number.isNaN(ts) && now - ts > ONE_DAY_MS) continue;

      items.push({ title, link, source, publishedAt: pubDate });
      if (items.length >= 6) break;
    }

    return items;
  } catch {
    return [];
  }
}

async function fetchNewsSections(): Promise<NewsSection[]> {
  return Promise.all(
    NEWS_QUERIES.map(async ({ title, query }) => ({
      title,
      query,
      items: await fetchGoogleNews(query),
    })),
  );
}

async function fetchStock(symbol: string, name: string, currency: string): Promise<StockItem> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return { symbol, name, currency, price: null, previousClose: null, changePct: null };

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes =
      result?.indicators?.quote?.[0]?.close?.filter((n: number | null) => typeof n === "number") || [];

    if (closes.length < 2) return { symbol, name, currency, price: null, previousClose: null, changePct: null };

    const previousClose = closes[closes.length - 2];
    const price = closes[closes.length - 1];
    const changePct = ((price - previousClose) / previousClose) * 100;

    return { symbol, name, currency, price, previousClose, changePct };
  } catch {
    return { symbol, name, currency, price: null, previousClose: null, changePct: null };
  }
}

async function fetchStocks(): Promise<StockItem[]> {
  return Promise.all(STOCKS.map((s) => fetchStock(s.symbol, s.name, s.currency)));
}

function pctClass(pct: number | null) {
  if (pct === null) return "text-slate-400";
  if (pct > 0) return "text-emerald-600 dark:text-emerald-400";
  if (pct < 0) return "text-rose-600 dark:text-rose-400";
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

function buildBrief(sections: NewsSection[], stocks: StockItem[]) {
  const lines: string[] = [];
  lines.push(`# AI 24h 简报`);
  lines.push(`- 时间：${new Date().toLocaleString("zh-CN", { hour12: false, timeZone: TZ })}`);
  lines.push("");
  lines.push("## 股票 24h 涨跌");
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

export default async function Home() {
  const [sections, stocks] = await Promise.all([fetchNewsSections(), fetchStocks()]);
  const now = new Date().toLocaleString("zh-CN", { hour12: false, timeZone: TZ });
  const brief = buildBrief(sections, stocks);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold md:text-3xl">AI 24h Radar</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            统一口径：过去 24 小时，时区 Asia/Shanghai。
          </p>
          <p className="mt-1 text-xs text-slate-400">更新时间：{now}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">AI 概念股 24h 涨跌幅</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stocks.map((s) => (
              <div key={s.symbol} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
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
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  信号强度 {signalScore(section.items)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">查询词：{section.query}</p>

              {section.items.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">暂无可用数据（稍后自动重试）。</p>
              ) : (
                <>
                  <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    摘要：近24小时捕获 {section.items.length} 条动态，来源 {new Set(section.items.map((i) => i.source)).size} 家。
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
