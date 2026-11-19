/** Shared by proxy.ts (no database access) and src/server/auth.ts. */
export const SESSION_COOKIE_NAME = "hc360_admin";

/** Set by proxy.ts on admin requests: the path being opened, used for the sign-in return link. */
export const REQUEST_PATH_HEADER = "x-hc360-path";
