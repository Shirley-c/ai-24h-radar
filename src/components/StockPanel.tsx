"use client";

import { useEffect, useMemo, useState } from "react";

type StockItem = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  currency: string;
};

type StockCandidate = {
  symbol: string;
  name: string;
  currency: string;
};

type Props = {
  stocks: StockItem[];
  days: number;
};

const STORAGE_KEY = "ai24h:selectedStocks:v1";

const STOCK_CANDIDATES: StockCandidate[] = [
  { symbol: "NVDA", name: "NVIDIA", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet", currency: "USD" },
  { symbol: "AMZN", name: "Amazon", currency: "USD" },
  { symbol: "META", name: "Meta", currency: "USD" },
  { symbol: "AAPL", name: "Apple", currency: "USD" },
  { symbol: "TSLA", name: "Tesla", currency: "USD" },
  { symbol: "AMD", name: "AMD", currency: "USD" },
  { symbol: "AVGO", name: "Broadcom", currency: "USD" },
  { symbol: "ASML", name: "ASML", currency: "USD" },
  { symbol: "002230.SZ", name: "科大讯飞", currency: "CNY" },
  { symbol: "300308.SZ", name: "中际旭创", currency: "CNY" },
  { symbol: "688111.SS", name: "金山办公", currency: "CNY" },
  { symbol: "600570.SS", name: "恒生电子", currency: "CNY" },
  { symbol: "002415.SZ", name: "海康威视", currency: "CNY" },
  { symbol: "9988.HK", name: "阿里巴巴-SW", currency: "HKD" },
  { symbol: "0700.HK", name: "腾讯控股", currency: "HKD" },
  { symbol: "1810.HK", name: "小米集团-W", currency: "HKD" },
  { symbol: "9888.HK", name: "百度集团-SW", currency: "HKD" },
];

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
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "HKD") return `HK$${price.toFixed(2)}`;
  return `¥${price.toFixed(2)}`;
}

export default function StockPanel({ stocks, days }: Props) {
  const baseSymbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(baseSymbols);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setSelectedSymbols(baseSymbols);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSelectedSymbols(parsed.filter((x) => typeof x === "string"));
      } else {
        setSelectedSymbols(baseSymbols);
      }
    } catch {
      setSelectedSymbols(baseSymbols);
    }
  }, [baseSymbols]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedSymbols));
  }, [selectedSymbols]);

  const stockMap = useMemo(() => new Map(stocks.map((s) => [s.symbol, s])), [stocks]);
  const candidateMap = useMemo(() => new Map(STOCK_CANDIDATES.map((s) => [s.symbol, s])), []);

  const selectedStocks: StockItem[] = selectedSymbols
    .map((symbol) => {
      const fromSnapshot = stockMap.get(symbol);
      if (fromSnapshot) return fromSnapshot;
      const fallback = candidateMap.get(symbol);
      if (!fallback) return null;
      return {
        symbol: fallback.symbol,
        name: fallback.name,
        currency: fallback.currency,
        price: null,
        previousClose: null,
        changePct: null,
      } as StockItem;
    })
    .filter(Boolean) as StockItem[];

  const filteredCandidates = STOCK_CANDIDATES.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    if (selectedSymbols.includes(c.symbol)) return false;
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  }).slice(0, 8);

  function addSymbol(symbol: string) {
    setSelectedSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
    setQuery("");
  }

  function removeSymbol(symbol: string) {
    setSelectedSymbols((prev) => prev.filter((s) => s !== symbol));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">AI 概念股 {days}天 涨跌幅</h2>
        <div className="relative w-full max-w-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索股票代码/名称，回车后点击添加"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          {filteredCandidates.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1 shadow dark:border-slate-700 dark:bg-slate-900">
              {filteredCandidates.map((c) => (
                <button
                  key={c.symbol}
                  type="button"
                  onClick={() => addSymbol(c.symbol)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>
                    {c.name} <span className="text-slate-500">({c.symbol})</span>
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-300">添加</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {selectedStocks.map((s) => (
          <div key={s.symbol} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">{s.symbol}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${pctClass(s.changePct)}`}>{fmtPct(s.changePct)}</p>
                <button
                  type="button"
                  onClick={() => removeSymbol(s.symbol)}
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="移除"
                >
                  移除
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">现价：{fmtPrice(s.price, s.currency)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
