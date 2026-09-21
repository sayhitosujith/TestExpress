/**
 * The sign-in flow, end to end on the client side.
 *
 * Exists because the bug it pins down was invisible to every other check: the
 * session was written straight to localStorage, so AuthRoute (which reads the
 * key) let the user through while the context (which every other consumer
 * reads) still held null. Both halves are asserted here -- the stored keys and
 * the value useAuth() reports -- because agreeing with each other is the point.
 */
import React from "react";
// Imported here rather than from a setupTests.js: this project has none, and
// adding one would change the environment of every existing suite.
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { login as authenticate } from "./api/auth";

jest.mock("./api/auth", () => ({ login: jest.fn() }));

/** Reports what useAuth() holds, so the context can be asserted from outside App. */
function Probe() {
  const { user } = useAuth();
  return <div data-testid="probe">{user ? `${user.role}:${user.email}` : "nobody"}</div>;
}

// What /api/auth/login answers with now: the user AND the session token every
// protected endpoint requires. Before the token existed a sign-in returned only
// the user, and the API believed whatever the browser claimed afterwards.
const proven = (user) => ({ user, token: "session-token", expiresAt: "2099-01-01T00:00:00.000Z" });

const SUPER_ADMIN = {
  email: "boss@practice.com",
  firstName: "Ada",
  lastName: "Byron",
  role: "Super Admin",
};

/**
 * @param from the location AuthRoute would have stashed when it turned the
 *   visitor away, or undefined for a plain visit to the login page.
 */
const renderLogin = (from) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/my-app", state: from ? { from } : undefined }]}>
      <AuthProvider>
        <Probe />
        <Routes>
          <Route path="/my-app" element={<App />} />
          <Route path="/SuperAdmin" element={<div>super admin screen</div>} />
          <Route path="/TestRunner" element={<div>test runner screen</div>} />
          <Route path="/Profile" element={<div>profile screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

const typeCredentials = (email, password) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
};

// Wrapped in act because the click starts an async request whose resolution
// updates state after the event handler has returned -- outside act, React
// warns about every one of those updates and the real assertions get buried.
const clickLogin = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /login|signing in/i }));
  });

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("a successful sign-in updates the context, not just localStorage", async () => {
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin();

  expect(screen.getByTestId("probe")).toHaveTextContent("nobody");

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() =>
    expect(screen.getByTestId("probe")).toHaveTextContent("Super Admin:boss@practice.com"),
  );
  expect(localStorage.getItem("isLoggedIn")).toBe("true");
  expect(JSON.parse(localStorage.getItem("user")).role).toBe("Super Admin");
});

test("Enter in the password field submits the form", async () => {
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin();

  typeCredentials("boss@practice.com", "correct horse");
  // Submitting the form itself, which is what Enter in a field does — the
  // click test above covers the button.
  await act(async () => {
    fireEvent.submit(screen.getByLabelText("Password").closest("form"));
  });

  await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
  expect(authenticate).toHaveBeenCalledWith("boss@practice.com", "correct horse");
});

test("the button is disabled in flight, so it cannot be double-submitted", async () => {
  let release;
  authenticate.mockReturnValue(new Promise((resolve) => (release = resolve)));
  renderLogin();

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled());

  await clickLogin();
  expect(authenticate).toHaveBeenCalledTimes(1);

  await act(async () => {
    release(proven(SUPER_ADMIN));
  });
});

test("an interrupted destination is resumed when the role can open it", async () => {
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin({ pathname: "/SuperAdmin", search: "" });

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText("super admin screen")).toBeInTheDocument();
});

test("an interrupted destination the role cannot open falls back to the landing page", async () => {
  authenticate.mockResolvedValue(proven({ ...SUPER_ADMIN, role: "Receptionist" }));
  renderLogin({ pathname: "/SuperAdmin", search: "" });

  typeCredentials("desk@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText("test runner screen")).toBeInTheDocument();
});

test("a Super Admin with nothing interrupted lands on the Super Admin page", async () => {
  // Not the runner. A Super Admin signs in to administer accounts, so sending
  // them to the runner first made every sign-in a page they had to leave.
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin();

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText("super admin screen")).toBeInTheDocument();
});

test.each(["Admin", "Doctor", "Receptionist", "CUSTOMER"])(
  "a %s with nothing interrupted still lands on the runner",
  async (role) => {
    authenticate.mockResolvedValue(proven({ ...SUPER_ADMIN, role }));
    renderLogin();

    typeCredentials("desk@practice.com", "correct horse");
    await clickLogin();

    await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("test runner screen")).toBeInTheDocument();
  },
);

test("a Super Admin who was going somewhere else still gets taken there", async () => {
  // The interrupted destination is the one thing the person actually asked for,
  // so it outranks the role's home page.
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin({ pathname: "/Profile", search: "" });

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText("profile screen")).toBeInTheDocument();
});

test("a rejected password is shown against the password field", async () => {
  const rejected = new Error("Invalid credentials");
  rejected.credentials = true;
  authenticate.mockRejectedValue(rejected);
  renderLogin();

  typeCredentials("boss@practice.com", "wrong");
  await clickLogin();

  await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  // Beside the field, not in the banner above the form.
  expect(screen.getByText("Invalid credentials").closest("div")).toContainElement(
    screen.getByLabelText("Password"),
  );
  expect(localStorage.getItem("isLoggedIn")).toBeNull();
  expect(screen.getByTestId("probe")).toHaveTextContent("nobody");
  expect(screen.getByRole("button", { name: /login/i })).not.toBeDisabled();
});

test("a server failure is shown in the banner, not as a password error", async () => {
  authenticate.mockRejectedValue(new Error("Cannot reach the server"));
  renderLogin();

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(screen.getByText("Cannot reach the server")).toBeInTheDocument());
  expect(screen.getByText("Cannot reach the server").closest("div")).not.toContainElement(
    screen.getByLabelText("Password"),
  );
});

test("no request is made until both fields are filled", async () => {
  renderLogin();
  await clickLogin();
  expect(authenticate).not.toHaveBeenCalled();
  expect(screen.getByText("Email is required")).toBeInTheDocument();
  expect(screen.getByText("Password is required")).toBeInTheDocument();
});

describe("Remember my email", () => {
  test("a ticked box stores the address and prefills it next time", async () => {
    authenticate.mockResolvedValue(proven(SUPER_ADMIN));
    const first = renderLogin();

    typeCredentials("boss@practice.com", "correct horse");
    fireEvent.click(screen.getByLabelText(/remember my email/i));
    await clickLogin();

    await waitFor(() => expect(localStorage.getItem("rememberedEmail")).toBe("boss@practice.com"));
    first.unmount();

    renderLogin();
    expect(screen.getByLabelText("Email")).toHaveValue("boss@practice.com");
    expect(screen.getByLabelText(/remember my email/i)).toBeChecked();
    // The password is never remembered.
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  test("an unticked box clears an address remembered earlier", async () => {
    localStorage.setItem("rememberedEmail", "boss@practice.com");
    authenticate.mockResolvedValue(proven(SUPER_ADMIN));
    renderLogin();

    fireEvent.click(screen.getByLabelText(/remember my email/i));
    typeCredentials("boss@practice.com", "correct horse");
    await clickLogin();

    await waitFor(() => expect(localStorage.getItem("rememberedEmail")).toBeNull());
  });
});

test("a successful sign-in stores the session token", async () => {
  // Without this the app looks signed in and every protected endpoint answers
  // 401 — the failure mode that looks like a broken server rather than a
  // missing credential.
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));
  renderLogin();

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();

  await waitFor(() => expect(localStorage.getItem("authToken")).toBe("session-token"));
});

test("a refused sign-in stores no token", async () => {
  const rejected = new Error("Invalid credentials");
  rejected.credentials = true;
  authenticate.mockRejectedValue(rejected);
  renderLogin();

  typeCredentials("boss@practice.com", "wrong");
  await clickLogin();

  await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  expect(localStorage.getItem("authToken")).toBeNull();
});

test("signing out destroys the token, not just the session object", async () => {
  // The token is the half that can still do things, so it must not outlive the
  // sign-out. Driven through the context rather than a screen's menu: every
  // sign-out in the app goes through this one function.
  authenticate.mockResolvedValue(proven(SUPER_ADMIN));

  let auth;
  function Capture() {
    auth = useAuth();
    return null;
  }
  render(
    <MemoryRouter initialEntries={["/my-app"]}>
      <AuthProvider>
        <Capture />
        <Routes>
          <Route path="/my-app" element={<App />} />
          <Route path="/TestRunner" element={<div>test runner screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

  typeCredentials("boss@practice.com", "correct horse");
  await clickLogin();
  await waitFor(() => expect(localStorage.getItem("authToken")).toBe("session-token"));

  await act(async () => {
    auth.logout();
  });
  expect(localStorage.getItem("authToken")).toBeNull();
  expect(localStorage.getItem("isLoggedIn")).toBeNull();
  expect(localStorage.getItem("user")).toBeNull();
});
