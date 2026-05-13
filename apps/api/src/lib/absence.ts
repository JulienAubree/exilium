// Threshold in milliseconds above which we consider that the user was "away".
// Used by auth (to snapshot users.previous_login_at) and by the absence
// summary endpoint (to decide whether to show the modal on return).
// 30 min is short enough to catch sleep-laptop returns but long enough to
// ignore tab refreshes and brief logout/login round-trips.
export const ABSENCE_THRESHOLD_MS = 30 * 60 * 1000;
