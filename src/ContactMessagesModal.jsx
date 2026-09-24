import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import {
  bulkDeleteContactMessages,
  bulkReplyToContactMessages,
  getContactMessages,
  replyToContactMessage,
} from "./api/contact";
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
  // Which rows have their reply panel open, by message id — a Set rather than
  // one open row, the same choice SuperAdmin's seats disclosure makes: an
  // administrator answering several people wants more than one open at once.
  const [openReply, setOpenReply] = useState(() => new Set());
  // The draft text for each open panel, keyed by message id so switching
  // between two open replies does not lose either one.
  const [drafts, setDrafts] = useState({});
  // The id currently sending, so its button can say so and nothing else about
  // the panel needs to change while the request is in flight.
  const [sendingId, setSendingId] = useState(null);
  const [sendErrors, setSendErrors] = useState({});

  // Bulk reply: which rows are checked, whether the one shared composer is
  // open, its draft, and the outcome of the last send. Selection is a Set of
  // ids rather than page indices, so it survives paging and search the same
  // way `openReply` already does.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDraft, setBulkDraft] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkResult, setBulkResult] = useState(null); // {sentCount, failed: [{id, error}]}

  // Bulk delete: its own in-flight/error state, separate from the reply
  // composer's — a delete can be fired straight from the toolbar, with no
  // panel of its own to share state with.
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState(null);

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

  const toggleReply = (id) =>
    setOpenReply((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Sends the drafted reply and, only once the email actually went out,
   * appends it to that message's history and clears the draft.
   *
   * The record in `messages` is patched from the server's own answer rather
   * than by guessing what it now looks like — the same reasoning SuperAdmin's
   * `replace` uses for an account after a save.
   */
  const sendReply = async (id) => {
    const text = (drafts[id] || "").trim();
    if (!text) return;
    setSendingId(id);
    setSendErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const updated = await replyToContactMessage(id, text);
      setMessages((list) => list.map((m) => (m.id === id ? updated : m)));
      setDrafts((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      setSendErrors((prev) => ({ ...prev, [id]: err.message }));
    } finally {
      setSendingId(null);
    }
  };

  const toggleSelected = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkOpen(false);
    setBulkDraft("");
    setBulkError(null);
    setBulkResult(null);
    setBulkDeleteError(null);
  };

  /**
   * Sends one drafted reply to every selected submission and folds the
   * per-id results back into `messages` — only the ones that actually sent
   * get a new reply recorded, mirroring `sendReply`'s send-before-save
   * contract but one id at a time instead of one request.
   */
  const sendBulkReply = async () => {
    const text = bulkDraft.trim();
    const ids = Array.from(selectedIds);
    if (!text || !ids.length) return;
    setBulkSending(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const results = await bulkReplyToContactMessages(ids, text);
      const succeeded = results.filter((r) => r.sent);
      const failed = results.filter((r) => !r.sent);
      if (succeeded.length) {
        setMessages((list) =>
          list.map((m) => succeeded.find((r) => r.id === m.id)?.message || m),
        );
      }
      setBulkResult({ sentCount: succeeded.length, failed });
      if (!failed.length) {
        clearSelection();
      } else {
        // Leave only the failures selected, so retrying re-sends to them alone.
        setSelectedIds(new Set(failed.map((r) => r.id)));
        setBulkDraft(text);
      }
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSending(false);
    }
  };

  /**
   * Permanently removes every selected submission. Confirmed here rather than
   * left to the server, same as the old grid's per-row delete — this is the
   * one action in this panel with no undo, so it is the one worth a native
   * confirm() even though nothing else here uses one.
   */
  const deleteBulkSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (
      !window.confirm(
        `Permanently delete ${ids.length} message${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      await bulkDeleteContactMessages(ids);
      setMessages((list) => list.filter((m) => !selectedIds.has(m.id)));
      clearSelection();
    } catch (err) {
      setBulkDeleteError(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

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
  const allShownSelected = shown.length > 0 && shown.every((m) => selectedIds.has(m.id));
  const toggleSelectAllShown = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      shown.forEach((m) => (allShownSelected ? next.delete(m.id) : next.add(m.id)));
      return next;
    });

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

          {selectedIds.size > 0 && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={deleteBulkSelected}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {bulkDeleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                >
                  <UserGroupIcon className="h-3.5 w-3.5" />
                  Bulk reply
                </button>
              </div>

              {bulkDeleteError && (
                <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-400">
                  {bulkDeleteError}
                </p>
              )}

              {bulkOpen && (
                <div className="mt-3">
                  <textarea
                    rows={3}
                    value={bulkDraft}
                    onChange={(e) => setBulkDraft(e.target.value)}
                    placeholder={`Write one reply — it is emailed to all ${selectedIds.size} selected people`}
                    disabled={bulkSending}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 disabled:opacity-60"
                  />
                  {bulkError && (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{bulkError}</p>
                  )}
                  {bulkResult && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Sent to {bulkResult.sentCount}. {bulkResult.failed.length} failed and stayed
                      selected — fix and resend: {bulkResult.failed.map((f) => f.error).join("; ")}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkOpen(false)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={sendBulkReply}
                      disabled={bulkSending || !bulkDraft.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <PaperAirplaneIcon className="h-3.5 w-3.5" />
                      {bulkSending ? "Sending…" : `Send to ${selectedIds.size}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    <th className="py-2 pr-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={allShownSelected}
                        onChange={toggleSelectAllShown}
                        aria-label="Select all shown"
                        className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    <th className="py-2 pr-3 font-semibold">Received</th>
                    <th className="py-2 pr-3 font-semibold">From</th>
                    <th className="py-2 pr-3 font-semibold">Subject</th>
                    <th className="py-2 pr-3 font-semibold">Message</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {shown.flatMap((m) => {
                    const replies = m.replies || [];
                    const open = openReply.has(m.id);
                    return [
                      <tr
                        key={m.id}
                        className="border-b border-gray-100 dark:border-gray-700 last:border-0 align-top"
                      >
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(m.id)}
                            onChange={() => toggleSelected(m.id)}
                            aria-label={`Select message from ${m.name}`}
                            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                          />
                        </td>
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
                          className="max-w-[320px] whitespace-pre-wrap break-words py-2 pr-3 text-gray-700 dark:text-gray-200"
                          title={m.message}
                        >
                          {m.message}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleReply(m.id)}
                            aria-expanded={open}
                            title={
                              replies.length
                                ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"} sent`
                                : "Reply to this message"
                            }
                            className={
                              "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold " +
                              (replies.length
                                ? "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700")
                            }
                          >
                            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                            {replies.length ? `Replied (${replies.length})` : "Reply"}
                          </button>
                        </td>
                      </tr>,
                      open ? (
                        <tr key={m.id + "-reply"} className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                          <td />
                          <td />
                          <td colSpan={4} className="px-0 py-3 pr-3">
                            {replies.length > 0 && (
                              <ul className="mb-3 space-y-2">
                                {replies.map((r, i) => (
                                  <li
                                    key={i}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs"
                                  >
                                    <div className="mb-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                                        {r.sentBy || "An administrator"}
                                      </span>
                                      {r.sentAt && (
                                        <span>{new Date(r.sentAt).toLocaleString()}</span>
                                      )}
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
                                      {r.message}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Reply to {m.name}
                            </label>
                            <textarea
                              rows={3}
                              value={drafts[m.id] || ""}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              placeholder="Write a reply — it is emailed to them, not just saved here"
                              disabled={sendingId === m.id}
                              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 disabled:opacity-60"
                            />
                            {sendErrors[m.id] && (
                              <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
                                {sendErrors[m.id]}
                              </p>
                            )}
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => toggleReply(m.id)}
                                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Close
                              </button>
                              <button
                                type="button"
                                onClick={() => sendReply(m.id)}
                                disabled={sendingId === m.id || !(drafts[m.id] || "").trim()}
                                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                <PaperAirplaneIcon className="h-3.5 w-3.5" />
                                {sendingId === m.id ? "Sending…" : "Send reply"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
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
