import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, EnvelopeIcon } from "@heroicons/react/24/solid";
import { getContactMessages } from "./api/contact";
// The same pager the accounts table uses — see ./AdminPagination for why it is
// its own module rather than an export from SuperAdmin.
import { PAGE_SIZES, Pagination, pageBounds } from "./AdminPagination";

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

/**
 * Every Contact Us submission, read back for the Super Admin.
 *
 * Its own panel rather than a section of some other one, same reasoning as
 * Payments and HomePage analytics next to it: this is a view of its own data
 * source, behind its own guard, and folding it into an unrelated panel would
 * only make that one harder to read.
 */
export default function ContactMessagesModal({ onClose }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const load = useCallback(() => {
    setLoading(true);
    getContactMessages({ limit: 500 })
      .then((rows) => {
        setMessages(rows);
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

  useEffect(() => setPage(1), [query, pageSize]);

  const rows = useMemo(() => {
    const all = messages || [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (m) =>
        String(m.name).toLowerCase().includes(q) ||
        String(m.email).toLowerCase().includes(q) ||
        String(m.subject || "").toLowerCase().includes(q) ||
        String(m.message).toLowerCase().includes(q),
    );
  }, [messages, query]);

  const bounds = pageBounds({ total: rows.length, page, pageSize });
  const shown = rows.slice(bounds.first, bounds.first + pageSize);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contact messages"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <EnvelopeIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contact messages
          </h3>
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
            aria-label="Close contact messages"
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

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, subject or message"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            aria-label="Search contact messages"
          />

          {loading && !messages ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Reading…</p>
          ) : !rows.length ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {query.trim() ? "Nothing matches." : "No one has used the Contact Us form yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Received</th>
                    <th className="py-2 pr-3 font-semibold">From</th>
                    <th className="py-2 pr-3 font-semibold">Subject</th>
                    <th className="py-2 font-semibold">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-gray-100 dark:border-gray-700 last:border-0 align-top"
                    >
                      <td className="py-2 pr-3 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                        <When at={m.submittedAt} />
                      </td>
                      <td className="max-w-[180px] py-2 pr-3 text-gray-800 dark:text-gray-100">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {m.email}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {m.subject || <span className="text-gray-400">—</span>}
                      </td>
                      <td
                        className="max-w-[320px] whitespace-pre-wrap break-words py-2 text-gray-700 dark:text-gray-200"
                        title={m.message}
                      >
                        {m.message}
                      </td>
                    </tr>
                  ))}
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
            Every submission from the public Contact Us page, oldest ones included — nothing here
            is ever deleted automatically.
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
