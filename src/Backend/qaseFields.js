// Qase's classification fields, as labels plus the integers its REST API wants.
//
// Two callers need this and they cannot share a copy: storyToCases.js puts the
// labels in the JSON schema it hands Claude, and qaseClient.js converts those
// labels to the integers /v1/case/{code}/bulk expects. One map, so a label the
// generator can emit is by construction a label the pusher can send.
//
// CAVEAT on the integers: Qase's OpenAPI definition types these fields as bare
// `integer` and documents no enum, so the mappings below come from Qase's field
// documentation rather than from the API reference. If a pushed case lands in
// Qase with the wrong severity or priority, the fix is a value in this file and
// nothing else. `type`, `layer` and `status` are deliberately absent — their
// integer maps could not be confirmed, so pushed cases take Qase's own
// defaults instead of a guess.

const SEVERITY = {
  undefined: 0,
  blocker: 1,
  critical: 2,
  major: 3,
  normal: 4,
  minor: 5,
  trivial: 6,
};

const PRIORITY = {
  undefined: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Which side of the requirement a case exercises. Worth generating explicitly:
// it is the axis an AI-written suite most often skews on, and seeing "8
// positive, 1 negative" on screen is how you catch that before it reaches Qase.
const BEHAVIOR = {
  undefined: 0,
  positive: 1,
  negative: 2,
  destructive: 3,
};

/** Label lists for the generation schema — the order shown in the UI too. */
const SEVERITY_LABELS = Object.keys(SEVERITY);
const PRIORITY_LABELS = Object.keys(PRIORITY);
const BEHAVIOR_LABELS = Object.keys(BEHAVIOR);

/**
 * Maps a label to its Qase integer, or undefined when the label is unknown.
 * Returning undefined rather than 0 matters: an omitted field takes Qase's
 * default, whereas 0 asserts "undefined" and overwrites that default.
 */
const toInt = (map, label) =>
  typeof label === 'string' && Object.hasOwn(map, label.toLowerCase())
    ? map[label.toLowerCase()]
    : undefined;

module.exports = {
  SEVERITY,
  PRIORITY,
  BEHAVIOR,
  SEVERITY_LABELS,
  PRIORITY_LABELS,
  BEHAVIOR_LABELS,
  severityInt: (label) => toInt(SEVERITY, label),
  priorityInt: (label) => toInt(PRIORITY, label),
  behaviorInt: (label) => toInt(BEHAVIOR, label),
};
