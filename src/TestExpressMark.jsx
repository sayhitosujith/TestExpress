import { useBranding } from "./appBranding";

/**
 * The TestExpress logo mark.
 *
 * Lives in its own module because two very different places need it: the app's
 * own header in TestRunner.jsx, and the public marketing page. A second copy
 * would be the kind that drifts silently — nobody notices the landing page is
 * wearing last year's logo.
 *
 * Drawn rather than imported as an image: it stays sharp at any size, adds no
 * request, and cannot 404. An administrator who uploaded their own logo in
 * Super Admin's settings gets that instead, everywhere the mark is worn --
 * swapping it here rather than at each call site is what makes one upload reach
 * the runner, the landing page and the loading overlay at once.
 *
 * @param {{size?: number}} props size in px, square.
 */
function TestExpressMark({ size = 36 }) {
  const { logo: uploaded, name } = useBranding();

  if (uploaded) {
    return (
      <img
        src={uploaded}
        alt={name}
        width={size}
        height={size}
        // object-contain, not cover: a logo that is not square is letterboxed
        // rather than cropped, because the part a crop would eat is usually the
        // wordmark somebody uploaded it for.
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={name}
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        {/* Unique id per instance would be safer if the gradient ever differed,
            but every mark on a page is identical, so a shared id is correct and
            avoids a defs block per logo. */}
        <linearGradient id="txMark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ff0c4" />
          <stop offset="100%" stopColor="#21b58d" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="#000" />
      <path d="M20 24 H80 V45 H62 V80 H38 V45 H20 Z" fill="url(#txMark)" />
    </svg>
  );
}

export default TestExpressMark;
