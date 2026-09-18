// The test runner's two non-array collections round-trip through dbSync.
//
// schedules and test data are the only collections that do not store a plain
// array, so they are the only ones carrying a toRows/toStored pair. Those two
// functions are the whole risk in this change: get them wrong and the sync loop
// writes a mangled shape back over data the recorder is still reading, which is
// worse than not syncing at all.
//
// Tested through COLLECTIONS rather than by importing the adapters directly, so
// this exercises the declarations the engine actually uses.
import { COLLECTIONS } from "./dbSync";
import { SCHEDULES_KEY, TESTDATA_KEY, RECORDED_KEY, PROJECTS_KEY } from "./testrunner/store";

const byKey = (key) => COLLECTIONS.find((c) => c.key === key);

describe("dbSync test runner collections", () => {
  it("registers all four collections and no per-browser preferences", () => {
    const keys = COLLECTIONS.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining([RECORDED_KEY, PROJECTS_KEY, SCHEDULES_KEY, TESTDATA_KEY]));
    // The preference keys must never be syncable.
    ["testrunner.theme", "testrunner.theme.chosen", "testrunner.browser", "testrunner.device", "testrunner.selfHeal", "testrunner.headless"]
      .forEach((pref) => expect(keys).not.toContain(pref));
  });

  it("gives every collection a distinct slug", () => {
    const slugs = COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // Retired on purpose — those tables are not wanted offsite, and re-adding an
  // entry here is all it would take to have them silently recreated on the next
  // backend restart. registrations stays: sign-in reads it out of localStorage.
  // Pushing this key turned whatever localStorage held into registration rows —
  // a record typed into devtools arrived in the database as an account. The
  // server owns registrations now (POST /api/auth/register).
  it("never pushes registrations, only hydrates them", () => {
    const registrations = COLLECTIONS.find((c) => c.key === "registeredUsers");
    expect(registrations.readOnly).toBe(true);
    // Everything else must stay pushable, or the sync silently stops working.
    COLLECTIONS.filter((c) => c.key !== "registeredUsers").forEach((c) =>
      expect(c.readOnly).toBeFalsy(),
    );
  });

  it("no longer mirrors doctors, appointments or patients", () => {
    const keys = COLLECTIONS.map((c) => c.key);
    ["doctors", "appointments", "allProfiles"].forEach((key) =>
      expect(keys).not.toContain(key),
    );
    expect(keys).toContain("registeredUsers");
  });

  describe("schedules", () => {
    const collection = () => byKey(SCHEDULES_KEY);
    const stored = {
      "rec-1": { mode: "interval", minutes: 15, enabled: true, nextRunAt: 1700000000000 },
      "rec-2": { mode: "daily", time: "09:30", enabled: false, nextRunAt: null },
    };

    it("flattens the map into rows carrying their own testId", () => {
      const rows = collection().toRows(stored);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ testId: "rec-1", mode: "interval", minutes: 15, enabled: true, nextRunAt: 1700000000000 });
    });

    it("round-trips back to exactly the stored map", () => {
      const c = collection();
      expect(c.toStored(c.toRows(stored))).toEqual(stored);
    });

    it("survives a missing, empty or wrongly-typed value", () => {
      const c = collection();
      expect(c.toRows(undefined)).toEqual([]);
      expect(c.toRows({})).toEqual([]);
      // An array here would mean the key had been overwritten by something else;
      // reading it as rows would push nonsense to the database.
      expect(c.toRows([1, 2])).toEqual([]);
    });

    it("drops a row with no testId rather than writing it under undefined", () => {
      const c = collection();
      expect(c.toStored([{ mode: "daily" }, { testId: "rec-9", mode: "interval" }])).toEqual({
        "rec-9": { mode: "interval" },
      });
    });
  });

  describe("test data", () => {
    const collection = () => byKey(TESTDATA_KEY);
    const stored = {
      sets: [
        { id: "s1", name: "Staging", vars: [{ key: "email", value: "a@b.c", secret: false }] },
        { id: "s2", name: "Prod", vars: [{ key: "password", value: "hunter2", secret: true }] },
      ],
      activeId: "s2",
    };

    it("turns sets into rows and marks the active one", () => {
      const rows = collection().toRows(stored);
      expect(rows.map((r) => r.id)).toEqual(["s1", "s2"]);
      expect(rows.map((r) => r.active)).toEqual([false, true]);
    });

    it("round-trips back to exactly the stored document", () => {
      const c = collection();
      expect(c.toStored(c.toRows(stored))).toEqual(stored);
    });

    it("keeps secret values intact — they are stored as-is by decision", () => {
      const c = collection();
      const back = c.toStored(c.toRows(stored));
      expect(back.sets[1].vars[0]).toEqual({ key: "password", value: "hunter2", secret: true });
    });

    it("never leaves the active pointer aimed at a set that is gone", () => {
      const c = collection();
      // No row flagged active: fall back to the first set, as loadTestData does.
      expect(c.toStored([{ id: "s1", name: "Staging" }]).activeId).toBe("s1");
      // No sets at all: no pointer.
      expect(c.toStored([]).activeId).toBeNull();
    });

    it("does not leak the active flag into the stored sets", () => {
      const c = collection();
      const back = c.toStored(c.toRows(stored));
      back.sets.forEach((set) => expect(set).not.toHaveProperty("active"));
    });

    it("survives a missing or malformed document", () => {
      const c = collection();
      expect(c.toRows(undefined)).toEqual([]);
      expect(c.toRows({})).toEqual([]);
      expect(c.toRows({ sets: "nope" })).toEqual([]);
      // A set with no id has no record identity and must not be pushed.
      expect(c.toRows({ sets: [{ name: "nameless" }], activeId: null })).toEqual([]);
    });
  });

  // Nothing in the recorder sorts these lists, so the order that comes back from
  // the database is the order the user sees. A pull arrives newest-first, which
  // without the position stamp would shuffle someone's tests on a new machine.
  describe("list order survives the round trip", () => {
    const tests = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];

    it("restores the original order from a reversed pull", () => {
      const c = byKey(RECORDED_KEY);
      const rows = c.toRows(tests);
      // What the database hands back: newest first.
      expect(c.toStored(rows.slice().reverse())).toEqual(tests);
    });

    it("strips the position stamp from what it writes back", () => {
      const c = byKey(RECORDED_KEY);
      c.toStored(c.toRows(tests)).forEach((t) => expect(t).not.toHaveProperty("position"));
    });

    it("keeps the project tree, suites and all, in order", () => {
      const c = byKey(PROJECTS_KEY);
      const projects = [
        { id: "p1", name: "Portal", suites: [{ id: "s1", name: "Smoke" }] },
        { id: "p2", name: "Admin", suites: [] },
      ];
      expect(c.toStored(c.toRows(projects).reverse())).toEqual(projects);
    });

    it("orders data sets too, and keeps the active pointer through the shuffle", () => {
      const c = byKey(TESTDATA_KEY);
      const stored = {
        sets: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
        activeId: "c",
      };
      expect(c.toStored(c.toRows(stored).reverse())).toEqual(stored);
    });

    it("treats a non-array value as empty rather than pushing nonsense", () => {
      expect(byKey(RECORDED_KEY).toRows({ not: "an array" })).toEqual([]);
      expect(byKey(PROJECTS_KEY).toRows(null)).toEqual([]);
    });
  });
});
