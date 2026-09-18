import {
  ALL_ROLES,
  assignableRoles,
  canVisit,
  landingAfterLogin,
  landingFor,
  roleAllowed,
  DEFAULT_LANDING,
} from "./routeAccess";

describe("canVisit", () => {
  test("an unguarded path is open to any role", () => {
    expect(canVisit("/HomePage", "Receptionist")).toBe(true);
    expect(canVisit("/TestRunner", "CUSTOMER")).toBe(true);
  });

  test("a guarded path admits only its roles", () => {
    expect(canVisit("/SuperAdmin", "Super Admin")).toBe(true);
    expect(canVisit("/SuperAdmin", "User")).toBe(false);
    expect(canVisit("/SuperAdmin", undefined)).toBe(false);
  });
});

describe("roleAllowed", () => {
  test("an exact role matches", () => {
    expect(roleAllowed(["Super Admin"], "Super Admin")).toBe(true);
  });

  test("case and stray spacing do not lock the right role out", () => {
    expect(roleAllowed(["Super Admin"], "super admin")).toBe(true);
    expect(roleAllowed(["Super Admin"], "SUPER ADMIN")).toBe(true);
    expect(roleAllowed(["Super Admin"], " Super Admin ")).toBe(true);
  });

  test("a missing or empty role matches nothing", () => {
    expect(roleAllowed(["Super Admin"], undefined)).toBe(false);
    expect(roleAllowed(["Super Admin"], null)).toBe(false);
    expect(roleAllowed(["Super Admin"], "")).toBe(false);
    expect(roleAllowed(["Super Admin"], "   ")).toBe(false);
  });

  test("a role that merely resembles an allowed one does not match", () => {
    for (const near of ["SuperAdmin", "Super Admins", "super-admin", "User"]) {
      expect(roleAllowed(["Super Admin"], near)).toBe(false);
    }
  });

  test("no allow-list admits nobody", () => {
    expect(roleAllowed(undefined, "Super Admin")).toBe(false);
    expect(roleAllowed([], "Super Admin")).toBe(false);
  });
});

describe("landingAfterLogin", () => {
  test("no interrupted destination lands on the default", () => {
    expect(landingAfterLogin(null, "User")).toBe(DEFAULT_LANDING);
    expect(landingAfterLogin(undefined, "User")).toBe(DEFAULT_LANDING);
    expect(landingAfterLogin({}, "User")).toBe(DEFAULT_LANDING);
  });

  test("an interrupted destination is resumed, query string and all", () => {
    expect(landingAfterLogin({ pathname: "/Profile" }, "Doctor")).toBe("/Profile");
    expect(landingAfterLogin({ pathname: "/Profile", search: "?tab=2" }, "Doctor")).toBe(
      "/Profile?tab=2",
    );
    expect(landingAfterLogin("/Profile", "Doctor")).toBe("/Profile");
  });

  test("a destination the role cannot open falls back instead of bouncing", () => {
    expect(landingAfterLogin({ pathname: "/SuperAdmin" }, "Super Admin")).toBe("/SuperAdmin");
    expect(landingAfterLogin({ pathname: "/SuperAdmin" }, "Receptionist")).toBe(DEFAULT_LANDING);
  });

  test("the login page is never the destination", () => {
    expect(landingAfterLogin({ pathname: "/my-app" }, "User")).toBe(DEFAULT_LANDING);
    expect(landingAfterLogin({ pathname: "/" }, "User")).toBe(DEFAULT_LANDING);
  });

  test("anything that is not a local path is refused", () => {
    expect(landingAfterLogin({ pathname: "//evil.example.com" }, "User")).toBe(DEFAULT_LANDING);
    expect(landingAfterLogin({ pathname: "https://evil.example.com" }, "User")).toBe(
      DEFAULT_LANDING,
    );
    expect(landingAfterLogin({ pathname: 42 }, "User")).toBe(DEFAULT_LANDING);
  });
});

describe("assignableRoles", () => {
  test("a Super Admin may assign every role", () => {
    expect(assignableRoles("Super Admin")).toEqual(ALL_ROLES);
  });

  test("nobody else may assign Super Admin — a public form included", () => {
    for (const byRole of ["User", "Doctor", "Receptionist", "CUSTOMER", "", null, undefined]) {
      expect(assignableRoles(byRole)).not.toContain("Super Admin");
    }
  });

  test("the roles that are not privileged stay on offer to everyone", () => {
    // User is the whole of that list now: Doctor and Receptionist were removed
    // from ALL_ROLES, having granted nothing a User did not already have.
    expect(assignableRoles(undefined)).toEqual(["User"]);
  });

  test("every role offered to a visitor is one they could not use to reach /SuperAdmin", () => {
    // The two rules stated separately in code, checked against each other: an
    // offered role that opens the guarded page would make the gate pointless.
    for (const role of assignableRoles(undefined)) {
      expect(canVisit("/SuperAdmin", role)).toBe(false);
    }
  });
});

describe("landingFor", () => {
  test("a Super Admin lands on the page they signed in to use", () => {
    expect(landingFor("Super Admin")).toBe("/SuperAdmin");
  });

  test("case and stray spacing do not send a Super Admin to the wrong home", () => {
    for (const spelling of ["super admin", "SUPER ADMIN", " Super Admin "]) {
      expect(landingFor(spelling)).toBe("/SuperAdmin");
    }
  });

  test("every other role lands on the main screen", () => {
    for (const role of ["User", "Doctor", "Receptionist", "CUSTOMER", "", null, undefined]) {
      expect(landingFor(role)).toBe(DEFAULT_LANDING);
    }
  });

  test("a role that merely resembles Super Admin does not get its home", () => {
    for (const near of ["SuperAdmin", "Super Admins", "super-admin", "Super"]) {
      expect(landingFor(near)).toBe(DEFAULT_LANDING);
    }
  });

  test("a role may only be sent somewhere it can actually get in", () => {
    // Otherwise the sign-in would land on a page that refuses the very role it
    // just chose the destination for.
    for (const role of ["Super Admin", "User", "Doctor", "Receptionist", "CUSTOMER"]) {
      expect(canVisit(landingFor(role), role)).toBe(true);
    }
  });
});

describe("landingAfterLogin, with the role's home as the fallback", () => {
  test("a Super Admin with nothing interrupted goes to /SuperAdmin", () => {
    expect(landingAfterLogin(null, "Super Admin")).toBe("/SuperAdmin");
    expect(landingAfterLogin({}, "Super Admin")).toBe("/SuperAdmin");
  });

  test("the login page is still never the destination", () => {
    expect(landingAfterLogin({ pathname: "/my-app" }, "Super Admin")).toBe("/SuperAdmin");
    expect(landingAfterLogin({ pathname: "/" }, "Super Admin")).toBe("/SuperAdmin");
  });

  test("a refused path falls back to the role's home, not the shared default", () => {
    expect(landingAfterLogin({ pathname: "//evil.example.com" }, "Super Admin")).toBe("/SuperAdmin");
    expect(landingAfterLogin({ pathname: 42 }, "Super Admin")).toBe("/SuperAdmin");
  });

  test("an interrupted destination outranks the role's home", () => {
    expect(landingAfterLogin({ pathname: "/Profile" }, "Super Admin")).toBe("/Profile");
    expect(landingAfterLogin({ pathname: "/Profile", search: "?tab=2" }, "Super Admin")).toBe(
      "/Profile?tab=2",
    );
  });

  test("a non-Super-Admin sent at /SuperAdmin lands on the runner, as before", () => {
    expect(landingAfterLogin({ pathname: "/SuperAdmin" }, "Receptionist")).toBe(DEFAULT_LANDING);
  });
});
