// Shared access gate for every paid endpoint.
//
// One copy, not one per endpoint. Several copies of an auth check is several
// places to forget when the rule changes — and the one you forget is the one
// that stays open. See ADR 0003.
//
// Lives under _shared/ so Netlify does not treat it as an endpoint of its
// own: underscore-prefixed directories are not deployed as functions.
import { createHash, timingSafeEqual } from "node:crypto";

// Hash both sides to a fixed 32 bytes, then compare with Node's own
// constant-time primitive.
//
// Two properties come from this that a hand-written character loop does not
// give. The comparison is a built-in designed for the job rather than
// something this file has to get right — a loop that returns early on the
// first differing byte looks almost identical to one that doesn't, and the
// difference is invisible to any test that only checks the answer. And
// because every digest is the same size, the length of the real code never
// affects how long the comparison takes; a bare `if (a.length !== b.length)
// return false` answers that question on the very first call.
//
// What this does not claim: a unit test cannot measure nanoseconds, and this
// file does not pretend to prove timing safety. It relies on a primitive
// built for it, which is the honest version of that claim.
const digest = (s) => createHash("sha256").update(String(s), "utf8").digest();

export function isAuthorized(req) {
  const expected = process.env.LL_ACCESS_CODE;
  // Fail closed. An unset or empty variable must deny everyone rather than
  // admit everyone — the opposite default is how endpoints end up open by
  // accident, and a deploy that simply forgot the variable would publish
  // every paid endpoint to the internet.
  if (!expected) return false;
  const got = req.headers.get("x-ll-access") || "";
  return timingSafeEqual(digest(got), digest(expected));
}

// The single refusal. Identical shape and status from every endpoint, so the
// client has one case to handle — and so a prober cannot tell "wrong code"
// from "no code" by reading the reply.
export function refuse() {
  return Response.json({ error: "not authorized" }, { status: 403 });
}
