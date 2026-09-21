/**
 * The session token: stored, sent, and thrown away when refused.
 *
 * The token is the only thing that makes the role on a request mean anything --
 * without it /api/admin answers 401 and with a stale one it answers 401 too, so
 * a browser that quietly stops attaching it does not look broken, it looks
 * logged out. That failure mode is why these are checked rather than assumed.
 */
import axios from "axios";
import { clearToken, getToken, installAuthInterceptors, setToken, TOKEN_KEY } from "./authToken";

/** Runs a request through the interceptors without a network, returning the config. */
const captureRequest = async (instance) => {
  let seen = null;
  // An adapter is the documented seam for this: the interceptors have already
  // run by the time it is called, so the config it receives is what would have
  // gone on the wire.
  instance.defaults.adapter = async (config) => {
    seen = config;
    return { status: 200, data: {}, headers: {}, config };
  };
  await instance.get("/api/admin/accounts");
  return seen;
};

/** Makes the next request fail with one status, the way the server would. */
const failWith = (instance, status) => {
  instance.defaults.adapter = async (config) => {
    const err = new Error(`Request failed with status code ${status}`);
    err.response = { status, data: { error: "nope" }, headers: {}, config };
    err.config = config;
    throw err;
  };
};

let instance;
let uninstall;
let unauthorized;

beforeEach(() => {
  localStorage.clear();
  instance = axios.create();
  unauthorized = jest.fn();
  uninstall = installAuthInterceptors(instance, unauthorized);
});

afterEach(() => uninstall());

describe("storage", () => {
  test("a token round-trips and can be cleared", () => {
    expect(getToken()).toBeNull();
    setToken("abc.def");
    expect(getToken()).toBe("abc.def");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc.def");
    clearToken();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("setToken with nothing clears rather than storing a falsy value", () => {
    setToken("abc.def");
    setToken(null);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    setToken("abc.def");
    setToken("");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("sending it", () => {
  test("the token is attached to every request", async () => {
    setToken("abc.def");
    const config = await captureRequest(instance);
    expect(config.headers.Authorization).toBe("Bearer abc.def");
  });

  test("no token means no header, rather than an empty one", async () => {
    const config = await captureRequest(instance);
    expect(config.headers.Authorization).toBeUndefined();
  });

  test("a token stored after installation is still picked up", async () => {
    // Read per request, not captured at install time — the interceptors are
    // installed at startup, long before anybody signs in.
    let config = await captureRequest(instance);
    expect(config.headers.Authorization).toBeUndefined();
    setToken("later.token");
    config = await captureRequest(instance);
    expect(config.headers.Authorization).toBe("Bearer later.token");
  });

  test("existing headers on the request survive", async () => {
    setToken("abc.def");
    instance.defaults.headers.common["bypass-tunnel-reminder"] = "true";
    const config = await captureRequest(instance);
    expect(config.headers.Authorization).toBe("Bearer abc.def");
    expect(config.headers["bypass-tunnel-reminder"]).toBe("true");
  });
});

describe("being refused", () => {
  test("a 401 clears the token and reports the session is over", async () => {
    setToken("stale.token");
    failWith(instance, 401);
    await expect(instance.get("/api/admin/accounts")).rejects.toThrow();
    expect(getToken()).toBeNull();
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  test("a 403 keeps the session — wrong person, not expired", async () => {
    // Signing out here would turn "you may not do this" into an unexplained
    // sign-out, and signing back in would change nothing.
    setToken("good.token");
    failWith(instance, 403);
    await expect(instance.get("/api/admin/accounts")).rejects.toThrow();
    expect(getToken()).toBe("good.token");
    expect(unauthorized).not.toHaveBeenCalled();
  });

  test("other failures leave the session alone", async () => {
    setToken("good.token");
    for (const status of [400, 404, 413, 500, 501]) {
      failWith(instance, status);
      await expect(instance.get("/api/admin/accounts")).rejects.toThrow();
    }
    expect(getToken()).toBe("good.token");
    expect(unauthorized).not.toHaveBeenCalled();
  });

  test("a network failure with no response does not sign anybody out", async () => {
    setToken("good.token");
    instance.defaults.adapter = async () => {
      throw new Error("Network Error");
    };
    await expect(instance.get("/api/admin/accounts")).rejects.toThrow("Network Error");
    expect(getToken()).toBe("good.token");
    expect(unauthorized).not.toHaveBeenCalled();
  });

  test("the error is rethrown, so the calling screen can still report it", async () => {
    // Swallowing it here would leave a spinner running forever.
    setToken("stale.token");
    failWith(instance, 401);
    await expect(instance.get("/api/admin/accounts")).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});
