/**
 * `pnpm start` entry point. Boots the HTTP server on PORT (default 3705)
 * for manual smoke-testing and for the validator's runtime-walk mode.
 *
 * The conformance script (`pnpm conformance`) invokes the server in-process
 * via `startServer()`; this script is the standalone launcher.
 */
import { startServer } from '../src/app/server.js';

const PORT = Number(process.env['PORT'] ?? 3705);

const { baseUrl } = await startServer(PORT);
// eslint-disable-next-line no-console
console.log(`[act-saas-workspace] listening on ${baseUrl}`);
// eslint-disable-next-line no-console
console.log(`[act-saas-workspace] try: curl -i ${baseUrl}/.well-known/act.json`);
// eslint-disable-next-line no-console
console.log(`[act-saas-workspace] auth: -H "Authorization: Bearer bearer-token-A"`);
