import "./App.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Fragment, useState, useEffect, useRef } from "react";
import { FaChevronUp, FaChevronLeft, FaChevronRight, FaLinkedin } from "react-icons/fa";
import { MdMenu, MdClose } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Slider from "react-slick";
import TestExpressMark from "./TestExpressMark";
import { useBranding } from "./appBranding";
import PageLoader from "./PageLoader";
import {
  trackHomePageCta,
  trackHomePageSection,
  trackHomePageView,
} from "./homePageTracking";
import { PLANS, addedBy, capabilitiesOf, planKind, priceLabel } from "./plans";
import { VscArrowRight } from "react-icons/vsc";

const Icon = ({ size = 22, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

const IconRecord = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></Icon>
);
const IconPlay = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" /></Icon>
);
const IconHeal = (p) => (
  <Icon {...p}><path d="M12 21s-7-4.6-7-9.6A4.4 4.4 0 0 1 12 8a4.4 4.4 0 0 1 7 3.4c0 5-7 9.6-7 9.6z" /><path d="M8.5 12h2l1-2 1.5 4 1-2h2" /></Icon>
);
const IconBrowser = (p) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><circle cx="6.5" cy="6.5" r=".6" fill="currentColor" /><circle cx="9" cy="6.5" r=".6" fill="currentColor" /></Icon>
);
const IconMobile = (p) => (
  <Icon {...p}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18.5h2" /></Icon>
);
const IconData = (p) => (
  <Icon {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></Icon>
);
const IconClock = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Icon>
);
const IconCode = (p) => (
  <Icon {...p}><path d="M9 17l-5-5 5-5" /><path d="M15 7l5 5-5 5" /></Icon>
);
const IconImport = (p) => (
  <Icon {...p}><path d="M12 3v11" /><path d="M8 10l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>
);
const IconTree = (p) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="5" rx="1" /><rect x="14" y="10" width="7" height="5" rx="1" /><rect x="14" y="17" width="7" height="4" rx="1" /><path d="M6.5 8v10h7.5M6.5 12.5H14" /></Icon>
);
const IconShot = (p) => (
  <Icon {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></Icon>
);
const IconCheck = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5 5-5.5" /></Icon>
);
const IconTag = (p) => (
  <Icon {...p}><path d="M3 12V4h8l9 9-8 8-9-9z" /><circle cx="7.5" cy="7.5" r="1.2" /></Icon>
);
const IconLayers = (p) => (
  <Icon {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Icon>
);
const IconPointer = (p) => (
  <Icon {...p}><path d="M5 3l14 8-6 1.6L10 20z" /></Icon>
);
// Two nodes feeding a third: the shape every CI product uses for a pipeline.
// Deliberately the same figure the recorder draws for its CI/CD entry, so the
// tile here and the control it promises read as one thing.
const IconPipeline = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="12" r="2" />
    <path d="M7 6h4a2 2 0 0 1 2 2v2M7 18h4a2 2 0 0 0 2-2v-2M13 12h4" />
  </Icon>
);
const IconShield = (p) => (
  <Icon {...p}><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" /><path d="M9 12.5l2 2 4-4.5" /></Icon>
);
const IconChart = (p) => (
  <Icon {...p}><path d="M5 20v-7" /><path d="M12 20V4" /><path d="M19 20v-5" /></Icon>
);

// The four claims the hero leads with, held as data so the strip above the CTA
// is one block of markup instead of four near-identical copies. Each maps to
// something the recorder does today, same constraint as the rest of the page.
const HERO_HIGHLIGHTS = [
  { icon: IconPointer, title: "No Code", detail: "Test Creation" },
  { icon: IconCode, title: "Low Code", detail: "Flexibility" },
  { icon: IconPlay, title: "Faster", detail: "Execution" },
  { icon: IconChart, title: "Better", detail: "Results" },
];

/* Animated count-up for stat numbers — animates from 0 to the target
   the first time it scrolls into view. Falls back to static text for
   non-numeric values. */
function CountUp({ value }) {
  const ref = useRef(null);
  const match = String(value).match(/^([\d,]+(?:\.\d+)?)([+%★]?)$/);
  const [display, setDisplay] = useState(match ? "0" + (match[2] || "") : value);

  useEffect(() => {
    if (!match) { setDisplay(value); return; }
    // The rest of the page stops moving under prefers-reduced-motion (see the
    // media query in the style block); a number counting itself up is the same
    // kind of decoration, so it lands on its value rather than climbing to it.
    const still =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { setDisplay(value); return; }
    const suffix   = match[2] || "";
    const target   = parseFloat(match[1].replace(/,/g, ""));
    const decimals = (match[1].split(".")[1] || "").length;
    const el = ref.current;
    if (!el) return;

    let done = false;
    const run = () => {
      const duration = 1600;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        const cur = target * eased;
        setDisplay((decimals ? cur.toFixed(decimals) : Math.round(cur).toLocaleString("en-US")) + suffix);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !done) { done = true; run(); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref}>{display}</span>;
}

function Welcome() {
  const navigate = useNavigate();
  const branding = useBranding();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 72);
      setShowFloatingCTA(y > 480);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  // Scroll-triggered reveal using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && e.target.classList.add("sv")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".sr, .sr-l, .sr-r").forEach((el) =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, []);

  // The visit, and how far down it got.
  //
  // A second observer rather than a branch inside the reveal one above: that
  // one paints and this one measures, they want different geometry, and folding
  // them together would mean a change to an animation could silently change
  // what is being counted.
  //
  // The geometry is a band rather than a ratio of each section: a threshold is
  // a fraction of the element, so 0.35 of a section three screens tall can
  // never be met and that section would report as never reached. This fires
  // when a section enters the middle 70% of the viewport, which means the same
  // thing whatever its height.
  useEffect(() => {
    trackHomePageView();
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (e) => e.isIntersecting && trackHomePageSection(e.target.dataset.section)
        ),
      { threshold: 0, rootMargin: "-15% 0px -15% 0px" }
    );
    document
      .querySelectorAll("[data-section]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Only routes the router actually serves. See the note at the top of the file.
  const menuItems = [
    { name: "Contact", path: "/Contact" },
  ];

  // What the recorder can do today. Each of these is a real capability — the
  // engine picker, the data-set editor, the export button — not a plan.
  const features = [
    { Icon: IconRecord,  label: "Record & Replay",     note: "Clicks and typing become steps" },
    { Icon: IconHeal,    label: "Self-Healing",        note: "Repairs a moved locator" },
    { Icon: IconBrowser, label: "Real Browsers",       note: "Chromium, Firefox, WebKit" },
    { Icon: IconMobile,  label: "Android Apps",        note: "Native, over Appium" },
    { Icon: IconData,    label: "Data Sets",           note: "{{email}} instead of literals" },
    { Icon: IconClock,   label: "Scheduled Runs",      note: "Every 15m, hourly or daily" },
    { Icon: IconCode,    label: "Playwright Export",   note: "A spec you can commit" },
    { Icon: IconPipeline, label: "CI Pipelines",       note: "Parallel or sequential runs" },
    { Icon: IconImport,  label: "Qase Import",         note: "Bring existing cases in" },
    { Icon: IconTree,    label: "Projects & Suites",   note: "Organise what you record" },
    { Icon: IconShot,    label: "Failure Evidence",    note: "A shot of the failing step" },
    { Icon: IconLayers,  label: "Device Emulation",    note: "iPhone, Pixel, iPad viewports" },
    { Icon: IconCheck,   label: "Assertions",          note: "Check text and values" },
    { Icon: IconTag,     label: "Tags",                note: "Filter a run with --grep" },
    { Icon: IconPlay,    label: "Headless Runs",       note: "Replay without watching" },
    { Icon: IconClock,   label: "Waits",               note: "Explicit and implicit" },
    { Icon: IconPointer, label: "Hover & Scroll",      note: "Steps a click can't record" },
  ];

  // Capability claims, not invented metrics. Every number here is one a reader
  // can verify in the engine and device pickers.
  const facts = [
    { Icon: IconBrowser, number: "3",   label: "Browser Engines", sub: "Blink, Gecko, WebKit", color: "#34d399", bg: "rgba(16,185,129,0.14)" },
    { Icon: IconMobile,  number: "2",   label: "Platforms",       sub: "Web and Android",      color: "#22d3ee", bg: "rgba(6,182,212,0.14)" },
    { Icon: IconCode,    number: null,  label: "Code Export",     sub: "Playwright specs",     color: "#fbbf24", bg: "rgba(245,158,11,0.16)" },
    { Icon: IconShield,  number: null,  label: "No Code Needed",  sub: "Record, don't write",  color: "#a78bfa", bg: "rgba(139,92,246,0.18)" },
  ];

  // The three engines, described honestly — including what each cannot do. A
  // tester picks one of these on their first recording, and picking wrong costs
  // an afternoon, so the trade-offs belong on the page rather than in a doc.
  const engines = [
    {
      // Named, not blank: this card rendered with an empty heading, so the
      // engine a first-time visitor is most likely to use was the one the page
      // did not name.
      name: "In-page",
      tag: "Zero setup",
      Icon: IconPointer,
      blurb:
        "Drives the app inside this tab, in a same-origin iframe. Nothing to install and nothing to start — open the recorder and press record.",
      limit: "Confined to this origin: an external site cannot be read from a frame.",
    },
    {
      name: "Real browser",
      tag: "Any URL",
      Icon: IconBrowser,
      blurb:
        "Drives a real Playwright browser on the backend and streams the live view back. Chromium, Firefox or WebKit, so \"does this work in Safari\" is a question you can answer.",
      limit: "Needs the backend running with Playwright browsers installed.",
    },
    {
      name: "Android",
      tag: "Native apps",
      Icon: IconMobile,
      blurb:
        "Records against a real device or emulator through Appium. Taps and typing are captured the same way, and the same step list replays them.",
      limit: "Needs an Appium server, adb and a connected device.",
    },
  ];

  // Record → organise → replay → report, which is the actual loop the product
  // is built around rather than a generic four-step marketing funnel.
  const workflow = [
    { n: "01", title: "Record", body: "Open a page and use it. Every click, keystroke and navigation becomes a step you can read and reorder." },
    { n: "02", title: "Organise", body: "File the recording under a project and suite, tag it, and point its values at a data set so it is not pinned to one login." },
    { n: "03", title: "Replay", body: "Run it in the browser you are sitting in, in a real Chromium, Firefox or WebKit, or on an Android device — same steps, your choice of engine." },
    { n: "04", title: "Report", body: "Read the run: which step failed, how long it took, a screenshot of the moment it broke, and whether a locator had to heal itself." },
  ];

  // Named because they are what the product is genuinely built on, and each is
  // visible in the UI. No logos: hotlinking third-party marks from image search
  // is how a landing page ends up showing the wrong company's logo.
  const builtOn = [
    { name: "Playwright", role: "Real-browser engine and export format", version: "v1.63" },
    { name: "Appium",     role: "Android device automation" },
    { name: "Chromium",   role: "Blink rendering engine" },
    { name: "Firefox",    role: "Gecko rendering engine" },
    { name: "WebKit",     role: "The engine behind Safari" },
    { name: "Qase",       role: "Import existing test cases" },
  ];

  // What a tester actually asks before trying this, with the limits left in.
  // An FAQ that only answers the flattering questions is an advert; the two
  // below about storage and about what the scheduler cannot do are the ones
  // worth the space, because finding either out afterwards costs trust.
  const faqs = [
    {
      q: "Do I have to write any code?",
      a: "No. You record by using the app, and the steps are editable as a list — retype a value, reorder, delete. Code is something you can export when you want it, never something you have to write to get started.",
    },
    {
      q: "Where are my recorded tests stored?",
      a: "In your browser, against the origin you recorded them on — there is no account-wide cloud copy. Export writes the projects, suites, tests and data sets to a JSON file, and Import reads it back, which is also how you move a suite to another machine or share it with a colleague.",
    },
    {
      q: "Can it test a site that is not mine to embed?",
      a: "Yes, on the real-browser engine: it drives Playwright on the backend and streams the view back, so any URL on any origin works. The zero-setup in-page engine is confined to this origin — the same-origin policy stops it reading a frame it does not own.",
    },
    {
      q: "What does the Android side need?",
      a: "An Appium server, adb, and a device or emulator. If a server is not running or no device is attached, the recorder says which of those is missing and offers to start it — it can launch Appium and boot an emulator for you rather than handing you the commands.",
    },
    {
      q: "What happens when the app's markup changes?",
      a: "A step records several locators, not one. If they all go stale, self-healing looks for the element a looser way, and acts only if exactly one answers. The repair is saved back to the test, shown on the step and counted in the run — and it can be switched off where a locator rewriting itself is a change somebody has to review.",
    },
    {
      q: "Can these run in CI?",
      a: "Export the spec and generate the pipeline file for your provider — it declares the browsers, the trigger, whether the suite runs on every core or one at a time, and the exact secret names your data set needs. The built-in schedule is the other option, but it is honest about its limit: it only fires while the recorder is open in a tab.",
    },
  ];

  const PrevArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      aria-label="Previous"
      className="absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-white/10 border border-white/20 text-white w-10 h-10 rounded-full shadow-lg hover:bg-white/20 transition flex items-center justify-center"
    >
      <FaChevronLeft size={14} />
    </button>
  );

  const NextArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      aria-label="Next"
      className="absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-white/10 border border-white/20 text-white w-10 h-10 rounded-full shadow-lg hover:bg-white/20 transition flex items-center justify-center"
    >
      <FaChevronRight size={14} />
    </button>
  );

  const engineSliderSettings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4500,
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 640, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <div className="hp min-h-screen bg-[#0b1120]">

      {/* ── Full-page loader ─────────────────────────────────── */}
      <PageLoader />

      {/* ── Animations ───────────────────────────────────────── */}
      <style>{`
        @keyframes ringSpinCW  { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes ringSpinCW2 { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes heroFadeUp    { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroFadeRight { from { opacity: 0; transform: translateX(44px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes floatUD  { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes pulseDot { 0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); } 60% { box-shadow: 0 0 0 7px rgba(5,150,105,0); } }
        /* The recorded-step list types itself in, one row at a time. */
        @keyframes stepIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .ha1 { animation: heroFadeUp 0.65s ease both; }
        .ha2 { animation: heroFadeUp 0.65s 0.12s ease both; }
        .ha3 { animation: heroFadeUp 0.65s 0.24s ease both; }
        .ha3b{ animation: heroFadeUp 0.65s 0.30s ease both; }
        .ha4 { animation: heroFadeUp 0.65s 0.36s ease both; }
        .ha5 { animation: heroFadeUp 0.65s 0.48s ease both; }
        .hi  { animation: heroFadeRight 0.8s 0.22s ease both; }
        .fc1 { animation: floatUD 3.6s ease-in-out infinite; }
        .fc2 { animation: floatUD 3.6s 1.2s ease-in-out infinite; }
        .fc3 { animation: floatUD 4.2s 0.7s ease-in-out infinite; }
        .pulse-badge { animation: pulseDot 2s ease-in-out infinite; }
        .st1 { animation: stepIn 0.5s 0.60s ease both; }
        .st2 { animation: stepIn 0.5s 0.78s ease both; }
        .st3 { animation: stepIn 0.5s 0.96s ease both; }
        .st4 { animation: stepIn 0.5s 1.14s ease both; }
        .st5 { animation: stepIn 0.5s 1.32s ease both; }
        .sr   { opacity: 0; transform: translateY(38px);  transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr-l { opacity: 0; transform: translateX(-38px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr-r { opacity: 0; transform: translateX(38px);  transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr.sv, .sr-l.sv, .sr-r.sv { opacity: 1; transform: none; }
        .d1 { transition-delay: 0.08s; }
        .d2 { transition-delay: 0.16s; }
        .d3 { transition-delay: 0.24s; }
        .d4 { transition-delay: 0.32s; }
        .d5 { transition-delay: 0.40s; }
        .d6 { transition-delay: 0.48s; }
        .section-pill {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6ee7b7;
          background: rgba(16,185,129,0.14);
          border: 1px solid rgba(16,185,129,0.32);
          margin-bottom: 12px;
        }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        /* Where the keyboard is. :focus-visible rather than :focus, so a mouse
           click never leaves a ring behind it. */
        .hp button:focus-visible,
        .hp a:focus-visible,
        .hp summary:focus-visible {
          outline: 2px solid #34d399;
          outline-offset: 3px;
          border-radius: 14px;
        }
        /* The questions. A <details> is the whole disclosure — open, close,
           keyboard, and findable by the browser's own find-in-page once open —
           so the only work here is hiding the UA marker and turning the chevron. */
        .hp .faq summary { list-style: none; cursor: pointer; }
        .hp .faq summary::-webkit-details-marker { display: none; }
        .hp .faq summary .chev { transition: transform 0.2s ease; }
        .hp .faq[open] summary .chev { transform: rotate(180deg); }
        /* Respect a stated preference for less motion: the page is decorative
           animation from top to bottom, and none of it carries meaning. */
        @media (prefers-reduced-motion: reduce) {
          .ha1,.ha2,.ha3,.ha3b,.ha4,.ha5,.hi,.fc1,.fc2,.fc3,.pulse-badge,
          .st1,.st2,.st3,.st4,.st5 { animation: none !important; }
          .sr,.sr-l,.sr-r { opacity: 1 !important; transform: none !important; transition: none !important; }
          .hp .faq summary .chev { transition: none !important; }
        }
      `}</style>

      {/* ── Sticky Nav ───────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0b1120] shadow-md border-b border-white/10"
            : "bg-[#0b1120]/85 backdrop-blur-md border-b border-white/5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-9 h-20 flex items-center justify-between">
          <button
            onClick={() => {
              trackHomePageCta("nav_brand");
              navigate("/HomePage");
            }}
            className="flex items-center gap-3"
            aria-label={`${branding.name} home`}
          >
            <TestExpressMark size={34} />
            <span className="text-left leading-none">
              {/* The wordmark an administrator set in Super Admin's User
                  Settings. The drawer and footer below read the same field, so
                  a rename reaches every place this page names itself rather
                  than leaving one header disagreeing with the other two. */}
              {/* font-black italic tracking-[0.06em] in green is the lockup the
                  runner and Super Admin already wear. Restated in Tailwind
                  rather than shared, because those two are drawn from the
                  runner's theme tokens and this page has none of them; #34d399
                  is this page's own accent, already carrying the hero word on
                  the same dark ground. */}
              <span className="block font-black italic tracking-[0.06em] text-[#34d399] text-lg">{branding.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] mt-1">
                {branding.tagline}
              </span>
            </span>
          </button>

          {/* No "Open Recorder" here any more. The hero's own call to action
              is the way in, and a header button that sent a first-time visitor
              to the sign-in page was offering the product to the one person who
              cannot use it yet. */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/test-express-b365b2438"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackHomePageCta("nav_linkedin")}
              aria-label={`${branding.name} on LinkedIn`}
              className="p-2 rounded-lg text-[#cbd5e1] hover:bg-white/10 hover:text-[#34d399] transition-colors"
            >
              <FaLinkedin size={20} />
            </a>
            <button
              onClick={() => {
                trackHomePageCta("mobile_menu");
                setMobileMenuOpen(true);
              }}
              aria-label="Open menu"
              className="md:hidden p-2 rounded-lg text-[#cbd5e1] hover:bg-white/10 transition-colors"
            >
              <MdMenu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-[#111a2e] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <TestExpressMark size={28} />
                <span className="font-black italic tracking-[0.06em] text-[#34d399]">{branding.name}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-[#94a3b8] hover:bg-white/10 transition-colors"
              >
                <MdClose size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    trackHomePageCta("nav_menu", { label: item.name });
                    setMobileMenuOpen(false);
                    navigate(item.path);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[#cbd5e1] hover:bg-[rgba(16,185,129,0.12)] hover:text-[#6ee7b7] font-medium text-sm transition-colors"
                >
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-2">
              <button
                onClick={() => {
                  trackHomePageCta("drawer_create_account");
                  setMobileMenuOpen(false);
                  navigate("/NewRegistration");
                }}
                className="w-full py-3 rounded-xl border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                Create account
              </button>
              <button
                onClick={() => {
                  trackHomePageCta("drawer_open_recorder");
                  setMobileMenuOpen(false);
                  navigate("/TestRunner");
                }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ background: "#10b981" }}
              >
                Open Recorder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section data-section="hero" className="relative bg-[#0b1120] overflow-hidden" style={{ paddingTop: "64px" }}>
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.20) 0%, transparent 68%)" }} />
        <div className="absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 68%)" }} />
        <div className="absolute top-24 left-1/3 w-2 h-2 rounded-full bg-green-300 opacity-50 fc1" />
        <div className="absolute bottom-24 right-1/4 w-3 h-3 rounded-full bg-green-200 opacity-60 fc2" />

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

            {/* Left — Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="ha1 inline-flex items-center gap-2.5 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.32)] text-[#6ee7b7] text-xs font-bold px-4 py-2.5 rounded-full mb-6 shadow-sm">
                <span className="pulse-badge w-2 h-2 bg-green-500 rounded-full inline-block" />
                Test Smarter &middot; Deliver Faster
              </div>

              <h1 className="ha2 font-black text-white leading-[1.08] tracking-tight mb-5"
                style={{ fontSize: "clamp(2.1rem, 5vw, 3.6rem)" }}>
                <span className="whitespace-nowrap">Less Code.</span>
                <br />
                <span className="relative inline-block text-[#34d399]">
                  Better Automation
                  <svg className="absolute -bottom-1.5 left-0 w-full overflow-visible" viewBox="0 0 320 10"
                    preserveAspectRatio="none" style={{ height: "7px" }}>
                    <path d="M4,7 Q80,1 160,6 Q240,11 316,4"
                      stroke="#a7f3d0" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="ha3 text-[#94a3b8] text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              Build, Run and Scale Automated tests with ease - empovering QA Teams to achieve more with {branding.name}
              </p>

              <div className="ha3b flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-4 mb-8">
                {HERO_HIGHLIGHTS.map(({ icon: HighlightIcon, title, detail }, i) => (
                  <Fragment key={title}>
                    {i > 0 && <span className="hidden lg:block w-px h-9 bg-white/10" aria-hidden="true" />}
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.28)] text-[#34d399]">
                        <HighlightIcon size={17} />
                      </span>
                      <span className="text-left text-xs font-bold leading-tight text-[#e2e8f0]">
                        {title}
                        <br />
                        <span className="font-semibold text-[#94a3b8]">{detail}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>

              <div className="ha4 flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-10">
                <button
                  onClick={() => {
                    trackHomePageCta("hero_register");
                    navigate("/Contact");
                  }}
                  className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-2xl text-sm border-2 border-[#34d399] text-[#0b1120] bg-[#34d399] hover:bg-[#10b981] hover:border-[#10b981] hover:shadow-md transition-all duration-200"
                >
                  Contact us Today 
                  <VscArrowRight />
                </button>
              </div>

              <div className="ha5 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
                  <IconBrowser size={16} /> Chromium &middot; Firefox &middot; WebKit
                </span>
                <span className="w-px h-4 bg-white/20" />
                <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
                  <IconMobile size={16} /> Android
                </span>
                <span className="w-px h-4 bg-white/20" />
                <span className="inline-flex items-center gap-1.5 text-[#34d399] font-semibold">
                  <IconCode size={16} /> Exports Playwright
                </span>
              </div>
            </div>

            {/* Right — a mock of the recorder, drawn rather than screenshotted so
                it cannot go stale against the product or cost a request. */}
            <div className="hi flex-1 relative w-full max-w-[600px] mx-auto lg:mx-0">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ width: "118%", aspectRatio: "1/1", zIndex: 0 }}>
                <svg viewBox="0 0 72 72" className="w-full h-full" style={{ animation: "ringSpinCW 75s linear infinite" }}>
                  <circle cx="36" cy="36" r="34" fill="none" stroke="#5b6fd6" strokeWidth="0.4"
                    strokeLinecap="round" strokeDasharray="0.1 3.1" opacity="0.55" />
                </svg>
              </div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ width: "126%", aspectRatio: "1/1", zIndex: 0 }}>
                <svg viewBox="0 0 72 72" className="w-full h-full" style={{ animation: "ringSpinCW2 55s linear infinite" }}>
                  <circle cx="36" cy="36" r="34" fill="none" stroke="#6ee7b7" strokeWidth="0.3"
                    strokeLinecap="round" strokeDasharray="196 24" opacity="0.75" />
                </svg>
              </div>

              {/* The gutter is what the floating cards sit in. Without it they
                  overlap the window itself and cover the two lines that carry
                  the point — the URL under test and the run result. */}
              <div className="relative py-16">
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-[#0f172a] shadow-2xl">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10" style={{ background: "#0b1220" }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
                  <span className="mono ml-3 text-[11px] px-2 py-1 rounded-md text-[#7dd3fc] truncate"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    https://your-app.example/checkout
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 pulse-badge inline-block" />
                    REC
                  </span>
                </div>

                {/* Recorded steps */}
                <div className="p-4 space-y-2" style={{ background: "#0f172a" }}>
                  {[
                    { c: "#5ff0c4", k: "navigate", v: "/checkout",            cls: "st1" },
                    { c: "#93c5fd", k: "click",    v: 'button "Continue"',    cls: "st2" },
                    { c: "#6ee7b7", k: "fill",     v: '#email → {{email}}',   cls: "st3" },
                    { c: "#93c5fd", k: "click",    v: 'button "Pay now"',     cls: "st4" },
                    { c: "#5ff0c4", k: "assert",   v: '"Order confirmed"',    cls: "st5" },
                  ].map((s, i) => (
                    <div key={s.k + i}
                      className={`${s.cls} flex items-center gap-3 rounded-lg px-3 py-2`}
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <span className="mono text-[10px] w-5 text-right" style={{ color: "#475569" }}>{i + 1}</span>
                      <span className="mono text-[11px] font-bold w-16" style={{ color: s.c }}>{s.k}</span>
                      <span className="mono text-[11px] truncate" style={{ color: "#cbd5e1" }}>{s.v}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/5">
                    <span className="mono text-[10px]" style={{ color: "#64748b" }}>5 steps</span>
                    <span className="mono text-[10px] font-bold" style={{ color: "#5ff0c4" }}>passed in 4.2s</span>
                  </div>
                </div>
              </div>

              {/* Floating cards — anchored in the gutter above and below the
                  window, not across it. */}
              <div className="fc1 absolute top-0 left-2 bg-[#16203a] rounded-2xl px-4 py-3 shadow-lg border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#34d399]" style={{ background: "rgba(16,185,129,0.14)" }}>
                  <IconBrowser size={20} />
                </div>
                <div>
                  <div className="text-xl font-black text-white leading-none"><CountUp value="3" /></div>
                  <div className="text-xs text-[#64748b] mt-0.5">Browser engines</div>
                </div>
              </div>

              <div className="fc2 absolute bottom-0 right-2 bg-[#16203a] rounded-2xl px-4 py-3 shadow-lg border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-600" style={{ background: "rgba(245,158,11,0.16)" }}>
                  <IconHeal size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-white leading-none">Self-healing</div>
                  <div className="text-xs text-[#64748b] mt-0.5">Locators repair themselves</div>
                </div>
              </div>

              <div className="fc3 hidden lg:flex absolute top-1/2 -right-10 -translate-y-1/2 bg-[#16203a] rounded-2xl px-4 py-3 shadow-lg border border-white/10 items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#34d399]" style={{ background: "rgba(16,185,129,0.14)" }}>
                  <IconCode size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-white leading-none">Playwright</div>
                  <div className="text-xs text-[#64748b] mt-0.5">Export as code</div>
                </div>
              </div>
              </div>
            </div>

          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.15)] to-transparent" />
      </section>

      {/* ── Fact Strip ───────────────────────────────────────── */}
      <section data-section="facts" className="bg-[#0b1120] py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {facts.map(({ Icon: I, number, label, sub, color, bg }, i) => (
              <div
                key={label}
                className={`sr d${i + 1} group flex flex-col items-center text-center p-6 rounded-2xl border border-white/10 bg-[#16203a] hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-default`}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: bg, color }}>
                  <I size={26} />
                </div>
                {number && (
                  <div className="text-3xl font-black mb-1" style={{ color }}><CountUp value={number} /></div>
                )}
                <div className="text-sm font-bold text-[#f1f5f9]">{label}</div>
                <div className="text-xs text-[#64748b] mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section data-section="features" className="py-20 px-4 border-t border-white/10" style={{ background: "#0f172a" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">What It Does</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Everything in the Recorder
            </h2>
            <p className="text-[#94a3b8] max-w-lg mx-auto text-sm leading-relaxed">
              Not a roadmap. Every tile below is a control that exists in the recorder today —
              open one and you land on it.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {features.map(({ Icon: I, label, note }, index) => (
              <button
                key={label}
                onClick={() => {
                  trackHomePageCta("feature_tile", { label });
                  navigate("/TestRunner");
                }}
                className={`sr d${(index % 6) + 1} group text-left p-5 rounded-2xl bg-[#16203a] border border-white/10 hover:border-[rgba(52,211,153,0.6)] hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-400`}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 text-[#34d399] group-hover:scale-110 transition-transform duration-300"
                  style={{ background: "rgba(16,185,129,0.14)" }}>
                  <I size={22} />
                </div>
                <p className="text-sm font-bold text-[#f1f5f9] group-hover:text-[#6ee7b7] transition-colors leading-tight">
                  {label}
                </p>
                <p className="mt-1 text-xs text-[#64748b] leading-relaxed">{note}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Export banner ────────────────────────────────────── */}
      <div data-section="export" className="sr px-6 md:px-12 py-10 bg-[#0b1120]">
        <div className="max-w-7xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #064e3b 100%)" }}>
          <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
            <div>
              <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-green-400 mb-3">
                No lock-in
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-4">
                Your recording is<br />just Playwright
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-sm">
                Every web recording exports as a Playwright spec you can read, review and commit.
                If you ever stop using {branding.name}, the tests keep running.
              </p>
              <button
                onClick={() => {
                  trackHomePageCta("export_try");
                  navigate("/TestRunner");
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white border border-white/25 hover:bg-white/20 transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}
              >
                <IconCode size={16} />
                Try the export
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "rgba(2,6,23,0.6)" }}>
              <div className="px-4 py-2.5 border-b border-white/10 mono text-[11px] text-[#94a3b8]">
                checkout.spec.ts
              </div>
              <pre className="mono text-[11px] leading-relaxed p-4 overflow-x-auto" style={{ color: "#cbd5e1" }}>
{`test('checkout', async ({ page }) => {
  await page.goto(BASE_URL + '/checkout');
  await page.getByRole('button',
    { name: 'Continue' }).click();
  await page.fill('#email', DATA.email);
  await page.getByRole('button',
    { name: 'Pay now' }).click();
  await expect(page.getByText(
    'Order confirmed')).toBeVisible();
});`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* ── Engines ──────────────────────────────────────────── */}
      <section data-section="engines" className="py-20 px-4 border-t border-white/10" style={{ background: "#0f172a" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Three Engines</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Same Steps, Your Choice of Engine
            </h2>
            <p className="text-[#94a3b8] max-w-lg mx-auto text-sm leading-relaxed">
              One recording runs on all three. Each has a trade-off, so here they are —
              picking the wrong one costs an afternoon.
            </p>
          </div>

          <div className="relative px-8">
            <Slider {...engineSliderSettings}>
              {engines.map(({ name, tag, Icon: I, blurb, limit }) => (
                <div key={name} className="px-3">
                  <div className="group h-full rounded-2xl bg-[#16203a] shadow-sm border border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#34d399]"
                          style={{ background: "rgba(16,185,129,0.14)" }}>
                          <I size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-white leading-tight">{name}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#34d399]">{tag}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[#94a3b8] leading-relaxed min-h-[5.5rem]">{blurb}</p>
                    </div>
                    <div className="px-6 py-3 flex items-start gap-2 border-t border-white/10" style={{ background: "rgba(16,185,129,0.14)" }}>
                      <span className="text-[#64748b] mt-0.5"><IconShield size={14} /></span>
                      <span className="text-xs text-[#94a3b8] leading-snug">{limit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </Slider>
          </div>
        </div>
      </section>

      {/* ── Workflow ─────────────────────────────────────────── */}
      <section data-section="workflow" className="py-20 px-4 bg-[#0b1120] border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              From Click to Report
            </h2>
            <p className="text-[#94a3b8] text-sm">Four steps, and none of them is writing code.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflow.map(({ n, title, body }, index) => (
              <div
                key={n}
                className={`sr d${(index % 4) + 1} relative bg-[#16203a] rounded-2xl p-6 shadow-sm border border-white/10 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col`}
              >
                <span className="mono text-4xl font-black leading-none mb-3" style={{ color: "rgba(110,231,183,0.38)" }}>{n}</span>
                <h3 className="font-black text-white mb-2">{title}</h3>
                <p className="text-[#94a3b8] text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built on ─────────────────────────────────────────── */}
      <section data-section="built_on" className="py-20 px-4" style={{ background: "linear-gradient(135deg, #0b1120 0%, #101a33 50%, #16112e 100%)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Built On</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Standards, Not a Black Box
            </h2>
            <p className="text-[#94a3b8] text-sm max-w-lg mx-auto">
              {branding.name} drives tools your team already trusts, and hands the work back in their formats.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {builtOn.map(({ name, role, version }, i) => (
              <div
                key={name}
                className={`sr d${(i % 6) + 1} rounded-2xl px-6 py-5 transition-all duration-300`}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.38)",
                  border: "1.5px solid rgba(129,140,248,0.24)",
                }}
              >
                <div className="flex items-baseline gap-2">
                  <div className="font-black text-[#f1f5f9]">{name}</div>
                  {version && (
                    <span className="mono text-[10px] font-bold text-[#34d399]">{version}</span>
                  )}
                </div>
                <div className="text-xs text-[#94a3b8] mt-1 leading-relaxed">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────── */}
      {/* After the capabilities and before the questions, which is the order
          the page is read in: what it does, what it costs, what you are still
          wondering. Every figure comes from the catalogue in the database —
          nothing here is typed into the page, so it cannot drift from what the
          registration form and Super Admin say. */}
      <section data-section="plans" className="py-20 px-4 bg-[#0f172a] border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Plans</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Start Free, Add Engines Later
            </h2>
            <p className="text-[#94a3b8] max-w-lg mx-auto text-sm leading-relaxed">
              Every tier records, replays and exports. What the paid ones add is where the test
              runs — a real browser, a real device — and the automation around a suite.
            </p>
          </div>

          {/* Columns follow the catalogue: three tiers get three columns, four
              get two-by-two on a tablet and four across on a wide screen. A
              fixed three would strand the fourth card alone on its own row. */}
          <div
            className={
              "grid gap-5 sm:grid-cols-2 " +
              (PLANS.length > 3 ? "lg:grid-cols-4" : "md:grid-cols-3")
            }
          >
            {PLANS.map((plan, i) => {
              // The second tier — the first paid one — is what most people
              // want, and saying so is the difference between a row of prices
              // and a recommendation. By position rather than by name, so a
              // renamed or reordered catalogue keeps marking the right card,
              // and by index 1 rather than "the middle" so it stays put as
              // tiers are added above it.
              const featured = PLANS.length > 2 && i === 1;
              return (
                <div
                  key={plan.value}
                  className={`sr d${i + 1} flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                    featured
                      ? "border-[rgba(52,211,153,0.55)] bg-[#16203a] shadow-xl"
                      : "border-white/10 bg-[#16203a]/70 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-black text-white">{plan.label || plan.value}</h3>
                    {featured && (
                      <span className="rounded-full bg-[rgba(16,185,129,0.16)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6ee7b7]">
                        Most used
                      </span>
                    )}
                    {/* Who the tier is for. Said on the card because it is the
                        first thing that rules a plan in or out for a reader:
                        somebody buying for themselves can stop reading here. */}
                    {planKind(plan) === "corporate" && (
                      <span className="rounded-full bg-[rgba(129,140,248,0.18)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a5b4fc]">
                        For teams
                      </span>
                    )}
                  </div>

                  {/* The price as the catalogue has it. An unpriced tier reads
                      "Price on request" rather than showing a figure nobody
                      set — the one thing a pricing section must never do. */}
                  <div className="mt-3 text-2xl font-black text-[#34d399]">
                    {priceLabel(plan)}
                  </div>

                  {plan.blurb && (
                    <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">{plan.blurb}</p>
                  )}

                  <ul className="mt-5 flex-1 space-y-2">
                    {i > 0 && (
                      <li className="text-xs italic text-[#64748b]">
                        Everything in {PLANS[i - 1].label || PLANS[i - 1].value}, plus:
                      </li>
                    )}
                    {addedBy(plan.value).map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-xs text-[#cbd5e1]">
                        <span aria-hidden="true" className="mt-0.5 text-[#34d399]">
                          <IconCheck size={13} />
                        </span>
                        <span className="leading-relaxed">{c.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-[#475569]">
                      {capabilitiesOf(plan.value).length} capabilities
                    </span>
                    <button
                      onClick={() => {
                        trackHomePageCta("plan_choose", { label: plan.value });
                        navigate("/NewRegistration?plan=" + encodeURIComponent(plan.value));
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors duration-200 ${
                        featured
                          ? "bg-[#34d399] text-[#04231a] hover:bg-[#6ee7b7]"
                          : "border border-white/25 text-[#e2e8f0] hover:border-[#34d399] hover:text-white"
                      }`}
                    >
                      Get started
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* What a plan is and is not, stated where somebody is deciding.
              Both halves are true and both are easy to assume otherwise: the
              plan really does gate the engines, and nothing here takes money. */}
          <p className="sr mt-8 text-center text-[11px] leading-relaxed text-[#64748b]">
            A plan decides which capabilities the recorder offers your account — a tier without
            the real-browser engine shows it disabled rather than hiding it. Signing up does not
            take a payment: there is no checkout here, and an account starts on whichever plan
            you pick.
          </p>
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────── */}
      {/* Last of the content sections, because these are the questions asked
          after the pitch has landed rather than before it. Two columns on a
          wide screen so six answers do not become a page of scrolling, one on a
          phone where a two-column answer would be four words per line. */}
      <section data-section="faq" className="py-20 px-4 bg-[#0b1120] border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="sr text-center mb-12">
            <span className="section-pill">Questions</span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              Before You Record Anything
            </h2>
            <p className="text-[#94a3b8] text-sm max-w-lg mx-auto leading-relaxed">
              Including the parts that are limits rather than features — they are cheaper to
              read here than to discover on your third test.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map(({ q, a }, i) => (
              <details
                key={q}
                className={`faq sr d${(i % 6) + 1} group rounded-2xl bg-[#16203a] border border-white/10 hover:border-[rgba(52,211,153,0.45)] transition-colors duration-300`}
                onToggle={(e) => e.currentTarget.open && trackHomePageCta("faq_open", { label: q })}
              >
                <summary className="flex items-start gap-3 p-5">
                  <span className="flex-1 text-sm font-bold text-[#f1f5f9] leading-snug">{q}</span>
                  <span className="chev text-[#34d399] mt-0.5 flex-shrink-0" aria-hidden="true">
                    <Icon size={16}><path d="M6 9l6 6 6-6" /></Icon>
                  </span>
                </summary>
                <p className="px-5 pb-5 -mt-1 text-[13px] text-[#94a3b8] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing call to action ───────────────────────────── */}
      {/* The page ends on the same two doors the header offers, because a
          visitor who has read this far has nowhere else to go: the header
          scrolled away five sections ago, and the mobile bar is not on desktop. */}
      <section data-section="cta" className="px-6 md:px-12 py-16" style={{ background: "#0f172a" }}>
        <div
          className="sr max-w-5xl mx-auto rounded-3xl border border-white/10 shadow-2xl px-8 py-12 md:px-14 md:py-14 text-center"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #16203a 55%, #064e3b 100%)" }}
        >
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight mb-4">
            Your first test is a recording,
            <br className="hidden sm:block" /> not a file to write
          </h2>
          <p className="text-[#94a3b8] text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8">
            Open a page, use it once, and press save. Everything else on this page — the real
            browsers, the Android device, the Playwright export — is something you reach for
            afterwards, from the same recording.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => {
                trackHomePageCta("cta_register");
                navigate("/NewRegistration");
              }}
              className="px-8 py-3.5 rounded-2xl text-sm font-bold text-[#04231a] bg-[#34d399] hover:bg-[#6ee7b7] transition-colors duration-200 shadow-lg"
            >
              Register for free
            </button>
            <button
              onClick={() => {
                trackHomePageCta("cta_sign_in");
                navigate("/my-app");
              }}
              className="px-8 py-3.5 rounded-2xl text-sm font-bold text-[#e2e8f0] border-2 border-white/20 bg-white/5 hover:border-[#34d399] hover:text-white transition-all duration-200"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer
        data-section="footer"
        className="text-[rgba(203,213,225,0.8)] pb-24 md:pb-0"
        style={{ background: "linear-gradient(135deg, #1c1917 0%, #292524 55%, #064e3b 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <TestExpressMark size={32} />
              <span className="font-black italic tracking-[0.06em] text-[#34d399]">{branding.name}</span>
            </div>
            <p className="text-sm leading-relaxed text-[rgba(203,213,225,0.7)]">
              Record a test by using your app. Replay it in a real browser or on a real device.
              Export it as Playwright whenever you want the code.
            </p>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Product</h3>
            {/* Plain text, like the two columns beside it: this column lists
                what the product does, it is not a second navigation. The header
                and the calls to action are what take you into the app. */}
            <ul className="space-y-3 text-sm text-[rgba(203,213,225,0.7)]">
              <li>Open the recorder</li>
              <li>Sign in</li>
              <li>Create account</li>
              <li>Your profile</li>
            </ul>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Engines</h3>
            <ul className="space-y-3 text-sm text-[rgba(203,213,225,0.7)]">
              <li>Playwright</li>
              <li>Chromium &middot; Firefox &middot; WebKit</li>
              <li>Appium</li>
              <li>Extent Reports</li>
            </ul>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Capabilities</h3>
            <ul className="space-y-3 text-sm text-[rgba(203,213,225,0.7)]">
              <li>Self-healing locators</li>
              <li>Named data sets</li>
              <li>Scheduled runs</li>
              <li>Playwright export</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 text-center py-5 text-xs text-[#94a3b8]">
          © {new Date().getFullYear()} {branding.name}. All rights reserved.
        </div>
      </footer>

      {/* ── Floating CTA (mobile) ────────────────────────────── */}
      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-all duration-300 ${
          showFloatingCTA ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => {
              trackHomePageCta("floating_sign_in");
              navigate("/my-app");
            }}
            className="flex-1 py-3 rounded-xl border border-white/25 text-[#cbd5e1] font-semibold text-sm hover:border-green-500 hover:text-green-400 transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => {
              trackHomePageCta("floating_open_recorder");
              navigate("/TestRunner");
            }}
            className="flex-[2] py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "#10b981" }}
          >
            Open the Recorder →
          </button>
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>

      {/* ── Back to Top ──────────────────────────────────────── */}
      <button
        onClick={() => {
          trackHomePageCta("back_to_top");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label="Back to top"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          showFloatingCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ background: "#10b981" }}
      >
        <FaChevronUp size={14} className="text-white" />
      </button>

    </div>
  );
}

export default Welcome;