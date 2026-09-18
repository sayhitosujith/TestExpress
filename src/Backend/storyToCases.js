// Turns a user story into structured test cases with Claude.
//
// Separate from qaseClient.js on purpose: this module knows what a good test
// case looks like and nothing about Qase's wire format, so the generated shape
// can also feed the CSV export and the local TestRunner store without either of
// them going through Qase.

const Anthropic = require('@anthropic-ai/sdk');
const {
  SEVERITY_LABELS,
  PRIORITY_LABELS,
  BEHAVIOR_LABELS,
} = require('./qaseFields');

const MODEL = 'claude-opus-5';

// Generous but bounded. A story yielding more than ~25 cases is a story that
// should have been split, and an unbounded batch is how a single click turns
// into a 300-case suite nobody reviews.
const MAX_CASES = 25;

/** Whether a key is present. Checked before the call so an unconfigured install can say so. */
const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

// The response contract. `output_config.format` makes the model answer with
// JSON that validates against this, which is why nothing downstream needs to
// parse prose or repair half-written JSON.
const SCHEMA = {
  type: 'object',
  properties: {
    coverageNotes: {
      type: 'string',
      description:
        'What the story does not say, and what a tester would have to ask before these cases are trustworthy. Empty string if nothing is missing.',
    },
    cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'One specific outcome, stated as a fact. "Booking rejected when slot already taken", not "Test booking".',
          },
          description: { type: 'string' },
          preconditions: {
            type: 'string',
            description: 'State the system must be in before step 1. Empty string if none.',
          },
          postconditions: { type: 'string' },
          severity: { type: 'string', enum: SEVERITY_LABELS },
          priority: { type: 'string', enum: PRIORITY_LABELS },
          behavior: { type: 'string', enum: BEHAVIOR_LABELS },
          tags: { type: 'array', items: { type: 'string' } },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', description: 'One action, imperative mood.' },
                expected_result: {
                  type: 'string',
                  description: 'What is observable after this action. Empty string when the step only sets up.',
                },
                data: { type: 'string', description: 'Concrete input values for this step. Empty string if none.' },
              },
              required: ['action', 'expected_result', 'data'],
              additionalProperties: false,
            },
          },
        },
        required: [
          'title',
          'description',
          'preconditions',
          'postconditions',
          'severity',
          'priority',
          'behavior',
          'tags',
          'steps',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['coverageNotes', 'cases'],
  additionalProperties: false,
};

const SYSTEM = `You write test cases for a QA team that stores them in Qase.

Write cases a tester who has never seen this feature could execute without asking a question. Every step names the action and what is observable after it; every case asserts one outcome.

Cover, in this order of priority:
- the happy path implied by the acceptance criteria
- each acceptance criterion that can fail on its own
- negative cases: rejected input, absent permission, absent data
- boundary cases: first, last, zero, one-over-the-limit, empty
- state-dependent flows: the same action attempted twice, or out of order

Rules:
- Never invent a UI element, field name, endpoint, or business rule the story does not mention. Where the story is silent, write the case against the behaviour it does state and record the gap in coverageNotes.
- Do not restate the story as a case. A case that cannot fail is not a case.
- Set behavior to "negative" for cases that assert a rejection or an error, "destructive" for ones that remove or corrupt data, "positive" otherwise.
- Set severity by blast radius if the case fails, and priority by how often the path is taken.
- Tag each case with the lowercase feature area, one word where possible.
- coverageNotes is where under-specification goes. Non-functional requirements, concurrency, and domain rules the story assumes are the usual omissions. Do not pad it with cases you already wrote.`;

/** The prompt body. Kept separate so the shape of what Claude reads is reviewable. */
function buildPrompt({ title, story, acceptanceCriteria, context, count }) {
  const parts = [`# User story: ${title}`, '', story.trim()];

  if (acceptanceCriteria && acceptanceCriteria.trim()) {
    parts.push('', '# Acceptance criteria', acceptanceCriteria.trim());
  }
  if (context && context.trim()) {
    // Conventions, an example case to copy the house style from, anything the
    // story assumes the reader knows.
    parts.push('', '# Project context', context.trim());
  }
  parts.push(
    '',
    count
      ? `Write about ${count} cases — fewer if the story genuinely does not support that many.`
      : 'Write as many cases as the story supports and no more.',
  );
  return parts.join('\n');
}

/**
 * Generates cases for one story.
 *
 * Resolves to { cases, coverageNotes, usage }. Rejects with the SDK's own error
 * so the route can map a 401 to "check the key" and a 429 to "retry", rather
 * than turning every failure into the same 502.
 */
async function generateCases({ title, story, acceptanceCriteria, context, count }) {
  if (!isConfigured()) throw new Error('ANTHROPIC_API_KEY is not set');
  if (!title || !story) throw new Error('title and story are both required');

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    // Adaptive thinking, at the effort a correctness-sensitive task deserves.
    // The cost of a shallow pass here is a suite that looks complete and is not.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt({ title, story, acceptanceCriteria, context, count }) }],
  });

  // A safety decline arrives as HTTP 200 with this stop_reason, so reading
  // content without checking would surface it as "0 cases generated".
  if (response.stop_reason === 'refusal') {
    throw new Error(
      `Claude declined this request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : '.'}`,
    );
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text block');

  const data = JSON.parse(text);
  const cases = Array.isArray(data.cases) ? data.cases.slice(0, MAX_CASES) : [];

  return {
    cases,
    coverageNotes: data.coverageNotes || '',
    // Surfaced so the cost of a click is visible rather than inferred.
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    },
    truncated: Array.isArray(data.cases) && data.cases.length > MAX_CASES,
  };
}

module.exports = { isConfigured, generateCases, MODEL, MAX_CASES };
