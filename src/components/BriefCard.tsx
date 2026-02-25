"use client";

import { useState } from "react";

type Props = {
  markdown: string;
};

export default function BriefCard({ markdown }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">今日简报（Markdown）</h2>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl border border-slate-300/70 bg-white/70 px-3 py-1.5 text-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-xs leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
        {markdown}
      </pre>
    </section>
  );
}
