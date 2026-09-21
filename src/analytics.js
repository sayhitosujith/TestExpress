/**
 * Google Analytics (GA4), loaded only when REACT_APP_GA_MEASUREMENT_ID is set.
 *
 * Wired centrally through router.subscribe() in index.js rather than inside
 * any page component: gtag.js's own automatic page_view fires exactly once,
 * on the script's first load, so a single-page app's client-side navigations
 * (react-router swapping routes without a document reload) would otherwise
 * never be seen. `send_page_view: false` below turns that automatic one off
 * so every view -- the first included -- goes through trackPageView, which
 * keeps there from being two slightly different code paths for "the first
 * page" and "every page after it".
 */
const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;

let initialized = false;

/** Injects gtag.js. A no-op with no measurement id configured, or if already run. */
export function initGA() {
  if (!GA_ID || initialized) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
}

/**
 * Records one page view. Safe to call before initGA resolves or with
 * analytics disabled -- window.gtag is only ever called once it exists.
 *
 * @param {string} path e.g. window.location.pathname.
 */
export function trackPageView(path) {
  if (!GA_ID || !window.gtag) return;
  window.gtag("config", GA_ID, { page_path: path });
}
