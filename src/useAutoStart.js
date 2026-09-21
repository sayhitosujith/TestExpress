// "This will happen unless you stop it" — the countdown behind the recorder's
// self-starting Appium server and emulator.
//
// Its own module because two components make the tester that identical promise
// (see AppiumStarter and DeviceStarter in TestRunner.jsx), and two copies of a
// timer that fires a side effect is how one of them ends up firing twice, or
// never, after an edit to the other. Being a module rather than a closure
// inside that file also makes the one genuinely fiddly part of this — fire
// exactly once, on time, and not at all if cancelled — testable on its own.

import { useEffect, useRef, useState } from "react";

// How long the dialog waits before starting a missing piece by itself.
//
// This reverses the older rule that a server "is worth a deliberate press", and
// the countdown is what keeps the half of that rule which was right. Spawning a
// server and booting an emulator both change the tester's machine, so the choice
// stays visible and refusable — it simply stops being something you must press
// before anything can happen. On the common path you pick Mobile app, look away,
// and it is ready; on the uncommon one you have ten seconds to say no.
export const AUTO_START_SECONDS = 10;

/** The "Not now" link that calls the countdown off, styled as text rather than a button. */
export const AUTO_CANCEL_BTN = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "var(--tr-info)",
  textDecoration: "underline",
  cursor: "pointer",
};

/**
 * Run something once, after a visible countdown that can be called off.
 *
 * Fires at most once per mount. Deliberately not re-armed after the run, for
 * two reasons: a start that failed needs a person to read the log rather than a
 * timer that relaunches over it, and a start that succeeded without satisfying
 * the probe (Appium up, still no device) would otherwise sit here relaunching a
 * server that is already running.
 *
 * @param {{armed: boolean, run: function(): void}} opts `armed` gates the
 *   countdown — false whenever there is nothing to start, or a start is already
 *   under way. It may go true late (a device list arriving from a second
 *   request); the countdown simply begins then.
 * @param {number} [seconds] override for the wait, for tests.
 * @returns {{left: number|null, cancel: function(): void}} seconds remaining,
 *   or null when nothing is pending.
 */
export default function useAutoStart({ armed, run }, seconds = AUTO_START_SECONDS) {
  const [left, setLeft] = useState(null);
  const [off, setOff] = useState(false);
  // `run` is a new closure on every render. Held in a ref so the interval below
  // is not torn down and rebuilt each second, which would stop the count ever
  // reaching zero.
  const runRef = useRef(run);
  runRef.current = run;
  const fired = useRef(false);

  useEffect(() => {
    if (!armed || off || fired.current) {
      setLeft(null);
      return undefined;
    }
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearInterval(t);
  }, [armed, off, seconds]);

  // Launched from its own effect rather than from inside the tick's updater:
  // React invokes a state updater twice under StrictMode, and starting a server
  // from in there would spawn two of them.
  useEffect(() => {
    if (left !== 0 || fired.current) return;
    fired.current = true;
    setLeft(null);
    runRef.current();
  }, [left]);

  return {
    left,
    cancel: () => {
      setOff(true);
      setLeft(null);
    },
  };
}
