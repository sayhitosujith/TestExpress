import { useState, useEffect } from "react";
import TestExpressMark from "./TestExpressMark";

/* Full-page loading overlay: the logo above a row of bouncing dots.
   Shown for `duration` ms on mount, then removed. Drop <PageLoader /> at the
   top of any page's returned JSX. */

const DOT = 9;
const GAP = 9;
const BOUNCE_MS = 1200;

/* Three identical dots running the same bounce, each started later than the
   last. The stagger is the whole effect — the wave travels left to right
   because of the delays, not because the dots differ. Held at 120ms because
   the gap has to read as a sequence rather than three dots moving together;
   much more and the row stops looking like one animation. */
const DELAYS = [0, 120, 240];

export default function PageLoader({ duration = 1800 }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
      role="status"
      aria-label="Loading"
    >
      {/* Most of the cycle is spent at rest: the dot lifts and drops inside the
          first 40%, then waits its turn again. A dot that moves the whole time
          reads as jitter. */}
      <style>{`@keyframes ptBounce {
  0%, 45%, 100% { transform: translateY(0); opacity: 0.3; }
  20% { transform: translateY(-9px); opacity: 1; }
}`}</style>
      <div className="flex flex-col items-center" style={{ gap: 22 }}>
        {/* The product mark, not the tooth logo this used to load: the loader is
            the very first thing anyone sees, and it was branding the test tool
            as a dental clinic. Drawn, so it costs no request on first paint. */}
        <TestExpressMark size={64} />
        <span className="flex items-end" style={{ gap: GAP, height: DOT }}>
          {DELAYS.map((delay) => (
            <span
              key={delay}
              aria-hidden="true"
              className="rounded-full"
              style={{
                width: DOT,
                height: DOT,
                background: "#5b6fd6",
                // `backwards` so a dot shows the 0% keyframe while it waits its
                // turn. Without it the two delayed dots render at full opacity
                // for their delay and then snap dim as the animation starts —
                // a visible flash every time the overlay mounts.
                animation: `ptBounce ${BOUNCE_MS}ms ease-in-out infinite backwards`,
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
