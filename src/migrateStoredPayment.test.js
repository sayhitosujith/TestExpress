// The payment rename runs on every boot against whatever a real browser happens
// to be holding, and it runs BEFORE dbSync pushes that browser's records at the
// database. So its edge cases are the whole point: it must never overwrite a
// choice somebody has made, never touch a field that is not this one, and never
// rewrite a value it could not parse.
import { migrateStoredPayment } from "./migrateStoredPayment";
import { PAYMENT_OPTIONS } from "./constants";

const KEY = "registeredUsers";
const read = () => JSON.parse(localStorage.getItem(KEY));
const DEFAULT_PAYMENT = PAYMENT_OPTIONS[0].value;

describe("migrateStoredPayment", () => {
  beforeEach(() => localStorage.clear());

  it("renames practice to payment and leaves every other field alone", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "1", email: "a@b.c", practice: "HerveyBay", role: "Admin", passwordHash: "$2b$12$x" },
      ]),
    );
    expect(migrateStoredPayment()).toBe(1);
    expect(read()).toEqual([
      { id: "1", email: "a@b.c", payment: DEFAULT_PAYMENT, role: "Admin", passwordHash: "$2b$12$x" },
    ]);
  });

  it("replaces a value that is not on the payment list", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "1", practice: "Brisbane" }]));
    migrateStoredPayment();
    expect(read()[0].payment).toBe(DEFAULT_PAYMENT);
    expect(read()[0].practice).toBeUndefined();
  });

  it("keeps a practice value that happens to be a valid payment", () => {
    const valid = PAYMENT_OPTIONS[PAYMENT_OPTIONS.length - 1].value;
    localStorage.setItem(KEY, JSON.stringify([{ id: "1", practice: valid }]));
    migrateStoredPayment();
    expect(read()[0].payment).toBe(valid);
  });

  it("never overwrites a payment someone has already chosen", () => {
    const chosen = PAYMENT_OPTIONS[PAYMENT_OPTIONS.length - 1].value;
    localStorage.setItem(KEY, JSON.stringify([{ id: "1", payment: chosen }]));
    expect(migrateStoredPayment()).toBe(0);
    expect(read()[0].payment).toBe(chosen);
  });

  it("repairs a payment field holding an unknown value", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "1", payment: "HerveyBay" }]));
    expect(migrateStoredPayment()).toBe(1);
    expect(read()[0].payment).toBe(DEFAULT_PAYMENT);
  });

  it("is a no-op on the second run", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "1", practice: "HerveyBay" }]));
    expect(migrateStoredPayment()).toBe(1);
    expect(migrateStoredPayment()).toBe(0);
  });

  it("leaves an unparseable value exactly as it is", () => {
    localStorage.setItem(KEY, "not json");
    expect(migrateStoredPayment()).toBe(0);
    expect(localStorage.getItem(KEY)).toBe("not json");
  });

  it("does nothing when there is nothing stored", () => {
    expect(migrateStoredPayment()).toBe(0);
  });
});
