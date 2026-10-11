/* Bump when the admin API gains/changes routes. The server reports it on /api/health and the
 * admin panel compares it, so a server that was not restarted after an update is detected and
 * explained ("restart npm run server") instead of showing mysterious 404 errors. */
export const ADMIN_API_VERSION = 3;
