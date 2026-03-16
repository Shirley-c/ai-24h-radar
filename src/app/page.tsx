import Link from "next/link";
import BriefCard from "@/components/BriefCard";
import snapshot from "@/data/snapshot.json";

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

const TZ = "Asia/Shanghai";
const DAY_OPTIONS = [1, 3, 7, 14, 30] as const;
const SECTION_VISIBLE_LIMIT = 6;
const SECTION_ORDER = [
  "OpenClaw 生态",
  "国内外大厂动作",
  "技术突破",
  "AI-UX",
  "产品范式",
  "推理成本和 Token 经济",
  "代理式 AI",
  "商业 ROI",
];

function toLocal(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("zh-CN", { hour12: false, timeZone: TZ });
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

function buildBrief(sections: NewsSection[], stocks: StockItem[], days: number, updatedAt: string) {
  const lines: string[] = [];
  lines.push(`# AI ${days}天简报`);
  lines.push(`- 更新时间：${updatedAt}`);
  lines.push(`- 统计窗口：过去 ${days} 天`);
  lines.push("");

  lines.push(`## 股票 ${days}天涨跌`);
  for (const s of stocks) {
    lines.push(`- **${s.name}** (${s.symbol})：${fmtPrice(s.price, s.currency)} / ${fmtPct(s.changePct)}`);
  }
  lines.push("");

  lines.push("## 重点资讯");
  for (const section of sections) {
    lines.push(`### ${section.title}`);
    const top = section.items.slice(0, 3);
    if (top.length === 0) {
      lines.push("- 暂无可用数据");
    } else {
      top.forEach((n) => {
        lines.push(`- [${n.title}](${n.link})`);
        lines.push(`  - 来源：${n.source}`);
        lines.push(`  - 时间：${toLocal(n.publishedAt)}`);
      });
    }
    lines.push("");
  }
  return lines.join("\n");
}

type SnapshotShape = {
  generatedAt: string;
  timezone: string;
  dayOptions: number[];
  byDays: Record<string, { sections: NewsSection[]; stocks: StockItem[] }>;
};

const data = snapshot as SnapshotShape;

export default async function Home({
  searchParams,
}: {
  searchParams?: { days?: string };
}) {
  const params = searchParams || {};
  const parsedDays = Number(params.days || "1");
  const days = DAY_OPTIONS.includes(parsedDays as (typeof DAY_OPTIONS)[number]) ? parsedDays : 1;

  const byDay = data.byDays[String(days)] ?? { sections: [], stocks: [] };
  const sectionsRaw = byDay.sections || [];
  const sectionMap = new Map(sectionsRaw.map((s) => [s.title, s]));
  const sections = [
    ...SECTION_ORDER.map((t) => sectionMap.get(t)).filter(Boolean),
    ...sectionsRaw.filter((s) => !SECTION_ORDER.includes(s.title)),
  ] as NewsSection[];
  const stocks = byDay.stocks || [];

  const generatedAtText = toLocal(data.generatedAt);
  const brief = buildBrief(sections, stocks, days, generatedAtText);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold md:text-3xl">AI 24h Radar</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            统一口径：过去 {days} 天，时区 {data.timezone || TZ}。
          </p>
          <p className="mt-1 text-xs text-slate-400">更新时间：{generatedAtText}</p>
          <form className="mt-4 flex items-center gap-2" method="get">
            <label htmlFor="days" className="text-sm text-slate-600 dark:text-slate-300">
              时间范围
            </label>
            <select
              id="days"
              name="days"
              defaultValue={String(days)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  过去 {d} 天
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              应用
            </button>
          </form>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">AI 概念股 {days}天 涨跌幅</h2>
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

              {section.items.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">暂无可用数据（下次数据任务会自动刷新）。</p>
              ) : (
                <>
                  <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    摘要：近{days}天捕获 {section.items.length} 条动态，来源 {new Set(section.items.map((i) => i.source)).size} 家。
                  </p>
                  <ul className="mt-3 space-y-3">
                    {section.items.slice(0, SECTION_VISIBLE_LIMIT).map((item) => (
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
                  {section.items.length > SECTION_VISIBLE_LIMIT ? (
                    <div className="mt-3">
                      <Link
                        href={`/section/${section.title}`}
                        className="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        More（共 {section.items.length} 条）
                      </Link>
                    </div>
                  ) : null}
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
