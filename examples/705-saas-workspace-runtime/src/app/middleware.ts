/**
 * PRD-705-R13 — discovery hand-off Link header for non-ACT routes.
 *
 * The predicate is a fast cookie-presence check, NOT a full session
 * validation (PRD-501-R17 risk row). A real Next.js deployment exports
 * this as the `middleware` symbol; the example reuses the same pre-bound
 * middleware in the Node HTTP server (scripts/serve.ts).
 */
import { actLinkHeaderMiddleware } from '@act-spec/runtime-next';

export const linkHeader = actLinkHeaderMiddleware({
  isAuthenticated: (req) => {
    // Fast cookie-presence check; the production Next.js host would use
    // `req.cookies.has("session")`. Under raw WHATWG `Request` we sniff
    // the Cookie header for the named pair.
    const cookieHeader = req.headers.get('cookie') ?? '';
    return /(?:^|;\s*)session=/.test(cookieHeader);
  },
});

// In Next.js this is the `config` export consumed by the runtime.
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
