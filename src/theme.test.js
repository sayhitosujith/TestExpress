/**
 * The app-wide theme, including the choice that answers to the clock.
 *
 * Two things here are worth pinning down. The boundaries of the dark window,
 * because an off-by-one hour is invisible in review and obvious at 19:00; and
 * that "auto" changes a page nobody has touched -- a screen that resolved the
 * clock once on mount would sit in yesterday's theme until it was reloaded,
 * which is the whole feature failing in the quietest possible way.
 */
import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import {
  DARK_FROM_HOUR,
  DARK_UNTIL_HOUR,
  hourLabel,
  loadThemeChoice,
  persistTheme,
  resolveTheme,
  THEME_CHOICES,
  THEME_CHOSEN_KEY,
  THEME_KEY,
  themeForTime,
  useAppTheme,
} from "./theme";

/** A moment on a fixed date, so only the hour under test varies. */
const at = (hour, minute = 0) => new Date(2026, 0, 15, hour, minute, 0);

beforeEach(() => {
  localStorage.clear();
});

describe("the dark window", () => {
  test.each([19, 20, 23, 0, 3, 6])("%i:00 is dark", (hour) => {
    expect(themeForTime(at(hour))).toBe("dark");
  });

  test.each([7, 8, 12, 17, 18])("%i:00 is light", (hour) => {
    expect(themeForTime(at(hour))).toBe("light");
  });

  test("the boundaries fall where the constants say", () => {
    // The minute either side of each edge, which is where an off-by-one lives.
    expect(themeForTime(at(DARK_FROM_HOUR - 1, 59))).toBe("light");
    expect(themeForTime(at(DARK_FROM_HOUR, 0))).toBe("dark");
    expect(themeForTime(at(DARK_UNTIL_HOUR - 1, 59))).toBe("dark");
    expect(themeForTime(at(DARK_UNTIL_HOUR, 0))).toBe("light");
  });
});

describe("the stored choice", () => {
  test("a browser that has never chosen gets auto", () => {
    expect(loadThemeChoice()).toBe("auto");
  });

  test.each(THEME_CHOICES)("%s is stored and read back", (choice) => {
    persistTheme(choice);
    expect(loadThemeChoice()).toBe(choice);
  });

  test("anything unrecognised falls back to auto rather than through", () => {
    for (const junk of ["", "AUTO", "midnight", "{}", "null"]) {
      localStorage.setItem(THEME_KEY, junk);
      localStorage.setItem(THEME_CHOSEN_KEY, "1");
      expect(loadThemeChoice()).toBe("auto");
    }
  });

  // The browsers that already existed when "auto" did not. Their stored value
  // answers a question with two options, so it cannot be read as a choice
  // between three -- otherwise the clock reaches nobody who ever used the old
  // toggle, which is every existing user of this app.
  test.each(["light", "dark"])(
    "a %s left by the old two-way toggle hands the browser Auto once",
    (legacy) => {
      localStorage.setItem(THEME_KEY, legacy);
      expect(localStorage.getItem(THEME_CHOSEN_KEY)).toBeNull();
      expect(loadThemeChoice()).toBe("auto");
    },
  );

  test("reading the choice does not itself decide anything", () => {
    // Twice in a row must mean the same thing: if the migration wrote to
    // storage, the second read would answer differently from the first.
    localStorage.setItem(THEME_KEY, "dark");
    expect(loadThemeChoice()).toBe("auto");
    expect(loadThemeChoice()).toBe("auto");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  test("picking the same value again on the new control makes it stick", () => {
    localStorage.setItem(THEME_KEY, "dark"); // migrated away on load
    expect(loadThemeChoice()).toBe("auto");

    persistTheme("dark"); // and now chosen deliberately
    expect(loadThemeChoice()).toBe("dark");
  });

  test("an explicit choice ignores the clock; auto does not", () => {
    expect(resolveTheme("light", at(23))).toBe("light");
    expect(resolveTheme("dark", at(12))).toBe("dark");
    expect(resolveTheme("auto", at(23))).toBe("dark");
    expect(resolveTheme("auto", at(12))).toBe("light");
  });
});

describe("useAppTheme", () => {
  /** Reports what the hook resolved, and offers a way to change the choice. */
  function Probe() {
    const { choice, theme, setTheme } = useAppTheme();
    return (
      <div>
        <span data-testid="painted">{theme}</span>
        <span data-testid="choice">{choice}</span>
        {THEME_CHOICES.map((c) => (
          <button key={c} onClick={() => setTheme(c)}>
            {c}
          </button>
        ))}
      </div>
    );
  }

  const painted = () => screen.getByTestId("painted").textContent;
  const chosen = () => screen.getByTestId("choice").textContent;
  const press = (label) => act(() => { screen.getByText(label).click(); });
  const clockTo = (hour) =>
    act(() => {
      jest.setSystemTime(at(hour));
      jest.advanceTimersByTime(60_000);
    });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("auto paints what the clock says at mount", () => {
    jest.setSystemTime(at(21));
    render(<Probe />);
    expect(chosen()).toBe("auto");
    expect(painted()).toBe("dark");
  });

  test("auto repaints when the clock crosses into the dark window", () => {
    // The point of the whole feature: nobody touches this page.
    jest.setSystemTime(at(18, 59));
    render(<Probe />);
    expect(painted()).toBe("light");

    clockTo(DARK_FROM_HOUR);
    expect(painted()).toBe("dark");
  });

  test("auto repaints again at the morning boundary", () => {
    jest.setSystemTime(at(6, 59));
    render(<Probe />);
    expect(painted()).toBe("dark");

    clockTo(DARK_UNTIL_HOUR);
    expect(painted()).toBe("light");
  });

  test("an explicit choice is never overridden by the clock", () => {
    jest.setSystemTime(at(12));
    render(<Probe />);
    press("dark");
    expect(painted()).toBe("dark");

    clockTo(23);
    expect(painted()).toBe("dark");
    clockTo(12);
    expect(painted()).toBe("dark");
    expect(chosen()).toBe("dark");
  });

  test("switching to auto takes effect on the click, not on the next tick", () => {
    jest.setSystemTime(at(22));
    render(<Probe />);
    press("light");
    expect(painted()).toBe("light");

    press("auto");
    expect(painted()).toBe("dark");
  });

  test("the choice is persisted for the next page", () => {
    jest.setSystemTime(at(12));
    render(<Probe />);
    press("dark");
    expect(localStorage.getItem("testrunner.theme")).toBe("dark");
    press("auto");
    expect(localStorage.getItem("testrunner.theme")).toBe("auto");
  });
});

describe("hourLabel", () => {
  test("reads as a 24-hour clock face", () => {
    expect(hourLabel(7)).toBe("07:00");
    expect(hourLabel(19)).toBe("19:00");
    expect(hourLabel(0)).toBe("00:00");
  });
});
