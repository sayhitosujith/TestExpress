/**
 * What the two table preferences in the User Settings panel actually do.
 *
 * Both were reported as not working, and both were reachable from the panel:
 * the sort order was applied and the timer did fire. What was missing was any
 * evidence of either -- with every account able to sign in the two orders are
 * the same list, and a timed re-read that finds no change redraws the same
 * rows, so switching them looked like pressing a dead button.
 *
 * So this exercises the effect rather than the control: the order of the rows
 * the table renders, and the calls the page makes to the database.
 */
import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SuperAdmin from "./SuperAdmin";
import { AuthProvider } from "./context/AuthContext";
import { listAccounts } from "./api/admin";

jest.mock("./api/auth", () => ({ login: jest.fn(), register: jest.fn() }));
jest.mock("./api/admin", () => ({
  listAccounts: jest.fn(),
  setRole: jest.fn(),
  setSignIn: jest.fn(),
  updateAccount: jest.fn(),
  resetPassword: jest.fn(),
  deleteAccount: jest.fn(),
}));

/**
 * One account of each kind that matters here: the alphabetically last of the
 * three is the one that cannot sign in, so the two sort orders disagree.
 */
const ACCOUNTS = [
  { key: "m", firstName: "Mark", lastName: "Lee", email: "mark@x.com", role: "Doctor", canSignIn: true },
  { key: "z", firstName: "Zoe", lastName: "Blake", email: "zoe@x.com", role: "User", canSignIn: false },
  { key: "a", firstName: "Adrita", lastName: "Sen", email: "adrita@x.com", role: "User", canSignIn: true },
];

const signIn = () => {
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("authToken", "session-token");
  localStorage.setItem(
    "user",
    JSON.stringify({ name: "Test Person", email: "person@practice.com", role: "Super Admin" }),
  );
};

const openTable = async () => {
  const view = render(
    <MemoryRouter initialEntries={["/SuperAdmin"]}>
      <AuthProvider>
        <SuperAdmin />
      </AuthProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  await act(async () => {});
  return view;
};

/** The first names in the order the table renders them. */
const rowOrder = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.textContent.match(/Mark|Zoe|Adrita/))
    .filter(Boolean)
    .map((m) => m[0]);

/** The panel opens from the left rail, which is where Settings lives. */
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));

const panel = () => screen.getByRole("dialog", { name: /user settings/i });
const choose = (name) =>
  fireEvent.click(within(panel()).getByRole("radio", { name }));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  listAccounts.mockResolvedValue(ACCOUNTS);
  signIn();
});

describe("sort order", () => {
  test("defaults to the account that cannot sign in, and says so", async () => {
    await openTable();
    expect(rowOrder()).toEqual(["Zoe", "Adrita", "Mark"]);
    expect(screen.getByText("Needs attention first")).toBeInTheDocument();
  });

  test("Alphabetical reorders the table and is reported above it", async () => {
    await openTable();
    openPanel();
    choose("Alphabetical");

    expect(rowOrder()).toEqual(["Adrita", "Mark", "Zoe"]);
    // The panel's own label plus the caption over the table: two, where before
    // the switch there was only the panel's.
    expect(screen.getAllByText("Alphabetical").length).toBe(2);
  });

  test("the choice survives a reload of the page", async () => {
    const view = await openTable();
    openPanel();
    choose("Alphabetical");
    view.unmount();

    await openTable();
    expect(rowOrder()).toEqual(["Adrita", "Mark", "Zoe"]);
  });

  test("an account sent without canSignIn is treated as needing attention", async () => {
    listAccounts.mockResolvedValue([
      ACCOUNTS[0],
      { key: "n", firstName: "Nora", lastName: "Ash", email: "nora@x.com", role: "User" },
    ]);
    await openTable();
    // Alphabetically Nora follows Mark; needing attention puts her first.
    const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows[0]).toMatch(/Nora/);
    expect(rows[1]).toMatch(/Mark/);
  });
});

describe("auto-refresh", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const tick = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

  test("is off by default: the table is read once and stays read", async () => {
    await openTable();
    expect(listAccounts).toHaveBeenCalledTimes(1);
    await tick(300_000);
    expect(listAccounts).toHaveBeenCalledTimes(1);
  });

  test("30s re-reads the database on the timer", async () => {
    await openTable();
    openPanel();
    choose("30s");
    expect(listAccounts).toHaveBeenCalledTimes(1);

    await tick(30_000);
    expect(listAccounts).toHaveBeenCalledTimes(2);
    await tick(30_000);
    expect(listAccounts).toHaveBeenCalledTimes(3);
  });

  test("a timed re-read leaves the table on screen rather than blanking it", async () => {
    await openTable();
    openPanel();
    choose("30s");
    fireEvent.click(screen.getByRole("button", { name: /Done/i }));

    await tick(30_000);
    expect(screen.queryByText(/Loading accounts/i)).not.toBeInTheDocument();
    expect(rowOrder()).toEqual(["Zoe", "Adrita", "Mark"]);
  });

  test("switching back to Off stops the timer", async () => {
    await openTable();
    openPanel();
    choose("30s");
    await tick(30_000);
    expect(listAccounts).toHaveBeenCalledTimes(2);

    choose("Off");
    await tick(300_000);
    expect(listAccounts).toHaveBeenCalledTimes(2);
  });

  test("the interval survives a reload of the page", async () => {
    const view = await openTable();
    openPanel();
    choose("2 min");
    view.unmount();
    jest.clearAllMocks();
    listAccounts.mockResolvedValue(ACCOUNTS);

    await openTable();
    await tick(120_000);
    expect(listAccounts).toHaveBeenCalledTimes(2);
  });

  test("the page reports when it last read the database", async () => {
    await openTable();
    expect(screen.getByText(/auto-refresh off/i)).toBeInTheDocument();
    openPanel();
    choose("30s");
    expect(screen.getByText(/auto-refresh every 30s/i)).toBeInTheDocument();
  });
});

describe("the Refresh button", () => {
  test("re-reads the database on demand", async () => {
    await openTable();
    expect(listAccounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    });
    expect(listAccounts).toHaveBeenCalledTimes(2);
  });
});

/**
 * The theme reaches this page from the shared module, so what is checked here is
 * the wiring rather than the clock arithmetic -- theme.test.js owns that. What
 * matters is that the wrapper this page paints with actually follows it.
 */
describe("theme", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const isDark = () => !!document.querySelector(".dark");
  const clockTo = (hour) =>
    act(async () => {
      jest.setSystemTime(new Date(2026, 0, 15, hour, 0, 0));
      jest.advanceTimersByTime(60_000);
    });

  /** The top bar's copy of the control, which is not inside the panel. */
  const topBar = () => screen.getByRole("banner");

  test("Auto is the default and paints the page dark in the evening", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    expect(isDark()).toBe(true);
    openPanel();
    expect(within(panel()).getByRole("radio", { name: "Auto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("the top bar carries the same three choices and changes the theme", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    expect(isDark()).toBe(true);

    fireEvent.click(within(topBar()).getByRole("radio", { name: "Light" }));
    expect(isDark()).toBe(false);
    await clockTo(23);
    expect(isDark()).toBe(false);

    fireEvent.click(within(topBar()).getByRole("radio", { name: "Auto" }));
    expect(isDark()).toBe(true);
  });

  test("the two controls always agree about what is selected", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    fireEvent.click(within(topBar()).getByRole("radio", { name: "Light" }));
    openPanel();
    expect(within(panel()).getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    choose("Auto");
    expect(within(topBar()).getByRole("radio", { name: "Auto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a light/dark left by the old two-way toggle lands on Auto", async () => {
    // The migration, from this page's point of view: a browser carrying the old
    // value opens in the evening and is dark, without anyone touching a control.
    localStorage.setItem("testrunner.theme", "light");
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    expect(isDark()).toBe(true);
  });

  test("the page turns dark at 19:00 with nobody touching it", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 18, 59, 0));
    await openTable();
    expect(isDark()).toBe(false);

    await clockTo(19);
    expect(isDark()).toBe(true);
  });

  test("choosing Light beats the clock and keeps beating it", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    openPanel();
    choose("Light");

    expect(isDark()).toBe(false);
    await clockTo(23);
    expect(isDark()).toBe(false);
  });

  test("the hint reads back what Auto currently means", async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));
    await openTable();
    openPanel();
    expect(screen.getByText(/dark from 19:00 to 07:00/i)).toHaveTextContent(
      /right now it is dark/i,
    );
  });
});

/**
 * Paging, and the one thing it must not do: move you.
 *
 * The table is read while acting on it -- change a role, set a password, come
 * back -- so a page index that resets itself on a timer would silently undo
 * where the administrator was looking. Everything else here is arithmetic on
 * the slice, which is worth pinning down because an off-by-one shows up as a
 * row that can be reached from no page at all.
 */
describe("pagination", () => {
  /** Twelve accounts, named so that alphabetical order is P01…P12. */
  const MANY = Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      key: "k" + n,
      firstName: "P" + n,
      lastName: "X",
      email: "p" + n + "@x.com",
      role: "User",
      canSignIn: true,
    };
  });

  /** The account names on screen, in the order rendered. */
  const namesOnPage = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => (r.textContent.match(/P\d\d/) || [])[0])
      .filter(Boolean);

  const bar = () => screen.getByRole("navigation", { name: /pagination/i });
  const press = (name) => fireEvent.click(within(bar()).getByRole("button", { name }));

  beforeEach(() => listAccounts.mockResolvedValue(MANY));

  test("shows the first ten of twelve, and says which ten", async () => {
    await openTable();
    expect(namesOnPage()).toEqual(["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10"]);
    expect(bar()).toHaveTextContent("1–10 of 12");
    expect(bar()).toHaveTextContent("Page 1 of 2");
    expect(within(bar()).getByRole("button", { name: /prev/i })).toBeDisabled();
  });

  test("Next reaches the last two and nothing beyond them", async () => {
    await openTable();
    press(/next/i);

    expect(namesOnPage()).toEqual(["P11", "P12"]);
    expect(bar()).toHaveTextContent("11–12 of 12");
    expect(bar()).toHaveTextContent("Page 2 of 2");
    expect(within(bar()).getByRole("button", { name: /next/i })).toBeDisabled();
  });

  test("Prev comes back to the first page", async () => {
    await openTable();
    press(/next/i);
    press(/prev/i);
    expect(namesOnPage()[0]).toBe("P01");
    expect(bar()).toHaveTextContent("Page 1 of 2");
  });

  test("every account is reachable from some page — no row falls between them", async () => {
    await openTable();
    const seen = [...namesOnPage()];
    press(/next/i);
    seen.push(...namesOnPage());
    expect(seen).toEqual(MANY.map((a) => a.firstName));
    expect(new Set(seen).size).toBe(MANY.length);
  });

  test("a larger page size shows everything and returns to page 1", async () => {
    await openTable();
    press(/next/i);
    fireEvent.change(within(bar()).getByRole("combobox"), { target: { value: "25" } });

    expect(namesOnPage()).toHaveLength(12);
    expect(bar()).toHaveTextContent("1–12 of 12");
    expect(bar()).toHaveTextContent("Page 1 of 1");
  });

  test("the page size is remembered for the next visit", async () => {
    const view = await openTable();
    fireEvent.change(within(bar()).getByRole("combobox"), { target: { value: "50" } });
    view.unmount();

    await openTable();
    expect(within(bar()).getByRole("combobox")).toHaveValue("50");
    expect(namesOnPage()).toHaveLength(12);
  });

  test("a search pages the accounts it matched, from the first page", async () => {
    await openTable();
    press(/next/i);
    fireEvent.change(screen.getByPlaceholderText(/search name/i), { target: { value: "p1" } });

    // P10, P11 and P12 contain "p1"; P01 does not -- neither "P01 X" nor
    // "p01@x.com" has that substring. Three matches, one page.
    expect(namesOnPage()).toEqual(["P10", "P11", "P12"]);
    expect(bar()).toHaveTextContent("1–3 of 3");
    expect(bar()).toHaveTextContent("Page 1 of 1");
  });

  test("a search that matches nothing reports zero rather than a page of none", async () => {
    await openTable();
    fireEvent.change(screen.getByPlaceholderText(/search name/i), { target: { value: "nobody" } });
    expect(bar()).toHaveTextContent("0 of 0");
    expect(screen.getByText(/no account matches that search/i)).toBeInTheDocument();
  });

  test("an auto-refresh does not move the administrator off page 2", async () => {
    jest.useFakeTimers();
    try {
      await openTable();
      openPanel();
      choose("30s");
      fireEvent.click(screen.getByRole("button", { name: /^Done$/ }));
      press(/next/i);
      expect(namesOnPage()).toEqual(["P11", "P12"]);

      await act(async () => { jest.advanceTimersByTime(30_000); });

      expect(listAccounts).toHaveBeenCalledTimes(2);
      expect(namesOnPage()).toEqual(["P11", "P12"]);
      expect(bar()).toHaveTextContent("Page 2 of 2");
    } finally {
      jest.useRealTimers();
    }
  });

  test("the last page emptying by a shrunken list clamps instead of showing nothing", async () => {
    jest.useFakeTimers();
    try {
      await openTable();
      openPanel();
      choose("30s");
      fireEvent.click(screen.getByRole("button", { name: /^Done$/ }));
      press(/next/i);
      expect(bar()).toHaveTextContent("Page 2 of 2");

      // Another administrator deletes the accounts page 2 was showing.
      listAccounts.mockResolvedValue(MANY.slice(0, 10));
      await act(async () => { jest.advanceTimersByTime(30_000); });

      expect(bar()).toHaveTextContent("Page 1 of 1");
      expect(namesOnPage()).toHaveLength(10);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("the signed-in administrator", () => {
  test("their email is on the page, not only inside the account menu", async () => {
    listAccounts.mockResolvedValue([
      ...ACCOUNTS,
      {
        key: "self",
        firstName: "Test",
        lastName: "Person",
        email: "person@practice.com",
        role: "Super Admin",
        canSignIn: true,
      },
    ]);
    await openTable();
    expect(screen.getByText(/signed in as/i)).toHaveTextContent("person@practice.com");
  });

  test("it falls back to the session while the table is still loading", async () => {
    // The record is the better answer, but it arrives after the first paint and
    // the header must not be blank until then.
    let release;
    listAccounts.mockImplementation(() => new Promise((r) => { release = r; }));
    render(
      <MemoryRouter initialEntries={["/SuperAdmin"]}>
        <AuthProvider>
          <SuperAdmin />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/signed in as/i)).toHaveTextContent("person@practice.com");
    await act(async () => { release([]); });
  });
});

/**
 * The left rail.
 *
 * Two things are worth pinning down beyond "clicking it filters": that the
 * counts describe the database rather than the current search -- otherwise the
 * rail stops being a map of what exists the moment you type -- and that a
 * filter composes with the search, the sort and the pages instead of replacing
 * them.
 */
describe("the left rail", () => {
  const MIXED = [
    { key: "a", firstName: "Ada", lastName: "L", email: "ada@x.com", role: "User", canSignIn: true },
    { key: "b", firstName: "Bea", lastName: "M", email: "bea@x.com", role: "User", canSignIn: false },
    { key: "c", firstName: "Cal", lastName: "N", email: "cal@x.com", role: "User", canSignIn: true },
    { key: "d", firstName: "Dot", lastName: "O", email: "dot@x.com", role: "Super Admin", canSignIn: true },
    // Stored folded, the way an older record can be: it must still count as a
    // Super Admin, the same way the sign-in gate reads it.
    { key: "e", firstName: "Eve", lastName: "P", email: "eve@x.com", role: "super admin", canSignIn: true },
  ];

  const rail = () => screen.getByRole("navigation", { name: /filter accounts/i });
  const entry = (name) => within(rail()).getByRole("button", { name: new RegExp(name, "i") });
  const missing = (name) =>
    within(rail()).queryByRole("button", { name: new RegExp(name, "i") });
  const names = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => (r.textContent.match(/Ada|Bea|Cal|Dot|Eve/) || [])[0])
      .filter(Boolean);

  beforeEach(() => listAccounts.mockResolvedValue(MIXED));

  test("offers the roles it filters on plus the two state views, and counts them", async () => {
    await openTable();
    expect(entry("All accounts")).toHaveTextContent("5");
    expect(entry("Needs attention")).toHaveTextContent("1");
    expect(entry("^Super Admin")).toHaveTextContent("2"); // includes "super admin"
    expect(entry("^Admin")).toHaveTextContent("3");
  });

  // Doctor and Receptionist are no longer roles at all — they were dropped from
  // ALL_ROLES — so the rail cannot offer a view for either. Kept as a test
  // rather than deleted with them: it is the check that the rail is built from
  // that list rather than from a second one written out by hand.
  test("leaves out the roles it does not filter on", async () => {
    await openTable();
    expect(missing("^Doctor")).toBeNull();
    expect(missing("^Receptionist")).toBeNull();
  });

  test("All accounts is where it starts, and is marked as current", async () => {
    await openTable();
    expect(entry("All accounts")).toHaveAttribute("aria-current", "true");
    expect(names()).toHaveLength(5);
  });

  test("a role narrows the table to that role", async () => {
    await openTable();
    fireEvent.click(entry("^Admin"));

    // Needs-attention-first, so Bea leads the two who can sign in.
    expect(names()).toEqual(["Bea", "Ada", "Cal"]);
    expect(entry("^Admin")).toHaveAttribute("aria-current", "true");
    expect(entry("All accounts")).not.toHaveAttribute("aria-current");
  });

  test("Needs attention shows only the account that cannot sign in", async () => {
    await openTable();
    fireEvent.click(entry("Needs attention"));
    expect(names()).toEqual(["Bea"]);
  });

  test("the counts describe the database, not the search", async () => {
    await openTable();
    fireEvent.change(screen.getByPlaceholderText(/search name/i), { target: { value: "ada" } });

    expect(names()).toEqual(["Ada"]);
    // The rail is still a map of what exists.
    expect(entry("All accounts")).toHaveTextContent("5");
    expect(entry("^Admin")).toHaveTextContent("3");
  });

  test("a filter and a search compose rather than replace each other", async () => {
    await openTable();
    fireEvent.click(entry("^Admin"));
    fireEvent.change(screen.getByPlaceholderText(/search name/i), { target: { value: "cal" } });
    expect(names()).toEqual(["Cal"]);

    // Cal is an Admin, so a search for him inside Super Admin finds nobody.
    fireEvent.click(entry("^Super Admin"));
    expect(names()).toEqual([]);
    expect(screen.getByText(/no account matches that search in Super Admin/i)).toBeInTheDocument();
  });

  test("an empty filter says which view is empty, not that the search failed", async () => {
    listAccounts.mockResolvedValue(MIXED.filter((a) => a.role !== "User"));
    await openTable();
    fireEvent.click(entry("^Admin"));
    expect(screen.getByText(/no account in Admin\./i)).toBeInTheDocument();
  });

  test("the active filter is named above the table", async () => {
    await openTable();
    fireEvent.click(entry("^Admin"));
    expect(screen.getByText(/3 of 5 accounts/)).toHaveTextContent("User");
  });

  test("changing the filter returns to the first page", async () => {
    listAccounts.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        key: "k" + i,
        firstName: "P" + String(i + 1).padStart(2, "0"),
        lastName: "X",
        email: "p" + i + "@x.com",
        role: "User",
        canSignIn: true,
      })),
    );
    await openTable();
    const bar = () => screen.getByRole("navigation", { name: /pagination/i });
    fireEvent.click(within(bar()).getByRole("button", { name: /next/i }));
    expect(bar()).toHaveTextContent("Page 2 of 2");

    fireEvent.click(entry("^Admin"));
    expect(bar()).toHaveTextContent("Page 1 of 2");
  });

  test("the sort preference still applies inside a filter", async () => {
    listAccounts.mockResolvedValue([
      { key: "z", firstName: "Zed", lastName: "A", email: "z@x.com", role: "User", canSignIn: false },
      { key: "a", firstName: "Ann", lastName: "B", email: "a@x.com", role: "User", canSignIn: true },
    ]);
    await openTable();
    fireEvent.click(entry("^Admin"));
    // Default order is needs-attention-first, so Zed leads despite the alphabet.
    expect(screen.getAllByRole("row").slice(1)[0].textContent).toMatch(/Zed/);

    openPanel();
    choose("Alphabetical");
    expect(screen.getAllByRole("row").slice(1)[0].textContent).toMatch(/Ann/);
  });
});
