/**
 * Ticket lifecycle transition rules.
 *
 * Centralized enforcement of the canonical lifecycle from spec §12.
 * The explicit transition table is defined in DECISIONS.md D-006.
 *
 * CLOSED is terminal — no transitions out.
 * ASSIGNED is mandatory before IN_PROGRESS.
 * Only the ticket's requester (USER role) can reopen from RESOLVED.
 */

const ALLOWED_TRANSITIONS = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_FOR_USER", "RESOLVED"],
  WAITING_FOR_USER: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS"],
  CLOSED: [], // terminal
};

/**
 * Determine whether a status transition is allowed.
 *
 * @param {string} from - Current status
 * @param {string} to - Requested new status
 * @param {string} role - Actor's role (USER, AGENT, ADMIN)
 * @param {object} [options] - Additional context
 * @param {string} [options.requesterId] - Ticket requester's user ID
 * @param {string} [options.actorId] - Acting user's ID
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canTransition(from, to, role, options = {}) {
  if (from === to) {
    return { allowed: true };
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { allowed: false, reason: `Unknown current status: ${from}` };
  }

  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transition from ${from} to ${to} is not allowed`,
    };
  }

  // USER can only reopen their own RESOLVED tickets
  if (from === "RESOLVED" && to === "REOPENED" && role === "USER") {
    if (options.requesterId && options.actorId && options.requesterId !== options.actorId) {
      return {
        allowed: false,
        reason: "Users can only reopen their own tickets",
      };
    }
  }

  // USER cannot perform most agent/admin transitions
  if (role === "USER") {
    // USER can only reopen from RESOLVED
    if (!(from === "RESOLVED" && to === "REOPENED")) {
      return {
        allowed: false,
        reason: "Users cannot perform this status transition",
      };
    }
  }

  return { allowed: true };
}

/**
 * Get all allowed transitions from a given status.
 *
 * @param {string} status
 * @returns {string[]}
 */
export function getAllowedTransitions(status) {
  return ALLOWED_TRANSITIONS[status] || [];
}

/**
 * Check if a status is terminal (no further transitions).
 *
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminal(status) {
  if (!(status in ALLOWED_TRANSITIONS)) return false;
  return ALLOWED_TRANSITIONS[status].length === 0;
}
