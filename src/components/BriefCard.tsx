"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

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
          {copied ? "已复制" : "复制 Markdown"}
        </button>
      </div>

      <article className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
        <ReactMarkdown
          components={{
            h1: ({ ...props }) => <h1 className="mb-3 text-2xl font-bold" {...props} />,
            h2: ({ ...props }) => <h2 className="mb-2 mt-5 text-xl font-semibold" {...props} />,
            h3: ({ ...props }) => <h3 className="mb-2 mt-4 text-lg font-semibold" {...props} />,
            p: ({ ...props }) => <p className="my-2" {...props} />,
            ul: ({ ...props }) => <ul className="my-2 list-disc pl-5" {...props} />,
            li: ({ ...props }) => <li className="my-1" {...props} />,
            a: ({ ...props }) => (
              <a
                className="text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
                target="_blank"
                rel="noreferrer"
                {...props}
              />
            ),
            strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </section>
  );
}
