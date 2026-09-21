// Small dropdown to switch the app language. Drop it into any page's nav:
//   import LanguageSwitcher from "./LanguageSwitcher";
//   <LanguageSwitcher />
// The choice is persisted to localStorage ("appLanguage") by i18next.
//
// Most pages carry no nav of their own, so <FloatingLanguageSwitcher /> is
// mounted once in index.js and covers all of them. See the note there.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "./i18n";

// How many inline switchers are on screen right now. A page that has put the
// control in its own nav does it better than a corner pill can, so the floating
// fallback stands down while one is mounted — that is the whole reason this
// registry exists. Kept in module scope rather than context so a page does not
// have to be wrapped in anything to take part.
let inlineCount = 0;
const listeners = new Set();
const publish = () => listeners.forEach((fn) => fn(inlineCount));

export default function LanguageSwitcher({ className = "", floating = false }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (floating) return undefined;
    inlineCount += 1;
    publish();
    return () => {
      inlineCount -= 1;
      publish();
    };
  }, [floating]);

  return (
    <select
      aria-label="Select language"
      value={i18n.resolvedLanguage || i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className={
        className ||
        "rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
      }
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

// The app has no shared header — every route renders its own chrome — so the
// only way to offer this on all ~40 pages without editing all ~40 is to mount
// it once, outside the router, pinned to the viewport. Bottom-left because the
// top-right corner is where pages put their account menus and the bottom-right
// is where chat/support widgets go.
export function FloatingLanguageSwitcher() {
  const [hidden, setHidden] = useState(inlineCount > 0);

  useEffect(() => {
    const fn = (count) => setHidden(count > 0);
    listeners.add(fn);
    fn(inlineCount); // catch a page that mounted its own before we subscribed
    return () => listeners.delete(fn);
  }, []);

  if (hidden) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 1000, // above page content, below nothing that matters
      }}
    >
      <LanguageSwitcher
        floating
        className="rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow-lg backdrop-blur focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
      />
    </div>
  );
}
