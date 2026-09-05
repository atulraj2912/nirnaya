const ACCESS_TOKEN_NAME = "nirnaya_access_token";
const REFRESH_TOKEN_NAME = "nirnaya_refresh_token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Set the access token cookie on a NextResponse.
 *
 * @param {import("next/server").NextResponse} response
 * @param {string} token
 * @returns {import("next/server").NextResponse}
 */
export function setAccessTokenCookie(response, token) {
  response.cookies.set(ACCESS_TOKEN_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  return response;
}

/**
 * Set the refresh token cookie on a NextResponse.
 *
 * @param {import("next/server").NextResponse} response
 * @param {string} token
 * @returns {import("next/server").NextResponse}
 */
export function setRefreshTokenCookie(response, token) {
  response.cookies.set(REFRESH_TOKEN_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  return response;
}

/**
 * Clear both auth cookies on a NextResponse (logout).
 *
 * @param {import("next/server").NextResponse} response
 * @returns {import("next/server").NextResponse}
 */
export function clearAuthCookies(response) {
  response.cookies.set(ACCESS_TOKEN_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

/**
 * Read the access token from request cookies.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {string|undefined}
 */
export function getAccessTokenFromRequest(request) {
  return request.cookies.get(ACCESS_TOKEN_NAME)?.value;
}

/**
 * Read the refresh token from request cookies.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {string|undefined}
 */
export function getRefreshTokenFromRequest(request) {
  return request.cookies.get(REFRESH_TOKEN_NAME)?.value;
}

export { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME };
