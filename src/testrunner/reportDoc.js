// The downloadable run report, in the shape of an Extent Spark report.
//
// Extent Reports is a Java library, so this is not it — it is a document that
// reads the way one does, because that is the format QA teams already know how
// to read: a dashboard of totals and a donut, a category breakdown, then a list
// of tests on the left and the selected test's steps on the right.
//
// Reimplemented rather than wrapped for the obvious reason (no JVM here) and a
// less obvious one: Extent's own Spark output pulls Bootstrap, a font and a
// chart library from CDNs, so an emailed report renders as unstyled text the
// moment the reader is offline or a link rots. Everything here — styles, the
// donut, the interactivity — is inlined, so the file still opens correctly in a
// year, attached to the release it describes.
//
// Deliberately CommonJS and free of any React or DOM reference, like its
// neighbours: the app imports it, and a Node script can render the identical
// document from an exported workspace without a browser.

// Escaped everywhere a value is interpolated. Test names, suite names and step
// labels are recorded from a live application, so `<`, `&` and quotes all
// genuinely occur — an unescaped one swallows the rest of the row, and a name
// containing a tag would let recorded content write markup into a document
// somebody forwards.
const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Data handed to the page's own script. `</script>` inside a string would end
// the block early however well the JSON is formed, which is the one escape
// JSON.stringify does not make for you.
const jsonScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const when = (ts) => (ts ? new Date(ts).toLocaleString() : '—');

const STYLE = `
  :root { color-scheme: light; --pass:#22a35a; --fail:#e0483d; --warn:#e8a33d; --skip:#98a1ad;
          --ink:#1d2027; --dim:#6b7280; --line:#e4e7ec; --card:#ffffff; --bg:#f4f6f8; --nav:#232a34; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .nav { background:var(--nav); color:#fff; padding:14px 22px; display:flex; align-items:center; gap:12px; }
  .nav .mark { width:26px; height:26px; border-radius:7px; background:#5ff0c4; color:#06281f;
               display:grid; place-items:center; font-weight:900; font-size:14px; }
  .nav h1 { font-size:15px; margin:0; font-weight:800; letter-spacing:.01em; }
  .nav .meta { margin-left:auto; font-size:11.5px; opacity:.72; }
  .wrap { max-width:1180px; margin:0 auto; padding:22px; }
  .cards { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:11px; padding:14px 16px; }
  .kpis { flex:1 1 460px; display:flex; flex-wrap:wrap; gap:20px; align-items:center; }
  .kpi .v { font-size:25px; font-weight:800; line-height:1.05; font-variant-numeric:tabular-nums; }
  .kpi .l { font-size:9.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--dim); margin-top:3px; }
  .donutCard { flex:0 0 auto; display:flex; align-items:center; gap:16px; }
  .legend { font-size:12px; }
  .legend div { display:flex; align-items:center; gap:7px; margin:3px 0; }
  .dot { width:9px; height:9px; border-radius:3px; display:inline-block; }
  h2 { font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); margin:22px 0 9px; }
  .cats { display:flex; flex-direction:column; gap:7px; }
  .cat { display:grid; grid-template-columns:130px 1fr 64px; gap:10px; align-items:center; font-size:12px; }
  .bar { height:8px; border-radius:999px; background:#eceff3; overflow:hidden; display:flex; }
  .bar i { display:block; height:100%; }
  .split { display:grid; grid-template-columns:320px 1fr; gap:14px; align-items:start; }
  .list { background:var(--card); border:1px solid var(--line); border-radius:11px; overflow:hidden; }
  .tools { padding:9px; border-bottom:1px solid var(--line); display:flex; gap:6px; }
  .tools input { flex:1; min-width:0; font:inherit; font-size:12px; padding:6px 9px;
                 border:1px solid var(--line); border-radius:7px; background:#fbfcfd; }
  .tools select { font:inherit; font-size:12px; padding:6px 7px; border:1px solid var(--line);
                  border-radius:7px; background:#fbfcfd; }
  .item { width:100%; text-align:left; background:none; border:0; border-bottom:1px solid #f0f2f5;
          padding:10px 12px; cursor:pointer; font:inherit; display:grid;
          grid-template-columns:14px 1fr auto; gap:9px; align-items:start; }
  /* A grid item defaults to min-width:auto, which refuses to shrink below its
     content — so without this the name column just widens and the ellipsis
     above never fires. */
  .item > span { min-width:0; }
  .item:hover { background:#f7f9fb; }
  .item.on { background:#eef4ff; box-shadow:inset 3px 0 0 #3b82f6; }
  /* Both are spans, so without display:block the suite runs straight on from
     the name — "Login testBMS > Login". Long names are clipped rather than
     wrapped: the column is 320px and a two-line name pushes the row heights out
     of step with the status icons beside them. */
  .item .nm { display:block; font-weight:700; font-size:12.5px;
              overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .item .sb { display:block; font-size:10.5px; color:var(--dim);
              overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .item .du { font:11px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--dim); white-space:nowrap; }
  .ic { font-weight:900; font-size:12px; line-height:1.25; }
  .p { color:var(--pass); } .f { color:var(--fail); } .s { color:var(--skip); }
  .detail { background:var(--card); border:1px solid var(--line); border-radius:11px; padding:16px 18px; min-height:280px; }
  .detail h3 { margin:0 0 3px; font-size:16px; }
  .detail .dsub { font-size:11.5px; color:var(--dim); margin-bottom:12px; }
  .pill { display:inline-block; font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;
          background:#eef1f5; color:#4b5563; margin:0 5px 5px 0; }
  .pill.tag { background:#e8f6ef; color:#12704a; }
  .pill.fail { background:#fdeceb; color:#a8271c; }
  .pill.pass { background:#e8f6ef; color:#12704a; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th { font-size:9.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--dim);
       text-align:left; padding:7px 9px; border-bottom:1px solid var(--line); }
  td { padding:8px 9px; border-bottom:1px solid #f0f2f5; font-size:12.5px; vertical-align:top; }
  td.verb { font:700 10.5px ui-monospace,SFMono-Regular,Menlo,monospace; color:#4b5563; white-space:nowrap; }
  td.num { text-align:right; font:12px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--dim); white-space:nowrap; }
  td.idx { color:#aab1bb; font-weight:700; }
  .err { margin-top:6px; padding:8px 10px; border-radius:7px; background:#fdeceb; border:1px solid #f6cdc9;
         color:#8f2018; font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; }
  /* A REST step's response. Deliberately quieter than .err — it appears on
     passing steps too, where it is a record rather than a problem. */
  .api { margin-top:6px; border:1px solid var(--line); border-radius:7px; overflow:hidden; }
  .api .apihead { display:flex; gap:8px; align-items:center; padding:5px 9px; background:#f6f8fa;
                  font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace; color:#4b5563; }
  .api .apihead .code { padding:1px 6px; border-radius:5px; background:#e6ebf1; color:#1f2937; }
  .api .apihead .code.bad { background:#fdeceb; color:#8f2018; }
  .api .apihead .u { font-weight:400; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .api .apihead .t { margin-left:auto; font-weight:400; color:#9aa3ad; }
  .api ul { margin:0; padding:6px 9px 7px 26px; font:11.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .api li.ok { color:#3f6212; }
  .api li.no { color:#8f2018; }
  .api pre.apibody { margin:0; padding:7px 9px; border-top:1px solid var(--line); background:#fcfcfd;
                     font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#4b5563;
                     white-space:pre-wrap; word-break:break-word; }
  .iterbar { display:flex; flex-wrap:wrap; gap:5px; margin:10px 0 4px; }
  .iterbar button { font:inherit; font-size:11px; font-weight:700; padding:4px 9px; border-radius:7px;
                    border:1px solid var(--line); background:#fbfcfd; cursor:pointer; }
  .iterbar button.on { border-color:#3b82f6; background:#eef4ff; color:#1d4ed8; }
  .iterbar button.bad { border-color:#f0b7b2; color:#a8271c; }
  .shot { margin-top:8px; border:1px solid var(--line); border-radius:8px; padding:6px; background:#fbfcfd; }
  /* The scaled snapshot. overflow:hidden because the iframe is laid out at the
     full captured width and only then shrunk by transform — the untransformed
     box would otherwise spill out of the cell. */
  .shotBad { font-size:11.5px; color:var(--dim); padding:10px 2px; }
  .shotScale { position:relative; width:100%; overflow:hidden; border-radius:6px; background:#fff; }
  .shotScale iframe { position:absolute; top:0; left:0; border:0; transform-origin:0 0; background:#fff; }
  footer { margin:20px 0 6px; font-size:11px; color:#9099a6; }
  .empty { color:var(--skip); font-size:12.5px; padding:24px 4px; }
  /* Printing collapses to one flow: the two-pane layout is a screen idea, and
     every test's steps have to be on the page rather than behind a click. */
  @media print {
    body { background:#fff; }
    .nav { background:#fff; color:#000; border-bottom:2px solid #000; }
    .tools, .list { display:none; }
    .split { display:block; }
    .card, table, tr { break-inside:avoid; }
    .shot { break-inside:avoid; }
    thead { display:table-header-group; }
  }
`;

// The donut, as inline SVG. Drawn with stroke-dasharray on two circles rather
// than with arc paths: no trigonometry to get wrong, and it degrades to a plain
// ring when there is nothing to show.
function donut(passed, failed, skipped) {
  const total = passed + failed + skipped;
  const R = 46;
  const C = 2 * Math.PI * R;
  const seg = (n, colour, offset) =>
    n <= 0
      ? ''
      : `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${colour}" stroke-width="16"
           stroke-dasharray="${((n / total) * C).toFixed(2)} ${C.toFixed(2)}"
           stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
  const rate = total ? Math.round((passed / total) * 100) : 0;
  return `<svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="${passed} passed, ${failed} failed, ${skipped} not run">
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="#eceff3" stroke-width="16"/>
    ${seg(passed, '#22a35a', 0)}
    ${seg(failed, '#e0483d', (passed / (total || 1)) * C)}
    ${seg(skipped, '#c8ced7', ((passed + failed) / (total || 1)) * C)}
    <text x="60" y="56" text-anchor="middle" font-size="22" font-weight="800" fill="#1d2027">${total ? `${rate}%` : '—'}</text>
    <text x="60" y="73" text-anchor="middle" font-size="9.5" font-weight="700" fill="#6b7280" letter-spacing="1">PASSED</text>
  </svg>`;
}

const kpi = (label, value, cls) =>
  `<div class="kpi"><div class="v${cls ? ` ${cls}` : ''}">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;

// Tags as Extent's "categories": how many of the tests carrying each tag are
// currently green. A release gate is usually phrased in exactly these terms —
// "is @smoke clean" — and that question has no answer anywhere else in the app.
function categories(rows) {
  const by = new Map();
  rows.forEach((r) =>
    (r.tags || []).forEach((tag) => {
      const c = by.get(tag) || { tag, pass: 0, fail: 0, skip: 0 };
      if (!r.latest) c.skip++;
      else if (r.latest.status === 'failed') c.fail++;
      else c.pass++;
      by.set(tag, c);
    }),
  );
  const list = [...by.values()].sort((a, b) => b.fail - a.fail || b.pass + b.skip - (a.pass + a.skip));
  if (!list.length) return '';
  return `<h2>Categories</h2><div class="card"><div class="cats">${list
    .map((c) => {
      const total = c.pass + c.fail + c.skip || 1;
      const w = (n) => `${((n / total) * 100).toFixed(1)}%`;
      return `<div class="cat"><span><span class="pill tag">@${esc(c.tag)}</span></span>
        <span class="bar">
          <i style="width:${w(c.pass)};background:#22a35a"></i>
          <i style="width:${w(c.fail)};background:#e0483d"></i>
          <i style="width:${w(c.skip)};background:#c8ced7"></i>
        </span>
        <span class="num" style="text-align:right;color:#6b7280;font-size:11px">${c.pass}/${c.pass + c.fail + c.skip}</span></div>`;
    })
    .join('')}</div></div>`;
}

/**
 * The whole report as one standalone HTML document.
 *
 * @param {object} data `{ generatedAt, totals, failures, rows }` — the same
 *   values the Reports modal renders on screen, so the file cannot disagree
 *   with the view by being derived twice. Each row carries `steps` (or
 *   `iterations` for a data-driven run) so the document can show what every
 *   test actually did, which is the part that makes it a report rather than a
 *   summary.
 * @returns {string} a complete HTML document with no external dependencies.
 */
function toReportHtml(data) {
  const { generatedAt, totals, failures, rows } = data || {};
  const t = totals || {};
  const list = rows || [];
  const passed = list.filter((r) => r.latest && r.latest.status !== 'failed').length;
  const failed = list.filter((r) => r.latest && r.latest.status === 'failed').length;
  const skipped = list.filter((r) => !r.latest).length;
  const stamp = when(generatedAt || Date.now());

  const failBlock = (failures || []).length
    ? `<h2>What is failing</h2><div class="card"><div class="cats">${(failures || [])
        .map(
          (f) =>
            `<div style="display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center">
               <span class="f" style="font:700 13px ui-monospace,Menlo,monospace;text-align:center">&times;${f.tests.length}</span>
               <span><b style="font-size:12.5px">${f.verb ? `<span class="pill fail">${esc(f.verb)}</span>` : ''}${esc(f.label)}</b>
               <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(f.tests.join(' · '))}</div></span>
             </div>`,
        )
        .join('')}</div></div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TestExpress report — ${esc(stamp)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="nav">
  <span class="mark">T</span>
  <h1>TestExpress — Run Report</h1>
  <span class="meta">Generated ${esc(stamp)}</span>
</div>

<div class="wrap">
  <div class="cards">
    <div class="card donutCard">
      ${donut(passed, failed, skipped)}
      <div class="legend">
        <div><span class="dot" style="background:#22a35a"></span> Passed <b>${passed}</b></div>
        <div><span class="dot" style="background:#e0483d"></span> Failed <b>${failed}</b></div>
        <div><span class="dot" style="background:#c8ced7"></span> Not run <b>${skipped}</b></div>
      </div>
    </div>
    <div class="card kpis">
      ${kpi('test cases', t.tests ?? list.length)}
      ${kpi('runs recorded', t.runs ?? 0)}
      ${kpi('of runs passed', t.rate == null ? '—' : `${t.rate}%`)}
      ${kpi('flaky', t.flaky ?? 0, (t.flaky || 0) > 0 ? 'f' : '')}
      ${kpi('locators healed', t.healed ?? 0)}
    </div>
  </div>

  ${failBlock}
  ${categories(list)}

  <h2>Tests</h2>
  <div class="split">
    <div class="list">
      <div class="tools">
        <input id="q" type="search" placeholder="Filter tests…" aria-label="Filter tests">
        <select id="st" aria-label="Filter by status">
          <option value="">All</option>
          <option value="failed">Failed</option>
          <option value="passed">Passed</option>
          <option value="none">Not run</option>
        </select>
      </div>
      <div id="items"></div>
    </div>
    <div class="detail" id="detail"></div>
  </div>

  <footer>
    Recorded with TestExpress. Run history is kept per test in the browser that produced it,
    so this file is the record — the app keeps only the most recent runs of each test.
  </footer>
</div>

<script>
// The page's own behaviour, inlined for the same reason the styles are: this
// file is going to be emailed, and a report that needs the network to be
// readable is a report that eventually is not.
var DATA = ${jsonScript(list)};
var items = document.getElementById('items');
var detail = document.getElementById('detail');
var q = document.getElementById('q');
var st = document.getElementById('st');
var sel = DATA.findIndex(function (r) { return r.latest && r.latest.status === 'failed'; });
if (sel < 0) sel = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function ms(n) {
  n = Number(n) || 0;
  if (n < 1000) return Math.round(n) + 'ms';
  if (n < 60000) return (n / 1000).toFixed(1) + 's';
  return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's';
}
function statusOf(r) { return !r.latest ? 'none' : r.latest.status === 'failed' ? 'failed' : 'passed'; }
function icon(s) { return s === 'failed' ? '<span class="ic f">&#10007;</span>'
  : s === 'passed' ? '<span class="ic p">&#10003;</span>' : '<span class="ic s">&#9675;</span>'; }

function visible() {
  var text = q.value.trim().toLowerCase();
  var want = st.value;
  return DATA.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
    if (want && statusOf(x.r) !== want) return false;
    if (!text) return true;
    var hay = (x.r.name + ' ' + x.r.suite + ' ' + (x.r.tags || []).join(' ')).toLowerCase();
    return hay.indexOf(text) >= 0;
  });
}

function renderList() {
  var rows = visible();
  if (!rows.length) { items.innerHTML = '<div class="empty" style="padding:16px">Nothing matches.</div>'; return; }
  items.innerHTML = rows.map(function (x) {
    var s = statusOf(x.r);
    return '<button class="item' + (x.i === sel ? ' on' : '') + '" data-i="' + x.i + '">' +
      icon(s) +
      '<span><span class="nm">' + esc(x.r.name) + '</span>' +
      '<span class="sb">' + esc(x.r.suite || '') + '</span></span>' +
      '<span class="du">' + (x.r.latest ? ms(x.r.latest.durationMs) : '—') + '</span></button>';
  }).join('');
  Array.prototype.forEach.call(items.querySelectorAll('.item'), function (b) {
    b.addEventListener('click', function () { sel = Number(b.getAttribute('data-i')); renderList(); renderDetail(); });
  });
}

// The screenshot, under the step it belongs to.
//
// Two kinds arrive and neither can be a plain <img>: the remote engine stores a
// JPEG data URL, and the in-page engine stores the page itself, rebuilt into a
// document that goes in an iframe. The iframe is sandboxed to allow-same-origin
// and nothing else — no scripts, no forms, no navigation — because a snapshot of
// a real application must be able to be looked at and nothing more.
//
// Is there actually a picture here?
//
// Both kinds can be present-but-empty. An image needs a data: URL with a
// payload after the comma - the encoder returns a bare "data:," for a canvas it
// could not read. A DOM capture needs a body with something in it; one taken
// while the page was navigating serialises to an empty shell that renders as a
// white rectangle.
function shotIsUsable(shot) {
  if (!shot) return false;
  if (shot.kind === 'image') {
    var u = String(shot.dataUrl || '');
    return u.indexOf('data:image/') === 0 && u.length > 64;
  }
  var d = String(shot.srcdoc || '');
  if (!d) return false;
  var body = /<body[^>]*>([\\s\\S]*)<\\/body>/i.exec(d);
  var text = (body ? body[1] : d).replace(/<[^>]*>/g, '').trim();
  // Text, or something that renders without any - a page that failed on an
  // image or an empty form is still worth looking at.
  return text.length > 0 || /<(img|svg|canvas|input|button)\\b/i.test(d);
}

function shotBlock(shot) {
  // Nothing, rather than an empty frame. A shot can arrive unusable — a JPEG
  // that never finished encoding, a DOM capture whose body came back empty —
  // and a blank bordered box under a failure reads as "the page was blank when
  // it failed", which is a different and much more alarming claim than "no
  // screenshot was kept".
  if (!shot || !shotIsUsable(shot)) return '';
  // A DOM snapshot is a live re-render, not a picture, so the iframe's own
  // width *is* the viewport the page lays itself out against. Sized to the cell
  // it produced a narrow re-flow of the app with scrollbars — recognisably the
  // wrong screen. Rendered at the width it was captured at and then scaled down
  // to fit, it reproduces what was actually on screen.
  //
  // The scale itself is set by fitShots() once the box has a measured width;
  // aspect-ratio reserves the right height in the meantime so nothing jumps.
  var w = Number(shot.w) || 1280;
  var h = Number(shot.h) || 800;
  var inner =
    shot.kind === 'image'
      // The failure handler is bound in wireShots() rather than written as an
      // inline onerror: the stored JPEG is checked for shape, not decoded, and a
      // truncated one would otherwise render as a broken-image icon under the
      // failure as though the app had produced it.
      ? '<img class="shotImg" src="' + esc(shot.dataUrl) + '" alt="Screenshot at the failing step" ' +
        'style="max-width:100%;border-radius:6px;display:block">' +
        '<div class="shotBad" hidden>The screenshot stored for this run could not be decoded.</div>'
      : '<div class="shotScale" data-w="' + w + '" style="aspect-ratio:' + w + ' / ' + h + '">' +
        '<iframe sandbox="allow-same-origin" loading="lazy" title="Page at the failing step" ' +
        'style="width:' + w + 'px;height:' + h + 'px" srcdoc="' + esc(shot.srcdoc) + '"></iframe></div>';
  // Shown outright. It was behind a toggle to keep the file quick to render,
  // but the screenshot is the evidence — making the one thing a reader opened
  // the report for take an extra click was the wrong trade, and it printed as
  // nothing unless a stylesheet forced it open.
  return '<div class="shot">' + inner + '</div>';
}

// A REST step's response, as a block under its row: the status line, one line
// per check, and the body when the step failed.
//
// Every check is listed rather than only the failures. A reader asking "what
// does this test actually guarantee about that endpoint?" gets the answer here,
// and on a passing run that list is the only place it exists — the step label
// says "GET /api/plans · 3 checks" and nothing about what the three were.
function apiBlock(a) {
  if (!a) return '';
  var bad = a.ok === false;
  var head = '<div class="apihead">' +
    '<span>' + esc(a.method || '') + '</span>' +
    '<span class="code' + (bad ? ' bad' : '') + '">' + esc(String(a.status == null ? '—' : a.status)) +
    (a.statusText ? ' ' + esc(a.statusText) : '') + '</span>' +
    '<span class="u">' + esc(a.url || '') + '</span>' +
    '<span class="t">' + (a.ms == null ? '' : ms(a.ms)) + '</span>' +
  '</div>';
  var checks = (a.checks || []).length
    ? '<ul>' + a.checks.map(function (c) {
        return '<li class="' + (c.ok ? 'ok' : 'no') + '">' + (c.ok ? '&#10003; ' : '&#10007; ') + esc(c.text || '') + '</li>';
      }).join('') + '</ul>'
    : '';
  // Only present on a failure — see plainApi in TestRunner.jsx for why a
  // passing call's body is deliberately not carried into this document.
  var body = a.body ? '<pre class="apibody">' + esc(a.body) + '</pre>' : '';
  return '<div class="api">' + head + checks + body + '</div>';
}

function stepTable(steps, shot) {
  if (!steps || !steps.length)
    return '<div class="empty">No step detail was stored for this run.</div>' + shotBlock(shot);
  return '<table><thead><tr><th style="width:18px"></th><th class="num" style="width:30px">#</th>' +
    '<th style="width:64px">Step</th><th>Details</th>' +
    '<th class="num" style="width:70px">Time</th></tr></thead><tbody>' +
    steps.map(function (s, i) {
      // Attached to the step it was taken at, not to the run: on a long
      // recording, "which of these 30 steps is this a picture of" is exactly
      // the question a screenshot dumped at the bottom fails to answer.
      var here = shot && shot.stepIndex === i ? shotBlock(shot) : '';
      // Padded to two digits so a column of them lines up, and matching how
      // the recorder numbers the same steps on screen — a comment on "step 07"
      // has to mean the same thing in both places.
      var n = String(i + 1);
      return '<tr><td>' + icon(s.status === 'failed' ? 'failed' : s.status === 'passed' ? 'passed' : 'none') + '</td>' +
        '<td class="num idx">' + (n.length < 2 ? '0' + n : n) + '</td>' +
        '<td class="verb">' + esc(s.verb || '') + '</td>' +
        '<td>' + esc(s.label || '') +
        (s.error ? '<div class="err">' + esc(s.error) + '</div>' : '') + apiBlock(s.api) + here + '</td>' +
        '<td class="num">' + (s.durationMs == null ? '' : ms(s.durationMs)) + '</td></tr>';
    }).join('') + '</tbody></table>' +
    // A shot whose step index no longer lines up still gets shown, rather than
    // being silently dropped for being one row off.
    (shot && (shot.stepIndex == null || shot.stepIndex >= steps.length) ? shotBlock(shot) : '');
}

var iterSel = 0;
function renderDetail() {
  var r = DATA[sel];
  if (!r) { detail.innerHTML = '<div class="empty">Select a test.</div>'; return; }
  var s = statusOf(r);
  var head = '<h3>' + esc(r.name) + '</h3>' +
    '<div class="dsub">' + esc(r.suite || 'Unfiled') + (r.latest ? ' · ' + esc(new Date(r.latest.startedAt).toLocaleString()) : '') + '</div>' +
    '<span class="pill ' + (s === 'failed' ? 'fail' : s === 'passed' ? 'pass' : '') + '">' +
      (s === 'failed' ? 'Failed' : s === 'passed' ? 'Passed' : 'Not run') + '</span>' +
    (r.latest ? '<span class="pill">' + ms(r.latest.durationMs) + '</span>' : '') +
    (r.browser ? '<span class="pill">' + esc(r.browser) + '</span>' : '') +
    (r.total ? '<span class="pill">' + r.passed + '/' + r.total + ' runs passed</span>' : '') +
    (r.flaky ? '<span class="pill fail">flaky</span>' : '') +
    (r.tags || []).map(function (t) { return '<span class="pill tag">@' + esc(t) + '</span>'; }).join('');

  // A data-driven run has one step list per row; the picker is the only way to
  // reach the row that actually failed.
  var body;
  if (r.iterations && r.iterations.length) {
    if (iterSel >= r.iterations.length) iterSel = 0;
    body = '<div class="iterbar">' + r.iterations.map(function (it, i) {
      return '<button class="' + (i === iterSel ? 'on ' : '') + (it.status === 'failed' ? 'bad' : '') +
        '" data-it="' + i + '">' + esc(it.label || ('Row ' + (i + 1))) + '</button>';
    }).join('') + '</div>' + stepTable(r.iterations[iterSel].steps, iterSel === (r.shotIteration || 0) ? r.shot : null);
  } else {
    body = stepTable(r.steps, r.shot);
  }
  detail.innerHTML = head + body;
  Array.prototype.forEach.call(detail.querySelectorAll('[data-it]'), function (b) {
    b.addEventListener('click', function () { iterSel = Number(b.getAttribute('data-it')); renderDetail(); });
  });
  fitShots();
  wireShots();
}

// Swap a screenshot that will not decode for a line saying so.
//
// Both paths are needed: an image inserted via innerHTML may already have
// failed by the time this runs, in which case no error event is ever fired and
// only a complete image with zero natural width gives it away.
function wireShots() {
  Array.prototype.forEach.call(document.querySelectorAll('.shotImg'), function (img) {
    var fail = function () {
      img.style.display = 'none';
      if (img.nextElementSibling) img.nextElementSibling.hidden = false;
    };
    if (img.complete && !img.naturalWidth) fail();
    else img.addEventListener('error', fail);
  });
}

// Shrink each snapshot to its container.
//
// Has to happen here rather than in CSS: the factor is the measured width of the
// box divided by the width the page was captured at, and neither is known until
// the browser has laid the detail pane out.
function fitShots() {
  Array.prototype.forEach.call(document.querySelectorAll('.shotScale'), function (box) {
    var w = Number(box.getAttribute('data-w')) || 1280;
    var frame = box.querySelector('iframe');
    if (!frame || !box.clientWidth) return;
    frame.style.transform = 'scale(' + box.clientWidth / w + ')';
  });
}

q.addEventListener('input', renderList);
st.addEventListener('change', renderList);
// The pane is fluid, so a resized window changes the factor.
window.addEventListener('resize', fitShots);
// Printing re-lays-out at paper width; without this the snapshot prints at
// whatever scale the screen last used and overflows the page.
if (window.matchMedia) {
  try { window.matchMedia('print').addEventListener('change', fitShots); } catch (e) { /* older browsers */ }
}
window.addEventListener('beforeprint', fitShots);
renderList();
renderDetail();
</script>
</body>
</html>
`;
}

module.exports = { toReportHtml };
