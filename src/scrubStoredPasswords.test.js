// The plaintext scrub is a one-way migration that runs on every boot against
// whatever a real browser happens to be holding, so its edge cases are the whole
// point: it must never destroy a record it could not read, and must never touch
// anything but the password field.
import { scrubStoredPasswords } from "./scrubStoredPasswords";

const KEY = "registeredUsers";
const read = () => JSON.parse(localStorage.getItem(KEY));

describe("scrubStoredPasswords", () => {
  beforeEach(() => localStorage.clear());

  it("removes password and leaves every other field alone", () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: "1", email: "a@b.c", password: "hunter2", role: "Super Admin", passwordHash: "$2b$12$x" },
    ]));
    expect(scrubStoredPasswords()).toBe(1);
    expect(read()).toEqual([
      { id: "1", email: "a@b.c", role: "Super Admin", passwordHash: "$2b$12$x" },
    ]);
  });

  it("reports how many it cleaned and is a no-op the second time", () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: "1", password: "a" },
      { id: "2", password: "b" },
      { id: "3" },
    ]));
    expect(scrubStoredPasswords()).toBe(2);
    // The signal that the migration is finished.
    expect(scrubStoredPasswords()).toBe(0);
    expect(read()).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
  });

  it("leaves an unparseable value exactly as it is", () => {
    // Rewriting what it cannot read could destroy a record someone might still
    // recover by hand.
    localStorage.setItem(KEY, "{not json");
    expect(scrubStoredPasswords()).toBe(0);
    expect(localStorage.getItem(KEY)).toBe("{not json");
  });

  it("does nothing when the key is missing, empty or not an array", () => {
    expect(scrubStoredPasswords()).toBe(0);
    localStorage.setItem(KEY, JSON.stringify({ nope: true }));
    expect(scrubStoredPasswords()).toBe(0);
    expect(read()).toEqual({ nope: true });
  });

  it("survives nulls and non-objects in the list", () => {
    localStorage.setItem(KEY, JSON.stringify([null, "x", { password: "p" }]));
    expect(scrubStoredPasswords()).toBe(1);
    expect(read()).toEqual([null, "x", {}]);
  });
});
