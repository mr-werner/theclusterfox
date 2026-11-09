// Which copy wins when a signed-in app first meets its account copy.
// Whole-document, newest-edit-wins: the simplest rule that never mixes two
// devices' settings into something neither person made.

/**
 * local:  { updatedAt, userId }  what this browser last stamped
 * remote: { doc, updatedAt } | null
 * Returns "pull" (take the account copy), "push" (send this device's copy)
 * or "reset" (start this account fresh: the device holds someone else's).
 */
export function firstSyncAction(local, remote, userId) {
  const otherAccount = Boolean(local.userId) && local.userId !== userId;
  if (!remote?.doc) return otherAccount ? "reset" : "push";
  // This device was last synced with another account: that data stays
  // with that account, and this one's own copy loads.
  if (otherAccount) return "pull";
  const mine = Date.parse(local.updatedAt ?? "") || 0;
  const theirs = Date.parse(remote.updatedAt ?? "") || 0;
  return theirs > mine ? "pull" : "push";
}
