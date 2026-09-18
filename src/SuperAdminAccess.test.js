/**
 * Who gets past the Super Admin page's own sign-in.
 *
 * The requirement is one sentence -- only a Super Admin gets in -- and the page
 * is now the thing enforcing it, so the page is what is exercised here: the real
 * gate, the real role table, the real form, one session at a time.
 *
 * The two failures worth pinning down both look like success from the outside.
 * A gate that admits the wrong role still shows the right screens to the right
 * people, and a form that opens a session before checking the role leaves
 * someone authenticated in front of a page that will not show them anything.
 */
import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SuperAdmin from "./SuperAdmin";
import { AuthProvider } from "./context/AuthContext";
import { login as authenticate } from "./api/auth";
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

/** Signs someone in the way App.js does — the same keys, before render. */
const signIn = (role) => {
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("authToken", "session-token");
  localStorage.setItem(
    "user",
    JSON.stringify({ name: "Test Person", email: "person@practice.com", role }),
  );
};

const openPage = () =>
  render(
    <MemoryRouter initialEntries={["/SuperAdmin"]}>
      <AuthProvider>
        <SuperAdmin />
      </AuthProvider>
    </MemoryRouter>,
  );

/** Which of the two things the page can be is on screen. */
const shown = () => {
  if (screen.queryByRole("button", { name: /^sign in$|signing in/i })) return "the sign-in form";
  if (screen.queryByRole("table")) return "the account table";
  return "neither";
};

/** Waits for the gate to open, then lets the table finish loading. */
const expectTable = async () => {
  await waitFor(() => expect(shown()).toBe("the account table"));
  // AccountsAdmin fetches on mount; without this its setState lands after the
  // test has finished and React reports an update outside act().
  await act(async () => {});
};

const fillAndSubmit = (email, password) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  return act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  });
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  listAccounts.mockResolvedValue([]);
});

describe("what the page shows", () => {
  test("an established Super Admin sees the account table", async () => {
    signIn("Super Admin");
    openPage();
    await expectTable();
  });

  test("a visitor with no session is asked to sign in, not redirected", async () => {
    // The point of the change: a route guard could only send them elsewhere.
    openPage();
    expect(shown()).toBe("the sign-in form");
  });

  test.each(["Admin", "Doctor", "Receptionist", "CUSTOMER", "", null, undefined])(
    "the role %p is asked to sign in as somebody else",
    (role) => {
      signIn(role);
      openPage();
      expect(shown()).toBe("the sign-in form");
    },
  );

  test("a signed-in wrong role is told so, rather than shown a bare form", () => {
    // A login form in front of someone who believes they are signed in reads as
    // a lost session, not as the wrong account.
    signIn("Receptionist");
    openPage();
    expect(screen.getByText(/cannot open this page/i)).toBeInTheDocument();
    expect(screen.getByText("person@practice.com")).toBeInTheDocument();
  });

  test("the locked page never calls the admin API", async () => {
    // Mounting the table while locked would fire a request certain to be
    // refused, and a 401 is what the axios interceptor treats as an expired
    // session — so it would sign the visitor out of wherever they were.
    signIn("Doctor");
    openPage();
    await act(async () => {});
    expect(listAccounts).not.toHaveBeenCalled();
  });

  test("a role stored in a different case still gets in", async () => {
    for (const spelling of ["super admin", "SUPER ADMIN", " Super Admin "]) {
      localStorage.clear();
      signIn(spelling);
      const view = openPage();
      await expectTable();
      view.unmount();
    }
  });

  test("a role that merely resembles the allowed one does not get in", () => {
    for (const near of ["Super Admins", "SuperAdmin", "Super", "Admin Super", "super-admin"]) {
      localStorage.clear();
      signIn(near);
      const view = openPage();
      expect(shown()).toBe("the sign-in form");
      view.unmount();
    }
  });
});

describe("signing in on the page", () => {
  test("correct Super Admin credentials reveal the table without navigating", async () => {
    authenticate.mockResolvedValue({
      user: { email: "boss@practice.com", role: "Super Admin" },
      token: "fresh-token",
    });
    openPage();
    expect(shown()).toBe("the sign-in form");

    await fillAndSubmit("boss@practice.com", "correct horse");

    await expectTable();
    expect(localStorage.getItem("authToken")).toBe("fresh-token");
  });

  test("a wrong password is refused and opens no session", async () => {
    const rejected = new Error("Invalid credentials");
    rejected.credentials = true;
    authenticate.mockRejectedValue(rejected);
    openPage();

    await fillAndSubmit("boss@practice.com", "wrong");

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(shown()).toBe("the sign-in form");
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("isLoggedIn")).toBeNull();
  });

  test("a correct password for the wrong role is refused, and NO session is opened", async () => {
    // The important one. Signing them in and then refusing them would leave a
    // state with no name: authenticated, on a page with nothing to show them.
    authenticate.mockResolvedValue({
      user: { email: "desk@practice.com", role: "Receptionist" },
      token: "should-not-be-stored",
    });
    openPage();

    await fillAndSubmit("desk@practice.com", "correct horse");

    expect(shown()).toBe("the sign-in form");
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("isLoggedIn")).toBeNull();
  });

  test("the wrong role is told which role it has, not that its password was wrong", async () => {
    // Telling someone their correct password was wrong sends them to reset a
    // password that was never the problem.
    authenticate.mockResolvedValue({
      user: { email: "desk@practice.com", role: "Receptionist" },
      token: "t",
    });
    openPage();

    await fillAndSubmit("desk@practice.com", "correct horse");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Receptionist/);
    expect(alert).toHaveTextContent(/Super Admin/);
    expect(alert).not.toHaveTextContent(/invalid/i);
  });

  test("an account with no role at all is refused", async () => {
    authenticate.mockResolvedValue({ user: { email: "nobody@practice.com" }, token: "t" });
    openPage();

    await fillAndSubmit("nobody@practice.com", "correct horse");

    expect(shown()).toBe("the sign-in form");
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  test("no request is made until both fields are filled", async () => {
    openPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("the button is disabled in flight, so it cannot be double-submitted", async () => {
    let release;
    authenticate.mockReturnValue(new Promise((resolve) => (release = resolve)));
    openPage();

    await fillAndSubmit("boss@practice.com", "correct horse");
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /signing in/i }));
    });
    expect(authenticate).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ user: { email: "boss@practice.com", role: "Super Admin" }, token: "t" });
    });
  });

  test("a server fault is reported as itself", async () => {
    authenticate.mockRejectedValue(new Error("Cannot reach the server"));
    openPage();

    await fillAndSubmit("boss@practice.com", "correct horse");

    expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the server");
    expect(shown()).toBe("the sign-in form");
  });

  test("signing out from the wrong-account notice clears the session", async () => {
    signIn("Receptionist");
    openPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    });

    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("isLoggedIn")).toBeNull();
    expect(shown()).toBe("the sign-in form");
    expect(screen.queryByText(/cannot open this page/i)).not.toBeInTheDocument();
  });
});
