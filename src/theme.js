// Light or dark, for the whole app.
//
// One stored preference rather than one per screen. Somebody who has just made
// the test runner dark and then opens account administration has said what they
// want the app to look like; asking them again on the next page, and leaving
// the two able to disagree, is the kind of split that makes a theme toggle feel
// broken rather than configurable.
//
// The key is TestRunner's original one. It is a poor name for something the
// whole app reads, and renaming it would silently discard the preference of
// everyone who has already set it — which is a worse trade than an awkward
// string, so the name stays and this comment explains it.
//
// There are two different values in play here and keeping them apart is what
// makes the rest of this module simple:
//
//   * the CHOICE — what the person picked, and the only thing stored: "light",
//     "dark" or "auto".
//   * the RESOLVED theme — what the page actually paints, always "light" or
//     "dark". For an explicit choice it is the choice; for "auto" it is
//     whatever the clock says right now, which means it changes underneath a
//     page that nobody has touched.
//
// Only `useAppTheme` deals with the second one changing over time, so no screen
// has to own a timer of its own.
import { useCallback, useEffect, useState } from "react";

export const THEME_KEY = "testrunner.theme";

// Whether anyone has answered the three-way control on this browser.
//
// Needed because the value under THEME_KEY predates "auto": every browser that
// used the old Light/Dark toggle has "light" or "dark" stored, and reading that
// back as a settled choice would mean the clock never reaches a single existing
// user -- the feature would be live and invisible to everybody who had ever
// touched the toggle. An old value is therefore treated as what it was, an
// answer to a two-way question that did not include the clock, and those
// browsers land on Auto once. One click on Light or Dark sets this flag and
// they are never moved again.
export const THEME_CHOSEN_KEY = "testrunner.theme.chosen";

/** What a page can paint. */
export const THEMES = ["light", "dark"];

/** What the settings panels offer, in the order they list them. */
export const THEME_CHOICES = ["light", "dark", "auto"];

// The dark window, in local hours: dark from 19:00 up to 07:00. Local rather
// than fixed-offset on purpose -- the point is the light in the room the screen
// is in, so a machine that has been carried into another timezone should follow
// it.
export const DARK_FROM_HOUR = 19;
export const DARK_UNTIL_HOUR = 7;

// How often "auto" re-reads the clock. A plain interval rather than one timer
// armed for the exact boundary: a timeout set twelve hours ahead is wrong after
// a daylight-saving change and does not fire on time on a machine that slept
// through it, whereas re-asking the question every minute is self-correcting
// and costs a string comparison that usually changes nothing.
const TICK_MS = 60_000;

/**
 * An hour of the day on a 24-hour clock face.
 *
 * Here rather than in either settings panel: both name the dark window in their
 * hint, and both have to say it the same way as the constants above.
 *
 * @param {number} hour 0-23.
 * @returns {string} e.g. "19:00".
 */
export function hourLabel(hour) {
  return String(hour).padStart(2, "0") + ":00";
}

/**
 * Which theme the clock asks for.
 *
 * @param {Date} [now] the moment to judge; defaults to this one.
 * @returns {"light"|"dark"}
 */
export function themeForTime(now = new Date()) {
  const hour = now.getHours();
  return hour >= DARK_FROM_HOUR || hour < DARK_UNTIL_HOUR ? "dark" : "light";
}

/**
 * The stored choice, or "auto" for anyone who has not made one.
 *
 * "auto" is the default because it is the only answer that is right at both
 * ends of the day. It replaces the OS `prefers-color-scheme` default this
 * module used to fall back to: both are automatic answers to the same
 * question, and consulting both would let them disagree — a machine set to
 * dark all day against a clock that says it is 10am — with no way for a person
 * to tell which one had won. Anyone who wants the OS answer instead can pick
 * Light or Dark once, and that sticks.
 *
 * Reads only. The migration described on THEME_CHOSEN_KEY happens by omission
 * -- an unflagged value is simply not treated as a choice -- rather than by
 * rewriting storage here, so calling this twice cannot mean two things.
 *
 * @returns {"light"|"dark"|"auto"}
 */
export function loadThemeChoice() {
  try {
    const chosen = localStorage.getItem(THEME_CHOSEN_KEY) === "1";
    const saved = localStorage.getItem(THEME_KEY);
    if (chosen && THEME_CHOICES.includes(saved)) return saved;
  } catch {
    /* storage disabled — "auto" below is still a real answer */
  }
  return "auto";
}

/**
 * Remembers the choice, best effort.
 *
 * A preference that failed to save must never cost anything else: the page has
 * already switched by the time this runs, so the worst a full quota can do is
 * make the choice last only as long as the tab.
 *
 * @param {"light"|"dark"|"auto"} choice
 */
export function persistTheme(choice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
    // Written together: the flag is what turns a stored string into a choice,
    // so a value saved without it would be migrated away on the next load.
    localStorage.setItem(THEME_CHOSEN_KEY, "1");
  } catch (err) {
    console.warn("[theme] preference not persisted:", err);
  }
}

/**
 * The theme to paint for a choice.
 *
 * @param {"light"|"dark"|"auto"} choice
 * @param {Date} [now] the moment to judge, for "auto".
 * @returns {"light"|"dark"}
 */
export function resolveTheme(choice, now) {
  return choice === "auto" ? themeForTime(now) : choice;
}

/**
 * The stored choice, the theme to paint, and one way to change it.
 *
 * A hook rather than three functions each screen wires up itself, because the
 * hard part is not reading the preference -- it is that "auto" changes while
 * nobody is looking. A screen that only read the choice on mount would sit in
 * yesterday's theme until it was reloaded, which is the same bug on every page
 * that has a theme.
 *
 * The timer runs only for "auto": an explicit choice has nothing to re-check.
 *
 * @returns {{choice: "light"|"dark"|"auto", theme: "light"|"dark",
 *   setTheme: (choice: string) => void}}
 */
export function useAppTheme() {
  const [choice, setChoice] = useState(loadThemeChoice);
  const [theme, setTheme] = useState(() => resolveTheme(choice));

  useEffect(() => {
    // Re-resolved on the way in as well as on the tick, so switching to "auto"
    // takes effect on the click rather than up to a minute later.
    setTheme(resolveTheme(choice));
    if (choice !== "auto") return undefined;
    const id = setInterval(() => setTheme(resolveTheme(choice)), TICK_MS);
    return () => clearInterval(id);
  }, [choice]);

  const chooseTheme = useCallback((next) => {
    persistTheme(next);
    setChoice(next);
  }, []);

  return { choice, theme, setTheme: chooseTheme };
}
