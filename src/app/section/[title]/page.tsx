import Link from "next/link";
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

type SnapshotShape = {
  generatedAt: string;
  timezone: string;
  dayOptions: number[];
  byDays: Record<string, { sections: NewsSection[] }>;
};

const TZ = "Asia/Shanghai";
const DAY_OPTIONS = [1, 3, 7, 14, 30] as const;

function toLocal(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("zh-CN", { hour12: false, timeZone: TZ });
}

const data = snapshot as SnapshotShape;

export function generateStaticParams() {
  const titles = new Set<string>();
  for (const d of Object.keys(data.byDays || {})) {
    const sections = data.byDays[d]?.sections || [];
    for (const s of sections) titles.add(s.title);
  }
  return [...titles].map((title) => ({ title }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ title?: string }>;
}) {
  const resolvedParams = await params;
  const rawTitle = resolvedParams?.title || "";
  const days = 1;

  let normalizedTitle = rawTitle;
  try {
    normalizedTitle = decodeURIComponent(rawTitle);
  } catch {
    normalizedTitle = rawTitle;
  }

  const decodedTitle = normalizedTitle || "未命名分类";
  const byDay = data.byDays[String(days)] ?? { sections: [] };
  const section = normalizedTitle ? (byDay.sections || []).find((s) => s.title === normalizedTitle) : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{decodedTitle}</h1>
          <Link
            href="/"
            className="text-sm text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
          >
            ← 返回首页
          </Link>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">过去 {days} 天 · 共 {section?.items.length || 0} 条</p>

        {!section || section.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            暂无可用数据。
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ul className="space-y-4">
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
          </section>
        )}
      </div>
    </main>
  );
}
