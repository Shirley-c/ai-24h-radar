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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">今日简报（Markdown）</h2>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        {markdown}
      </pre>
    </section>
  );
}
