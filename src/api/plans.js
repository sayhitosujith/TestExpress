import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const PLANS = `${API_BASE}/api/plans`;

// The plan catalogue, and the record of accounts moving between plans.
//
// The catalogue is the one thing in this app that is read before anyone has
// signed in — the registration form's plan select — so the GET is open and the
// server answers it even with no database configured. Everything that writes,
// and the history, need a Super Admin session.

/**
 * Every plan, in tier order, with where the answer came from.
 *
 * `source` is worth carrying rather than dropping: "database" and "file" look
 * identical in a select, and only one of them means an edit here would stick.
 *
 * @returns {Promise<{plans: object[], source: 'database'|'seed'|'file'}>}
 */
export async function getPlans() {
  try {
    const { data } = await axios.get(PLANS);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load the plan catalogue"));
  }
}

/**
 * Replaces the catalogue with `plans`, in the order given.
 *
 * The whole list, because the order is meaning: a plan includes every earlier
 * tier's capabilities, so moving one is an edit to the catalogue rather than to
 * either plan.
 *
 * @param {object[]} plans [{ value, label, blurb, adds }] in tier order.
 * @returns {Promise<{plans: object[], saved: number, deleted: number}>}
 */
export async function savePlans(plans) {
  try {
    const { data } = await axios.put(PLANS, { plans });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not save the plan catalogue"));
  }
}

/**
 * Who moved between plans, newest first.
 *
 * @param {{limit?: number, accountKey?: string}} [options]
 * @returns {Promise<object[]>} changes, each with accountEmail, fromPlan,
 *   toPlan, changedBy and at.
 */
export async function getPlanChanges({ limit, accountKey } = {}) {
  try {
    const { data } = await axios.get(`${PLANS}/changes`, {
      params: { limit, accountKey },
    });
    return data.changes;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load the plan history"));
  }
}
