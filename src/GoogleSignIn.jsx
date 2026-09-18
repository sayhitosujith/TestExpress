import React, { useCallback, useEffect, useRef, useState } from "react";
import { googleConfig, googleSignIn } from "./api/auth";

/**
 * Sign in with Google.
 *
 * **Google renders the button and Google collects the credentials.** Nothing in
 * this app ever sees the password, and this component never asks for one — it
 * mounts Google's own button, receives a signed ID token, and hands that token
 * to our backend, which verifies the signature against Google's public keys
 * before it believes a word of it (see src/Backend/googleAuth.js).
 *
 * That division is the point. A "Sign in with Google" button that opened our own
 * form would be a phishing page wearing a logo, and a backend that trusted the
 * decoded token without checking its signature would accept a JWT anybody could
 * write.
 *
 * Renders nothing at all when Google sign-in is not configured. Not a disabled
 * button: an unconfigured provider is not a feature this visitor is missing, it
 * is one this installation does not have, and a permanently grey Google button
 * on a public sign-in page reads as broken.
 *
 * @param {{onSignedIn: (user: object, token: string, created: boolean) => void,
 *   onError: (message: string) => void}} props
 */
export default function GoogleSignIn({ onSignedIn, onError }) {
  const [clientId, setClientId] = useState(null); // null = still asking
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const holder = useRef(null);

  // Whether this install offers Google at all. Asked of the backend rather than
  // read from the bundle: the client id lives with the secret it belongs to, and
  // a build-time value would mean rebuilding the app to turn SSO on.
  useEffect(() => {
    let live = true;
    googleConfig()
      .then((c) => live && setClientId(c.configured ? c.clientId : ""))
      .catch(() => live && setClientId(""));
    return () => {
      live = false;
    };
  }, []);

  // Google's script, loaded only once and only when there is a client id to use
  // it with — a sign-in page with no Google configured should not be fetching a
  // third-party script at all.
  useEffect(() => {
    if (!clientId) return undefined;
    if (window.google && window.google.accounts) {
      setReady(true);
      return undefined;
    }
    const src = "https://accounts.google.com/gsi/client";
    const existing = document.querySelector(`script[src="${src}"]`);
    const done = () => setReady(Boolean(window.google && window.google.accounts));
    if (existing) {
      existing.addEventListener("load", done);
      return () => existing.removeEventListener("load", done);
    }
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.defer = true;
    tag.onload = done;
    // A blocked script is not a crash. The password form is still there, which
    // is why this says nothing rather than showing an error nobody can act on.
    tag.onerror = () => setReady(false);
    document.body.appendChild(tag);
    return undefined;
  }, [clientId]);

  const handle = useCallback(
    async (response) => {
      setBusy(true);
      try {
        const { user, token, created } = await googleSignIn(response.credential);
        onSignedIn(user, token, created);
      } catch (err) {
        onError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [onSignedIn, onError],
  );

  // Initialise once the script is up, then let Google draw the button into our
  // container. The callback is registered here rather than globally so it dies
  // with the component.
  useEffect(() => {
    if (!ready || !clientId || !holder.current) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handle,
        // No auto-select and no one-tap prompt: this is a sign-in page with a
        // form on it, and a floating Google prompt appearing over somebody
        // already typing their password is an interruption, not a convenience.
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      holder.current.innerHTML = "";
      window.google.accounts.id.renderButton(holder.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "center",
        width: 300,
      });
    } catch (err) {
      onError("Google sign-in could not be started — " + err.message);
    }
  }, [ready, clientId, handle, onError]);

  // Nothing configured, or the script never arrived: the password form is the
  // whole of the page, as it was before.
  if (!clientId) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div
        ref={holder}
        // Google's button is a fixed width; centring it keeps it aligned with
        // the full-width buttons above and below rather than hugging one edge.
        style={{ display: "flex", justifyContent: "center", minHeight: 44 }}
      />
      {!ready && (
        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", margin: "6px 0 0" }}>
          Loading Google sign-in…
        </p>
      )}
      {busy && (
        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", margin: "6px 0 0" }}>
          Signing you in…
        </p>
      )}
    </div>
  );
}
