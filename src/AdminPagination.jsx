import React from "react";

/**
 * The pager both admin tables use.
 *
 * Lifted out of SuperAdmin.js when the Payments panel needed the same control.
 * Its own module rather than an export from that page: PaymentsModal is
 * imported *by* SuperAdmin, so importing the pager back out of it would be a
 * cycle — and a pager is presentation with no idea what it is paging.
 *
 * PAGE_SIZES lives here too, for the same reason: the choices offered and the
 * control offering them are one decision.
 */
export const PAGE_SIZES = [10, 25, 50];

/**
 * Where a page begins and ends, given a total.
 *
 * Clamped rather than trusted: a page number survives a filter that shortens
 * the list under it, and the arithmetic that follows would otherwise slice past
 * the end and show nothing at all.
 *
 * @param {{total: number, page: number, pageSize: number}} spec
 * @returns {{page: number, pageCount: number, first: number, from: number, to: number}}
 */
export const pageBounds = ({ total, page, pageSize }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = (current - 1) * pageSize;
  return {
    page: current,
    pageCount,
    first,
    from: total ? first + 1 : 0,
    to: Math.min(first + pageSize, total),
  };
};

/**
 * Which slice of the table is on screen, and how to move through it.
 *
 * Prev/Next rather than a numbered strip: the useful moves through a list of
 * accounts are "the next few" and "back", and a row of page numbers is a lot of
 * furniture for a table that is normally one page long. The range is spelled
 * out because "Page 2 of 5" alone never says how many accounts that is.
 *
 * Rows per page lives here rather than in the settings panel: it is read and
 * changed in the same glance as the range it applies to, and the panel is for
 * the preferences you set once.
 *
 * @param {number} total rows after the search filter.
 * @param {number} page the page being shown, 1-based.
 * @param {number} pageCount how many there are, at least 1.
 * @param {number} pageSize rows per page.
 * @param {number} from 1-based index of the first row shown, 0 when none.
 * @param {number} to 1-based index of the last row shown.
 * @param {(page: number) => void} onPage
 * @param {(size: number) => void} onPageSize
 */
export function Pagination({ total, page, pageCount, pageSize, from, to, onPage, onPageSize }) {
  const step =
    "rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold " +
    "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 " +
    "disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav
      aria-label="Pagination"
      className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1"
    >
      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <span aria-live="polite" className="text-xs text-gray-500 dark:text-gray-400">
          {total ? from + "–" + to + " of " + total : "0 of 0"}
        </span>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className={step}
        >
          ← Prev
        </button>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className={step}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
