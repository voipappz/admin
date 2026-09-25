// A user may enter only routes that explicitly declare an ACL key and that
// key is granted by their session. Account-only routes intentionally have no
// key and therefore fail closed here.
export const canUserEnterRoute = (requiredAcl, canAccess) =>
  Boolean(requiredAcl && canAccess(requiredAcl));
