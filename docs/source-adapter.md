# Source Adapter SDK

## Scope

The Source Adapter SDK converts an authorized source into the stable `NormalizedContent` model. An adapter obtains input and understands its native fields. It does not score candidates, decide review status, write the workspace, or bypass a source's controls.

The `v0.4.0` packages are source workspaces inside this monorepo. They are not yet advertised as published npm packages.

## Interface

```ts
export interface SourceAdapter<TConfig = unknown, TRaw = unknown> {
  readonly kind: string
  initialize(config: TConfig): Promise<void>
  validateConfig(config: unknown): AdapterValidation
  fetch(): Promise<NormalizedContent[]>
  normalize(raw: TRaw, index: number): NormalizedContent
  healthCheck(): Promise<AdapterHealth>
  dispose(): Promise<void>
}
```

Every normalized item has these fields:

```ts
interface NormalizedContent {
  id: string
  source: string
  title: string
  content: string
  author: string | null
  publishedAt: string | null
  url: string | null
  metadata: Record<string, unknown>
}
```

`publishedAt` is an ISO 8601 string with an offset. `url` is HTTP(S) or `null`. `author` may be absent. Adapter-specific values belong in `metadata`, where credential-like keys are recursively removed by the built-in helpers.

## Lifecycle

1. `validateConfig` returns all configuration problems without opening the source.
2. `initialize` validates configuration, verifies access and allocates resources.
3. `healthCheck` reports whether the initialized adapter can currently read its source.
4. `fetch` reads and returns a normalized batch.
5. `normalize` converts one raw record and is directly testable.
6. `dispose` closes handles and clears local state, including after failure.

Callers must place `dispose` in `finally`.

```ts
const adapter = registry.create('example')
try {
  await adapter.initialize(config)
  const health = await adapter.healthCheck()
  if (!health.healthy) throw new Error(health.message)
  const items = await adapter.fetch()
} finally {
  await adapter.dispose()
}
```

## Configuration

The built-in file adapters require `path` and accept an optional `sourceName`. Files are limited to 10 MiB.

CSV and JSON adapters also accept field mapping:

```ts
await adapter.initialize({
  path: 'export.csv',
  sourceName: 'support-export',
  mapping: {
    id: 'record_id',
    title: 'headline',
    content: 'message',
    publishedAt: 'created_at',
  },
})
```

The JSON adapter accepts `itemsProperty` for a top-level array wrapper:

```ts
await adapter.initialize({
  path: 'export.json',
  itemsProperty: 'records',
})
```

Unknown configuration keys are rejected.

## Example adapter

```ts
import { normalizedContentSchema } from '@xiaoye-radar/core'
import type { AdapterHealth, AdapterValidation, SourceAdapter } from '@xiaoye-radar/source-sdk'

interface ExampleConfig {
  records: Array<{ key: string; headline: string; body: string }>
}

export class ExampleAdapter implements SourceAdapter<
  ExampleConfig,
  ExampleConfig['records'][number]
> {
  readonly kind = 'example'
  private config: ExampleConfig | null = null

  validateConfig(value: unknown): AdapterValidation {
    const valid = Boolean(value && typeof value === 'object' && 'records' in value)
    return { valid, errors: valid ? [] : ['records is required'] }
  }

  async initialize(config: ExampleConfig): Promise<void> {
    const result = this.validateConfig(config)
    if (!result.valid) throw new Error(result.errors.join('; '))
    this.config = config
  }

  normalize(raw: ExampleConfig['records'][number]) {
    return normalizedContentSchema.parse({
      id: raw.key,
      source: this.kind,
      title: raw.headline,
      content: raw.body,
      author: null,
      publishedAt: null,
      url: null,
      metadata: {},
    })
  }

  async fetch() {
    if (!this.config) throw new Error('Adapter is not initialized')
    return this.config.records.map((raw, index) => this.normalize(raw, index))
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      healthy: this.config !== null,
      message: this.config ? 'Ready' : 'Not initialized',
      checkedAt: new Date().toISOString(),
    }
  }

  async dispose(): Promise<void> {
    this.config = null
  }
}
```

## Error handling

- Throw a short, actionable `Error` for an operation that cannot continue.
- Do not include credentials, full records, authorization headers, cookies, or tokens in messages.
- Treat malformed source records as invalid input. Do not invent missing identifiers, authors, dates, or URLs unless the adapter's documented normalization policy defines a deterministic fallback.
- Put retry and rate policy in the adapter or host integration, never in the Rule Engine.
- Abort promptly if a future network adapter receives an abort signal.

## Testing

An adapter contribution should cover:

- valid configuration and every optional mapping
- invalid configuration and unsupported values
- normalization of missing fields
- invalid date and URL behavior
- empty and malformed input
- size limits or bounded pagination
- nested sensitive-metadata removal
- health before/after initialization
- `dispose` after success and failure

Run `npm test` and `npm run verify` before opening a pull request. The built-in adapter tests live in `tests/unit/source-adapters.test.ts`.

## Registration

```ts
const registry = new SourceAdapterRegistry()
registry.register('example', () => new ExampleAdapter())
const adapter = registry.create('example')
```

Kinds must be unique. Applications should use an allowlist and should not dynamically execute an arbitrary package named by imported data.

## Packaging third-party adapters

Keep an external adapter in a separate repository/package with its own license, source terms, configuration schema, tests and security policy. Pin a compatible Xiaoye Radar API version once the SDK is formally published. Do not copy platform-specific adapters into this repository merely to make discovery easier.

Before publishing, document:

- where the data comes from and what authorization is required
- whether credentials are needed and how they remain local
- rate limits and deletion behavior
- fields retained in `metadata`
- known jurisdiction or source-policy constraints

Adapters that bypass CAPTCHA, access control, authentication, rate limits, or platform safeguards are out of scope.
