import React from "react";

/**
 * Healer — a self-healing error boundary.
 *
 * When any child component throws during render/lifecycle, React would
 * normally unmount the whole tree and leave a blank white screen. Healer
 * catches that crash and *auto-fixes* the UI:
 *
 *   1. It logs the error (and calls an optional onHeal callback).
 *   2. It automatically remounts the children a few times, with a short
 *      backoff, since many crashes are transient (a race, a stale prop,
 *      a momentarily-missing piece of data).
 *   3. If the auto-retries are exhausted, it shows a friendly recovery
 *      card with manual options (Try again / Reload / Go home) instead
 *      of a dead page.
 *
 * Usage:  <Healer><App /></Healer>
 */
class Healer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      // Bumping this key forces React to throw the old (broken) subtree
      // away and mount a completely fresh copy of the children.
      renderKey: 0,
      // How many times we've automatically tried to recover.
      autoAttempts: 0,
      // Whether an auto-heal timer is currently counting down.
      healing: false,
    };
    this._healTimer = null;
  }

  static getDerivedStateFromError(error) {
    // Flip into the error state so we render the fallback instead of the
    // crashed subtree on the next render.
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const maxAuto = this.props.maxAutoAttempts ?? 3;

    // Log for diagnostics — replace with your telemetry sink if you have one.
    // eslint-disable-next-line no-console
    console.error("[Healer] Caught a UI crash:", error, info?.componentStack);

    if (typeof this.props.onHeal === "function") {
      try {
        this.props.onHeal(error, info);
      } catch (_) {
        /* never let the healer itself crash */
      }
    }

    // Auto-fix: schedule a remount if we still have attempts left.
    if (this.state.autoAttempts < maxAuto) {
      this.scheduleHeal();
    }
  }

  scheduleHeal = () => {
    const baseDelay = this.props.retryDelayMs ?? 1200;
    // Simple linear backoff: 1st retry after ~1.2s, then 2.4s, then 3.6s.
    const delay = baseDelay * (this.state.autoAttempts + 1);

    this.setState({ healing: true });

    this._healTimer = setTimeout(() => {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        healing: false,
        renderKey: prev.renderKey + 1,
        autoAttempts: prev.autoAttempts + 1,
      }));
    }, delay);
  };

  // Manual "Try again" — resets the attempt counter so the user gets a
  // fresh set of auto-heals if it crashes again.
  handleManualRetry = () => {
    if (this._healTimer) clearTimeout(this._healTimer);
    this.setState((prev) => ({
      hasError: false,
      error: null,
      healing: false,
      renderKey: prev.renderKey + 1,
      autoAttempts: 0,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Hard navigation avoids depending on a router being mounted.
    window.location.assign("/HomePage");
  };

  componentWillUnmount() {
    if (this._healTimer) clearTimeout(this._healTimer);
  }

  render() {
    const { hasError, healing, autoAttempts, renderKey, error } = this.state;
    const maxAuto = this.props.maxAutoAttempts ?? 3;

    if (!hasError) {
      // Healthy path. The key ensures a clean remount after each heal.
      return (
        <React.Fragment key={renderKey}>{this.props.children}</React.Fragment>
      );
    }

    const stillHealing = healing && autoAttempts < maxAuto;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(160deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)",
          fontFamily: "'Outfit', sans-serif",
          padding: 24,
        }}
      >
        <style>{`
          @keyframes healerSpin { to { transform: rotate(360deg); } }
          @keyframes healerFade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        <div
          style={{
            width: 420,
            maxWidth: "92vw",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
            animation: "healerFade 0.4s ease both",
          }}
        >
          {stillHealing ? (
            <>
              <div
                style={{
                  width: 46,
                  height: 46,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  border: "3px solid rgba(124,58,237,0.25)",
                  borderTopColor: "#10b981",
                  animation: "healerSpin 0.8s linear infinite",
                }}
              />
              <div
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Recovering…
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                Something hiccupped. Auto-repairing the page
                {maxAuto > 0 ? ` (attempt ${autoAttempts + 1} of ${maxAuto})` : ""}.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🩹</div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                We hit a snag
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 14,
                  marginBottom: 24,
                  lineHeight: 1.5,
                }}
              >
                We tried to fix it automatically but the page keeps having
                trouble. You can try again or reload.
              </div>

              {process.env.NODE_ENV !== "production" && error && (
                <pre
                  style={{
                    textAlign: "left",
                    fontSize: 11,
                    color: "#fca5a5",
                    background: "rgba(0,0,0,0.35)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 20,
                    maxHeight: 140,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {String(error?.stack || error)}
                </pre>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={this.handleManualRetry}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 20px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#fff",
                    background:
                      "linear-gradient(135deg, #7C3AED 0%, #C026D3 50%, #10b981 100%)",
                  }}
                >
                  Try again
                </button>
                <button
                  onClick={this.handleReload}
                  style={{
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "11px 20px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#e2e8f0",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  Reload
                </button>
                <button
                  onClick={this.handleGoHome}
                  style={{
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "11px 20px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#e2e8f0",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  Go home
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export default Healer;
