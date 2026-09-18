import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowPathIcon, ChartBarIcon } from "@heroicons/react/24/solid";
import {
  getAnalyticsMirror,
  getHomePageAnalytics,
  syncAnalyticsMirror,
} from "./api/homePageAnalytics";
// The vocabulary the landing page writes: the section order, and readable names
// for the calls to action. Imported rather than restated so a button renamed on
// the page is renamed here too.
import { HOMEPAGE_SECTIONS, ctaLabel } from "./homePageTracking";
// The marks. Everything about how a figure is drawn — which encodings a chart
// offers, how a bar is shaped, what the hover layer says — lives next door, so
// this file stays about fetching the numbers and laying the panel out.
import {
  BarList,
  DailyVisits,
  Segmented,
  Stat,
  densify,
} from "./HomePageAnalyticsCharts";

/** The windows offered. Short enough to read a launch, long enough for a trend. */
const RANGES = [7, 30, 90];

/** A count as a share of the visits it came from, rounded to a whole percent. */
const share = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/**
 * What the public landing page did, read back from the action log.
 *
 * Fetches its own data rather than being handed it: nothing else on the Super
 * Admin page wants these numbers, so loading them in the page would put a
 * request on every administrator's first paint to fill a panel most of them
 * will never open.
 *
 * The refresh cadence arrives as a prop rather than being chosen here, and that
 * is the point: it is the same preference the accounts table reads, so one
 * control on one settings panel says how often this screen re-reads itself. A
 * second timer with its own switch would be a second thing to find, and the two
 * would disagree the first time someone changed one of them.
 *
 * @param {{refreshMs: number, refreshLabel: string, onClose: () => void}} props
 *   `refreshMs` of 0 means the timer is off; `refreshLabel` is how that cadence
 *   is written on the settings panel, so the status line below says the same
 *   words back.
 */
export default function HomePageAnalyticsModal({ refreshMs = 0, refreshLabel, onClose }) {
  const [days, setDays] = useState(30);
  // The online copy. These figures are counted from the local SQLite log, which
  // sits beside the backend and starts from zero on a new machine — so the one
  // thing this panel cannot otherwise say is whether any of it is kept
  // anywhere else. See Backend/homeAnalyticsDb.
  const [mirror, setMirror] = useState(null);
  const [mirroring, setMirroring] = useState(false);
  const [mirrorNote, setMirrorNote] = useState(null);

  const readMirror = useCallback(() => {
    getAnalyticsMirror()
      .then(setMirror)
      .catch((err) => setMirrorNote(err.message));
  }, []);

  useEffect(() => {
    readMirror();
  }, [readMirror]);

  const copyAcross = async () => {
    setMirroring(true);
    setMirrorNote(null);
    try {
      const { mirrored } = await syncAnalyticsMirror();
      setMirrorNote(
        mirrored + " event" + (mirrored === 1 ? "" : "s") + " are in the online database.",
      );
      readMirror();
    } catch (err) {
      setMirrorNote(err.message);
    } finally {
      setMirroring(false);
    }
  };
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Which read is the current one.
   *
   * A ticket per request rather than a flag per effect, because there are now
   * three ways to start one — opening the panel, changing the range, and the
   * timer — and any of them can be in flight when the next begins. Only the
   * newest ticket is allowed to paint, so a slow answer about the last 90 days
   * cannot land on top of the 7-day window someone has since selected.
   */
  const latest = useRef(0);

  /**
   * Re-reads the summary.
   *
   * `quiet` leaves the loading flag alone, which is what the timer needs:
   * blanking the panel every thirty seconds would make a preference meant to
   * keep it current the reason it is unreadable. A failure is still reported
   * either way, over the top of the figures already on screen — stale numbers
   * with a banner saying so beat an empty panel, and a refresh that stopped
   * working silently is worse than either.
   */
  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const ticket = latest.current + 1;
      latest.current = ticket;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const summary = await getHomePageAnalytics({ days });
        if (ticket !== latest.current) return;
        setData(summary);
        setLastLoadedAt(Date.now());
      } catch (err) {
        if (ticket === latest.current) setError(err.message);
      } finally {
        if (ticket === latest.current) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [days],
  );

  // Opening the panel, and every change of range: `load` is rebuilt when `days`
  // changes, which is what makes this one effect cover both.
  useEffect(() => {
    load();
  }, [load]);

  // The timer. Nothing to hold it off for — this panel reads and never writes,
  // so unlike the accounts table there is no open editor for a refresh to
  // overwrite.
  useEffect(() => {
    if (!refreshMs) return undefined;
    const id = setInterval(() => load({ quiet: true }), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, load]);

  const status =
    (lastLoadedAt
      ? "Read at " + new Date(lastLoadedAt).toLocaleTimeString()
      : "Not read yet") +
    (refreshMs && refreshLabel ? " — every " + refreshLabel : " — auto-refresh off");

  const series = useMemo(() => (data ? densify(data.daily, data.days) : []), [data]);

  const ctaRows = useMemo(() => {
    if (!data) return [];
    return data.ctas.map((row) => ({
      key: row.target || "unknown",
      label: ctaLabel(row.target),
      value: row.clicks,
      caption:
        row.clicks.toLocaleString() +
        " from " +
        row.visits.toLocaleString() +
        (row.visits === 1 ? " visit" : " visits"),
    }));
  }, [data]);

  const sectionRows = useMemo(() => {
    if (!data) return [];
    const counted = new Map(data.sections.map((r) => [r.section, r.visits]));
    // Page order first, then anything the table holds that the page no longer
    // has a section for: a renamed section should show up as a stale row rather
    // than disappear and take its history with it.
    const known = HOMEPAGE_SECTIONS.map(({ id, label }) => ({ id, label }));
    const extra = [...counted.keys()]
      .filter((id) => id && !HOMEPAGE_SECTIONS.some((s) => s.id === id))
      .map((id) => ({ id, label: id + " (no longer on the page)" }));
    return [...known, ...extra].map(({ id, label }) => {
      const visits = counted.get(id) || 0;
      return {
        key: id,
        label,
        value: visits,
        caption: share(visits, data.visits) + "% · " + visits.toLocaleString(),
      };
    });
  }, [data]);

  return (
    <div
      // Only a hit on the backdrop itself closes it; a click that started on
      // the sheet must not, or dragging to select text throws the panel away.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="HomePage analytics"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <ChartBarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            HomePage analytics
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close analytics"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* The one filter, in a row above everything it filters. */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <Segmented
            label="Last"
            options={RANGES.map((n) => ({ value: n, label: n + " days" }))}
            value={days}
            onChange={setDays}
          />
          <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
            {loading ? "Reading…" : status}
          </span>
          <button
            type="button"
            onClick={() => load({ quiet: true })}
            disabled={loading || refreshing}
            aria-label="Re-read now"
            // There has to be a way to ask for fresh figures with the timer
            // switched off, and the range buttons are not it: pressing "7 days"
            // while already on 7 days is a no-op to look at, and pressing
            // another one answers a different question.
            title="Re-read now"
            className="rounded-md border border-gray-300 dark:border-gray-600 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          {error && (
            <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          )}

          {data && data.visits === 0 && !error && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No landing-page activity in this window. The page reports a visit the moment
              someone opens it, so an empty panel means nobody has — or that the backend
              was not reachable when they did.
            </p>
          )}

          {data && data.visits > 0 && (
            <>
              <div className="flex flex-wrap gap-3">
                <Stat label="Visits" value={data.visits} note={"Last " + data.days + " days"} />
                <Stat
                  label="Visits that clicked"
                  value={data.visitsWithCta}
                  note={share(data.visitsWithCta, data.visits) + "% of visits"}
                />
                <Stat label="Clicks" value={data.ctaClicks} note="Every press, repeats included" />
              </div>

              <DailyVisits series={series} />

              <BarList
                title="Where they clicked"
                rows={ctaRows}
                max={Math.max(1, ...ctaRows.map((r) => r.value))}
                empty="Nobody pressed anything in this window."
                valueHeading="Clicks"
              />

              <BarList
                title="How far down they got"
                rows={sectionRows}
                max={data.visits}
                empty="No sections reached."
                valueHeading="Reach"
              />
            </>
          )}

          {/* Where these numbers live, and whether anything else has a copy.
              Worth a row of its own: the log is a file beside the backend, so
              "we have six months of traffic" and "we have six months of traffic
              on this one machine" look identical from everywhere else in this
              panel. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="min-w-[200px] flex-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Online copy
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {!mirror
                  ? "Checking…"
                  : !mirror.configured
                    ? "No online database configured, so these events exist only in the log file beside the backend. Set DATABASE_URL in src/Backend/.env to keep a copy."
                    : mirror.error
                      ? "The online database could not be read — " + mirror.error
                      : mirror.events.toLocaleString() +
                        " event" +
                        (mirror.events === 1 ? "" : "s") +
                        " mirrored. New ones are copied across as they land; use Copy across for anything logged before that."}
              </div>
              {mirrorNote && (
                <div className="mt-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
                  {mirrorNote}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={copyAcross}
              disabled={mirroring || !mirror || !mirror.configured}
              title={
                mirror && !mirror.configured
                  ? "Set DATABASE_URL in src/Backend/.env first"
                  : "Copy the local log's landing-page events into the online database. Safe to press twice — the rows are keyed on the local id."
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {mirroring ? "Copying…" : "Copy across"}
            </button>
          </div>

          <p className="border-t border-gray-200 dark:border-gray-700 pt-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Counted from the action log this app already keeps, not from a third-party
            tracker: no cookie is set and nothing leaves this server. A visit is one page
            load, so someone who opens the page twice is two visits, and a section counts
            once per visit however often they scroll back past it. Days are UTC.
          </p>
        </div>
      </div>
    </div>
  );
}
