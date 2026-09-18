import React, { useEffect, useMemo, useRef, useState } from "react";

// How the HomePage analytics panel draws its numbers.
//
// Its own module because the panel next door is about reading data -- fetching,
// polling, mirroring -- and this is about encoding it. They change for
// different reasons: a new endpoint touches the modal, a new chart type touches
// this file, and neither should have to open the other. HomePageAnalyticsModal
// composes what is exported here.

/**
 * The one colour every mark in this module is drawn in.
 *
 * A single hue because every chart here is a single series: magnitude, not
 * identity, so there is nothing for a second hue to distinguish. This step
 * clears the lightness band, the chroma floor and 3:1 contrast against both the
 * light and the dark panel surface, which is why one value serves both themes
 * rather than the usual pair.
 */
export const MARK = "#059669";

/** Plot height. Every encoding uses it, so switching type never moves the page. */
const PLOT_H = 112;

/** Margin inside the plot: a 4px end-marker plus the 2px ring around it. */
const PAD = 8;

/**
 * Widest a bar is allowed to get.
 *
 * At seven days the band is around eighty pixels, and a mark that wide is a
 * block rather than a bar. Past the cap the leftover band becomes air.
 */
const BAR_MAX = 24;

/** UTC, because created_at is written with SQLite's datetime('now'). */
const utcDay = (date) => date.toISOString().slice(0, 10);

/**
 * The window as a dense day-by-day series, zeroes included.
 *
 * The query only returns days that had traffic. Plotting those alone would drop
 * the quiet days out of the axis and turn a week with one busy Tuesday into a
 * flat, healthy-looking line — the chart would be wrong rather than sparse.
 *
 * @param {{day: string, visits: number}[]} rows what the server counted.
 * @param {number} days the window length.
 * @returns {{day: string, visits: number}[]} one entry per day, oldest first.
 */
export function densify(rows, days) {
  const counts = new Map(rows.map((r) => [r.day, r.visits]));
  const today = new Date();
  const out = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    const day = utcDay(d);
    out.push({ day, visits: counts.get(day) || 0 });
  }
  return out;
}

const dayLabel = (day) =>
  new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const visitCount = (n) => n.toLocaleString() + (n === 1 ? " visit" : " visits");

/**
 * A group of mutually exclusive buttons, styled as one control.
 *
 * Extracted because the range filter and both chart pickers are the same
 * control with different contents, and three hand-rolled copies of a button row
 * is the duplication that drifts apart the first time one of them is restyled.
 * `aria-pressed` rather than a radiogroup, to match how every other toggle
 * group in this app is announced.
 *
 * @param {{label?: string, options: {value: *, label: string, hint?: string}[],
 *   value: *, onChange: (value: *) => void, size?: "md"|"sm"}} props `size`
 *   picks the density: "md" beside body text, "sm" beside a section heading.
 */
export function Segmented({ label, options, value, onChange, size = "md" }) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      )}
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.hint}
          className={
            "rounded-md font-semibold transition " +
            pad +
            " " +
            (value === option.value
              ? "bg-green-600 text-white"
              : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A headline number with its name under it.
 *
 * Not a chart on purpose: three totals compared against nothing are read one at
 * a time, and drawing them as three bars would invite a comparison between
 * quantities that do not share a scale.
 */
export function Stat({ label, value, note }) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
      {/* Proportional figures rather than tabular: nothing is stacked under
          this, and equal-width digits make a number at this size look gappy. */}
      <div className="text-2xl font-black text-gray-900 dark:text-gray-100">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{note}</div>}
    </div>
  );
}

/**
 * The plot's pixel width, tracked as the panel resizes.
 *
 * The marks are laid out in real pixels rather than in a viewBox that stretches
 * to fit: a stretched viewBox scales the 2px strokes with it and turns the
 * round end-marker into an ellipse at every width but the one it was drawn for.
 *
 * @returns {[React.RefObject, number]} the element to measure, and its width.
 */
function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // jsdom has no ResizeObserver, so fall back to the width at mount rather
    // than leaving the plot permanently empty under test.
    if (typeof ResizeObserver === "undefined") {
      setWidth(el.clientWidth);
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * A bar with its data-end rounded and its foot square.
 *
 * Hand-built rather than `<rect rx>`, which rounds all four corners and so
 * lifts the bar off the baseline it is being measured from.
 */
function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return (
    "M" + x + "," + (y + h) +
    "L" + x + "," + (y + r) +
    "Q" + x + "," + y + " " + (x + r) + "," + y +
    "L" + (x + w - r) + "," + y +
    "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
    "L" + (x + w) + "," + (y + h) +
    "Z"
  );
}

/** The encodings offered for the day series, in the order they are read. */
const SERIES_VIEWS = [
  { value: "bars", label: "Bars", hint: "One bar per day — the plain reading of a count" },
  { value: "line", label: "Line", hint: "The shape of the trend, at the cost of implying traffic between days" },
  { value: "area", label: "Area", hint: "The line, with the volume under it filled in" },
  { value: "total", label: "Total", hint: "Running total — where the window had got to by each day" },
  { value: "table", label: "Table", hint: "Every day and its count, as text" },
];

/** Which encodings join their points, and which fill underneath. */
const JOINED = { line: true, area: true, total: true };
const FILLED = { area: true, total: true };

/**
 * Visits per day, in whichever encoding is asked for.
 *
 * Bars are the default and stay the default: these are counts in discrete
 * buckets, and a line drawn between two days implies traffic at half past
 * Tuesday that nobody measured. The other encodings are offered because that
 * caveat is worth trading away once the shape of a launch, rather than the
 * count on a given day, is the question — a line across ninety days reads as a
 * trend where ninety thin bars read as texture. The running total answers a
 * third question again: not "how busy was Tuesday" but "where had we got to by
 * Tuesday".
 *
 * Only the ends of the axis carry a date — one under each of ninety bars is
 * unreadable — and every value is reachable on hover, on arrow-key focus, and
 * in the table view, so no figure here is gated behind a pointer.
 *
 * @param {{series: {day: string, visits: number}[]}} props the dense day
 *   series, oldest first, zeroes included.
 */
export function DailyVisits({ series }) {
  const [view, setView] = useState("bars");
  const [box, width] = useElementWidth();
  /** Which day the pointer or the keyboard is on; null when neither is. */
  const [at, setAt] = useState(null);

  // The running total is a different series, not a different drawing of the
  // same one, so it is derived once here rather than inside the render.
  const points = useMemo(() => {
    if (view !== "total") return series.map((d) => ({ day: d.day, value: d.visits }));
    let sum = 0;
    return series.map((d) => {
      sum += d.visits;
      return { day: d.day, value: sum };
    });
  }, [series, view]);

  const n = points.length;
  const peak = Math.max(1, ...points.map((p) => p.value));
  const running = view === "total";

  if (view === "table") {
    return (
      <ChartFrame title="Visits per day" view={view} onView={setView}>
        <DataTable
          head={["Day", "Visits"]}
          rows={series.map((d) => [dayLabel(d.day), d.visits.toLocaleString()])}
        />
      </ChartFrame>
    );
  }

  const inner = Math.max(1, width - PAD * 2);
  const band = inner / Math.max(1, n);
  // A 2px gap in the surface colour is what separates neighbouring bars. A
  // stroke around each one would add ink that is not data.
  const barW = Math.max(1, Math.min(BAR_MAX, band - 2));
  const base = PLOT_H - PAD;
  // Joined encodings put a point at each end of the axis; bars sit in the
  // middle of the band they own, which is half a band in from each end.
  const x = (i) =>
    JOINED[view]
      ? PAD + (n === 1 ? inner / 2 : (i * inner) / (n - 1))
      : PAD + i * band + band / 2;
  const y = (v) => base - (v / peak) * (PLOT_H - PAD * 2);

  const line = points.map((p, i) => (i ? "L" : "M") + x(i) + "," + y(p.value)).join(" ");
  const under = line + " L" + x(n - 1) + "," + base + " L" + x(0) + "," + base + " Z";

  /** Nearest day to the pointer. Readers aim at a date, never at a 2px line. */
  const track = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - PAD;
    const i = JOINED[view] ? Math.round((rel / inner) * (n - 1)) : Math.floor(rel / band);
    setAt(Math.min(n - 1, Math.max(0, i)));
  };

  const step = (e) => {
    const keys = {
      ArrowLeft: at == null ? n - 1 : at - 1,
      ArrowRight: at == null ? 0 : at + 1,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    setAt(Math.min(n - 1, Math.max(0, keys[e.key])));
  };

  const readout =
    at != null && points[at]
      ? visitCount(points[at].value) + (running ? " by then" : "")
      : "";

  const summary =
    "Visits per day over " +
    n +
    " days. " +
    (running ? "Running total, ending at " + peak + "." : "Peaking at " + peak + ".") +
    " Use the left and right arrow keys to read each day.";

  return (
    <ChartFrame title="Visits per day" view={view} onView={setView}>
      <div className="relative">
        <div
          ref={box}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={step}
          onPointerMove={track}
          onPointerLeave={() => setAt(null)}
          onFocus={() => setAt((prev) => (prev == null ? n - 1 : prev))}
          onBlur={() => setAt(null)}
          className="rounded outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          style={{ height: PLOT_H }}
        >
          {width > 0 && (
            <svg aria-hidden="true" width={width} height={PLOT_H} className="block">
              {/* The baseline the marks are measured from: a solid hairline one
                  step off the surface, never dashed. */}
              <line
                x1={0}
                x2={width}
                y1={base + 0.5}
                y2={base + 0.5}
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeWidth={1}
              />

              {view === "bars" &&
                points.map((p, i) => {
                  const h = p.value ? Math.max(2, base - y(p.value)) : 2;
                  return (
                    <path
                      key={p.day}
                      d={barPath(x(i) - barW / 2, base - h, barW, h)}
                      // A 2px stub on a quiet day, so it is still a place on the
                      // axis you can point at rather than a gap that reads as
                      // data nobody collected. Colour says whether anything
                      // actually happened.
                      fill={p.value ? MARK : undefined}
                      className={p.value ? undefined : "fill-gray-300 dark:fill-gray-600"}
                      opacity={at === i ? 0.75 : 1}
                    />
                  );
                })}

              {FILLED[view] && <path d={under} fill={MARK} opacity={0.1} />}

              {JOINED[view] && (
                <path
                  d={line}
                  fill="none"
                  stroke={MARK}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Rings are drawn in the surface colour, so a marker stays
                  legible where it sits on the line it belongs to. */}
              <g className="text-white dark:text-gray-800">
                {JOINED[view] && (
                  <circle
                    cx={x(n - 1)}
                    cy={y(points[n - 1].value)}
                    r={4}
                    fill={MARK}
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                )}
                {at != null && points[at] && (
                  <>
                    <line
                      x1={x(at)}
                      x2={x(at)}
                      y1={PAD}
                      y2={base}
                      className="stroke-gray-300 dark:stroke-gray-600"
                      strokeWidth={1}
                    />
                    <circle
                      cx={x(at)}
                      cy={y(points[at].value)}
                      r={4}
                      fill={MARK}
                      stroke="currentColor"
                      strokeWidth={2}
                    />
                  </>
                )}
              </g>
            </svg>
          )}
        </div>

        {at != null && points[at] && (
          <Tooltip
            // Clamped off both edges so the readout never hangs outside the
            // panel it belongs to.
            left={Math.min(Math.max(x(at), 64), Math.max(64, width - 64))}
            top={Math.max(0, y(points[at].value) - 44)}
            // Value leads, label follows: the reader already has the day and
            // came here for the number.
            value={readout}
            label={dayLabel(points[at].day)}
          />
        )}
      </div>

      <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>{dayLabel(series[0].day)}</span>
        <span className="font-semibold text-gray-600 dark:text-gray-300">
          {(running ? "total " : "peak ") + peak.toLocaleString()}
        </span>
        <span>{dayLabel(series[series.length - 1].day)}</span>
      </div>

      {/* What a screen reader hears as the arrow keys walk the series. Outside
          the role="img" above, whose descendants are presentational. */}
      <span className="sr-only" aria-live="polite">
        {at != null && points[at] ? dayLabel(points[at].day) + " — " + readout : ""}
      </span>
    </ChartFrame>
  );
}

/** The views a breakdown offers. No pie or donut: see BarList. */
const LIST_VIEWS = [
  { value: "bars", label: "Bars", hint: "Ranked bars — length is the count" },
  { value: "table", label: "Table", hint: "The same rows as text" },
];

/**
 * A labelled horizontal bar list, with a table twin.
 *
 * One component for both breakdowns: they differ in what they count and in the
 * order they are read, not in how they are drawn, and two near-identical bar
 * lists is exactly the duplication that drifts apart.
 *
 * Bars and a table rather than bars and a pie, deliberately. Neither breakdown
 * is a part-to-whole — one visit can press several calls to action and can
 * reach several sections, so the rows sum to more than the visits they came
 * from. A ring would cut slices out of a total that does not exist.
 *
 * @param {{title: string, rows: {key: string, label: string, value: number,
 *   caption: string}[], max: number, empty: string, valueHeading: string}}
 *   props `max` is what a full bar means — the largest row for a ranking, the
 *   visit count for a share.
 */
export function BarList({ title, rows, max, empty, valueHeading }) {
  const [view, setView] = useState("bars");

  return (
    <ChartFrame title={title} view={view} onView={setView} views={LIST_VIEWS}>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{empty}</p>
      ) : view === "table" ? (
        <DataTable head={[title, valueHeading]} rows={rows.map((r) => [r.label, r.caption])} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="group" title={row.label + " — " + row.caption}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-gray-700 dark:text-gray-200">{row.label}</span>
                <span className="flex-shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {row.caption}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                <div
                  className="h-full rounded transition-opacity group-hover:opacity-75"
                  style={{
                    width: Math.max(1, (row.value / Math.max(1, max)) * 100) + "%",
                    background: MARK,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

/**
 * A chart with its heading and its view picker on one line.
 *
 * The picker rides the chart rather than joining the filter row above, because
 * it changes only how this one chart is drawn. That row is kept for the range,
 * which scopes every figure on the panel at once; mixing the two would leave it
 * unclear which control moves which numbers.
 */
function ChartFrame({ title, view, onView, views = SERIES_VIEWS, children }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {title}
        </h4>
        <Segmented options={views} value={view} onChange={onView} size="sm" />
      </div>
      {children}
    </section>
  );
}

/**
 * The text twin of a chart.
 *
 * Every chart here has one. It is what makes the figures reachable without a
 * pointer, without colour and without hovering — and it is what a reader copies
 * out when they want the numbers somewhere else.
 */
function DataTable({ head, rows }) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
          <tr>
            {head.map((cell, i) => (
              <th
                key={cell}
                scope="col"
                className={
                  "px-3 py-1.5 font-semibold text-gray-600 dark:text-gray-300 " +
                  (i ? "text-right" : "text-left")
                }
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-gray-100 dark:border-gray-800">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    "px-3 py-1 " +
                    (i
                      ? "text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100"
                      : "text-left text-gray-700 dark:text-gray-200")
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The hover and focus readout. An enhancement — never the only route to a value. */
function Tooltip({ left, top, value, label }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 shadow-lg"
      style={{ left, top }}
    >
      <div className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
