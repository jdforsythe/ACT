/**
 * PRD-705-R3 — `defineActMount` wiring.
 *
 * Single mount at root (`basePath: ''`); the SDK installs the canonical
 * App Router file layout per PRD-705-R3 / PRD-501-R3:
 *
 *   app/
 *   ├── .well-known/act.json/route.ts   # GET = handlers.manifest
 *   ├── act/
 *   │   ├── index.json/route.ts         # GET = handlers.index
 *   │   ├── n/[...id]/route.ts          # GET = handlers.node
 *   │   └── sub/[...id]/route.ts        # GET = handlers.subtree
 *   ├── act-mount.ts                    # this file
 *   └── middleware.ts                   # actLinkHeaderMiddleware
 *
 * The example bridges the App Router-style mount to a plain Node HTTP
 * server in `scripts/serve.ts` (the SDK is framework-agnostic at the
 * Request/Response boundary per PRD-501-R5/R10). Real Next.js deployments
 * substitute the route.ts files; the wiring below is identical.
 */
import { defineActMount } from '@act-spec/runtime-next';

import { identityResolver } from '../lib/act-host/identity.js';
import { tenantResolver } from '../lib/act-host/tenant.js';
import { logger } from '../lib/act-host/logger.js';
import { runtime, MANIFEST } from '../lib/act-runtime/index.js';

export const actMount = defineActMount({
  manifest: MANIFEST,
  runtime,
  identityResolver,
  tenantResolver,
  logger,
  basePath: '', // PRD-705-R3 — root mount.
});
