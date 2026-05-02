/**
 * Schema bundle loader (PRD-600-R1).
 *
 * Loads the canonical JSON Schemas from `schemas/{NNN}/*.schema.json` at the
 * repo root and compiles each via Ajv 2020-12. The resulting validators are
 * the primary structural-validation surface for `validateManifest`,
 * `validateNode`, etc. (PRD-600-R25).
 *
 * Per PRD-600-R1 and PRD-100-R0, the files in `schemas/` are authoritative;
 * this loader does NOT carry inline copies. ADR-002 records the choice of
 * Ajv 8 (NIH ban — don't hand-roll JSON Schema).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
// ajv 8 default-imports the constructor directly under our ESM resolution.
// The cast is a TypeScript ergonomics aid — the runtime value is correct.
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { ValidateFunction, ErrorObject } from 'ajv';
import type { Ajv as AjvType } from 'ajv';

type Ajv2020Ctor = new (opts?: Record<string, unknown>) => AjvType;
type AddFormats = (ajv: AjvType) => unknown;
const Ajv2020 = Ajv2020Module as unknown as Ajv2020Ctor;
const addFormats = addFormatsModule as unknown as AddFormats;

const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * Anchor: walk upward from this file until we find a directory with a `schemas`
 * sibling. This makes the loader resilient to whether it runs from
 * `packages/validator/src/`, `packages/validator/dist/`, or under vitest.
 */
/** @internal exported for test coverage of the unhappy path */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i += 1) {
    const cand = path.join(dir, 'schemas');
    try {
      if (statSync(cand).isDirectory()) return dir;
    } catch {
      // keep climbing
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate repo root with a 'schemas/' directory starting from ${start}`);
}

export const REPO_ROOT = findRepoRoot(here);
export const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');

/**
 * The five PRD-100 wire-format schemas plus the cross-cutting PRD-103 etag
 * schema, keyed by short logical name.
 *
 * Note: `node` is referenced from `subtree` via its absolute `$id`; we register
 * every schema with Ajv so cross-`$ref` resolution works.
 */
export interface CompiledSchemas {
  manifest: ValidateFunction;
  index: ValidateFunction;
  /** Validates one NDJSON line — equivalent to `index.schema.json#/$defs/IndexEntry`. */
  indexEntry: ValidateFunction;
  node: ValidateFunction;
  subtree: ValidateFunction;
  error: ValidateFunction;
  etag: ValidateFunction;
}

interface RawSchema {
  $id?: string;
  [k: string]: unknown;
}

function readSchema(rel: string): RawSchema {
  const abs = path.join(SCHEMAS_DIR, rel);
  return JSON.parse(readFileSync(abs, 'utf8')) as RawSchema;
}

function readAllSchemas(): RawSchema[] {
  const out: RawSchema[] = [];
  for (const series of readdirSync(SCHEMAS_DIR)) {
    if (!/^\d{3}$/.test(series)) continue;
    const seriesDir = path.join(SCHEMAS_DIR, series);
    for (const file of readdirSync(seriesDir).filter((f) => f.endsWith('.schema.json'))) {
      out.push(JSON.parse(readFileSync(path.join(seriesDir, file), 'utf8')) as RawSchema);
    }
  }
  return out;
}

/**
 * Load every schema under `schemas/`, register them with a fresh Ajv instance
 * (so cross-schema `$ref` works via canonical `$id`), and compile validators
 * for the seven shapes the validator's public API exposes.
 */
export function loadSchemas(): CompiledSchemas {
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  // Register every schema by `$id` first so cross-`$ref` resolution works.
  for (const schema of readAllSchemas()) {
    if (typeof schema.$id === 'string') {
      ajv.addSchema(schema);
    }
  }

  // Pull each schema's compiled validator via `getSchema(<$id>)` so we
  // do not re-register and trigger Ajv's "schema already exists" check.
  // The `addSchema` loop above guarantees presence; the assertion is the
  // contract.
  const pickCompiled = (id: string): ValidateFunction =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ajv.getSchema(id)!;
  const ID = (name: string): string => `https://act-spec.org/schemas/0.1/${name}.schema.json`;

  // The IndexEntry sub-schema lives only inside index.schema.json's `$defs`;
  // compile it directly so NDJSON line validation can skip the outer wrapper.
  const indexSchema = readSchema('100/index.schema.json') as RawSchema & {
    $defs: { IndexEntry: RawSchema };
  };
  const indexEntry = ajv.compile(indexSchema.$defs.IndexEntry);

  return {
    manifest: pickCompiled(ID('manifest')),
    index: pickCompiled(ID('index')),
    indexEntry,
    node: pickCompiled(ID('node')),
    subtree: pickCompiled(ID('subtree')),
    error: pickCompiled(ID('error')),
    etag: pickCompiled(ID('etag')),
  };
}

/**
 * Lazily-initialized singleton: schema compilation is non-trivial and the
 * validators are hot paths inside a fixture sweep.
 */
let cached: CompiledSchemas | undefined;
export function getCompiledSchemas(): CompiledSchemas {
  if (!cached) cached = loadSchemas();
  return cached;
}

/**
 * Reset the cached schema bundle. Used by tests that want to assert the
 * lazy-init path or to reload after a hypothetical schema swap.
 * Not part of the public API.
 *
 * @internal
 */
export function _resetCompiledSchemasForTest(): void {
  cached = undefined;
}

/** Map an Ajv error to a stable PRD-100 requirement ID per PRD-600-R2. */
export function ajvErrorToRequirement(
  envelope: 'manifest' | 'index' | 'indexEntry' | 'node' | 'subtree' | 'error',
  err: ErrorObject,
): string {
  // Closed enums get explicit citations (PRD-600-R5).
  if (err.keyword === 'enum' && err.instancePath.endsWith('/conformance/level')) {
    return 'PRD-107-R2';
  }
  if (err.keyword === 'enum' && err.instancePath.endsWith('/delivery')) {
    return 'PRD-107-R3';
  }
  if (
    err.keyword === 'enum' &&
    envelope === 'error' &&
    err.instancePath.endsWith('/error/code')
  ) {
    return 'PRD-100-R41';
  }
  // act_version pattern violation.
  if (err.keyword === 'pattern' && err.instancePath.endsWith('/act_version')) {
    return 'PRD-100-R1';
  }
  // ID grammar pattern (PRD-100-R10) — the schemas pin the same regex on
  // every ID-bearing field. The instancePath ends in `/id`, `/parent`,
  // `/root`, or `/children/<n>`.
  if (err.keyword === 'pattern') {
    const p = err.instancePath;
    if (p.endsWith('/id') || p.endsWith('/root') || p.endsWith('/parent') || /\/children\/\d+$/.test(p)) {
      return 'PRD-100-R10';
    }
  }
  // node_url_template `{id}` placeholder (PRD-100-R5).
  if (err.keyword === 'pattern' && err.instancePath.endsWith('/node_url_template')) {
    return 'PRD-100-R5';
  }
  // Required-field violations: route to the envelope-class requirement.
  // Special-case `act_version` — required at every envelope per PRD-100-R1.
  if (err.keyword === 'required') {
    const missing = (err.params as { missingProperty?: unknown })?.missingProperty;
    if (missing === 'act_version') return 'PRD-100-R1';
    if (missing === 'etag' && envelope === 'node') return 'PRD-103-R1';
    // Content block missing `type` discriminator → PRD-100-R28.
    if (missing === 'type' && /\/content\/\d+/.test(err.instancePath)) {
      return 'PRD-100-R28';
    }
    if (envelope === 'manifest') return 'PRD-100-R4';
    if (envelope === 'index' || envelope === 'indexEntry') return 'PRD-100-R17';
    if (envelope === 'node') return 'PRD-100-R21';
    if (envelope === 'subtree') return 'PRD-100-R32';
    if (envelope === 'error') return 'PRD-100-R41';
  }
  // additionalProperties on a closed sub-object (e.g., manifest.conformance,
  // error envelope itself). Per PRD-100-R6 the manifest's capabilities array
  // form is rejected; per PRD-100-R41 the error envelope shape is closed.
  if (err.keyword === 'additionalProperties') {
    if (envelope === 'error') return 'PRD-100-R41';
    if (envelope === 'manifest') return 'PRD-100-R6';
  }
  // capabilities-as-array (PRD-100-R6): array-vs-object surfaces as `type`.
  if (err.keyword === 'type' && err.instancePath.endsWith('/capabilities')) {
    return 'PRD-100-R6';
  }
  // Subtree depth bound.
  if (err.keyword === 'maximum' && err.instancePath.endsWith('/depth')) {
    return 'PRD-100-R33';
  }
  // Default fallback per envelope.
  switch (envelope) {
    case 'manifest':
      return 'PRD-100-R3';
    case 'index':
    case 'indexEntry':
      return 'PRD-100-R16';
    case 'node':
      return 'PRD-100-R21';
    case 'subtree':
      return 'PRD-100-R32';
    case 'error':
      return 'PRD-100-R41';
  }
}
