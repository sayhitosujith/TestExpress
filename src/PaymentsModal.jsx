import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, CreditCardIcon } from "@heroicons/react/24/solid";
import { getPayments } from "./api/payments";
import { money } from "./plans";
// The same pager the accounts table uses — see ./AdminPagination for why it is
// its own module rather than an export from SuperAdmin.
import { PAGE_SIZES, Pagination, pageBounds } from "./AdminPagination";

/**
 * The payment ledger: every checkout, what became of it, and what was collected.
 *
 * Its own panel rather than a section of Subscriptions, because they answer
 * different questions about different things. Subscriptions is about accounts —
 * who is on which plan now. This is about transactions — what was attempted,
 * what settled, and what was abandoned on the way. An account appears once in
 * one and any number of times in the other.
 *
 * One distinction the panel keeps insisting on: a checkout settled by the
 * simulation is a real change to an account and no money at all. Folding those
 * into "collected" would report a bank balance that does not exist, so they are
 * counted apart and marked on the row.
 */

const STATUS = {
  paid: { label: "Paid", tone: "text-green-700 dark:text-green-400" },
  pending: { label: "Pending", tone: "text-amber-700 dark:text-amber-400" },
  cancelled: { label: "Cancelled", tone: "text-gray-500 dark:text-gray-400" },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cancelled", label: "Cancelled" },
];

/** Date over time, because the column is narrow and both matter. */
function When({ at }) {
  if (!at) return <span className="text-gray-400">—</span>;
  const d = new Date(at);
  return (
    <>
      <span className="block">{d.toLocaleDateString()}</span>
      <span className="block text-gray-400 dark:text-gray-500">{d.toLocaleTimeString()}</span>
    </>
  );
}

/** A headline number with its name under it. */
function Stat({ label, value, note, tone }) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
      <div className={"text-2xl font-black tabular-nums " + (tone || "text-gray-900 dark:text-gray-100")}>
        {value}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{note}</div>}
    </div>
  );
}

export default function PaymentsModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const load = useCallback(() => {
    setLoading(true);
    getPayments({ limit: 500 })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => setPage(1), [filter, query, pageSize]);

  const rows = useMemo(() => {
    const all = (data && data.payments) || [];
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => filter === "all" || r.status === filter)
      .filter(
        (r) =>
          !q ||
          String(r.email).toLowerCase().includes(q) ||
          String(r.plan).toLowerCase().includes(q) ||
          String(r.paymentId || "").toLowerCase().includes(q),
      );
  }, [data, filter, query]);

  // Clamped, because a page number outlives the filter that shortened the list.
  const bounds = pageBounds({ total: rows.length, page, pageSize });
  const shown = rows.slice(bounds.first, bounds.first + pageSize);

  const summary = (data && data.summary) || {};
  const gateway = (data && data.gateway) || {};

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Payments"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <CreditCardIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Payments</h3>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Re-read now"
            title="Re-read now"
            className="rounded-md border border-gray-300 dark:border-gray-600 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payments"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && (
            <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          )}

          {/* What the gateway is, before any figure is read. "Collected" means
              something quite different on test keys, and a total that did not
              say which is a total nobody can act on. */}
          {!gateway.configured ? (
            <p className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/25 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              No payment gateway is configured, so every settled checkout below was settled by the
              simulation — the plans were granted and <b>no money moved</b>.
            </p>
          ) : gateway.mode === "test" ? (
            <p className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/25 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              Razorpay is in <b>test mode</b>. These are real checkouts against real orders, but
              no money has moved and nothing here will appear in a settlement.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Stat
              label="Collected"
              value={money(summary.collected || 0, summary.currency)}
              note={(summary.paid || 0) + " settled"}
              tone="text-green-700 dark:text-green-400"
            />
            <Stat
              label="Started, not paid"
              value={money(summary.pendingAmount || 0, summary.currency)}
              note={(summary.pending || 0) + " pending"}
              tone={summary.pending ? "text-amber-700 dark:text-amber-400" : undefined}
            />
            <Stat label="Cancelled" value={summary.cancelled || 0} note="abandoned at the payment step" />
            {summary.simulated > 0 && (
              <Stat
                label="Of those, simulated"
                value={summary.simulated}
                note="plan granted, no money"
                tone="text-amber-700 dark:text-amber-400"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition " +
                    (filter === f.id
                      ? "bg-green-600 text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, plan or payment id"
              className="min-w-[160px] flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              aria-label="Search payments"
            />
          </div>

          {loading && !data ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Reading…</p>
          ) : !rows.length ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {query.trim() || filter !== "all"
                ? "Nothing matches."
                : "No checkout has been opened yet. One is created when somebody registers on a paid plan, or when an administrator sends a payment link."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Account</th>
                    <th className="py-2 pr-3 font-semibold">Plan</th>
                    <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Opened</th>
                    <th className="py-2 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const st = STATUS[r.status] || { label: r.status, tone: "" };
                    // A settlement with no gateway behind it granted a plan and
                    // took nothing. Marked on the row, not just in the totals,
                    // because this is the row somebody would quote in a dispute.
                    const noMoney = r.status === "paid" && r.gateway !== "razorpay";
                    return (
                      <tr
                        key={r.token}
                        className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <td className="max-w-[200px] truncate py-2 pr-3 text-gray-800 dark:text-gray-100">
                          {r.email}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.plan}</td>
                        <td className="py-2 pr-3 text-right font-mono text-xs text-gray-800 dark:text-gray-100">
                          {money(r.amount || 0, r.currency)}
                        </td>
                        <td className={"py-2 pr-3 text-xs font-bold " + st.tone}>
                          {st.label}
                          {noMoney && (
                            <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">
                              (simulated)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                          <When at={r.createdAt} />
                        </td>
                        <td className="max-w-[150px] truncate py-2 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                          {r.paymentId || r.orderId || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <Pagination
              total={rows.length}
              page={bounds.page}
              pageCount={bounds.pageCount}
              pageSize={pageSize}
              from={bounds.from}
              to={bounds.to}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
          <span className="flex-1 text-[11px] text-gray-500 dark:text-gray-400">
            A checkout is opened when somebody registers on a paid plan, upgrades from the
            recorder, or is sent a payment link from Subscriptions.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
