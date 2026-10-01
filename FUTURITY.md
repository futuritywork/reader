# Futurity Reader fork

This is a GitHub fork of [jina-ai/reader](https://github.com/jina-ai/reader).
`main` tracks upstream; `alex/reader-resource-bounds` starts from upstream commit
`1574bfd380d249c86c82db4dace0d9c8fe17e2b1`, the source revision of our pinned image.
Reader's original license and notices remain in place.

## Changes

- Cancellation closes browser pages, interrupts snapshot waits, and prevents
  formatting after cancellation; final screenshots are captured only when requested.
- `READER_MAX_WORKERS` optionally bounds the worker pool, with a minimum of two.
- Crawl admission permits two active requests, up to 32 queued requests and a
  25-second queue deadline; admission is held until the actual RPC method settles,
  including early SSE stream returns.
- `futurity/apply-curl.mjs` fixes paused response downloads in the separately
  maintained `@nomagick/node-libcurl-impersonate` dependency. Its original file hash
  is verified, repeat application is safe, and unexpected versions fail for review.

The commits separate Reader lifecycle changes, worker configuration, admission
policy, and the dependency fix so they can be reviewed or submitted independently.
The curl fix belongs upstream in [nomagick/node-libcurl-impersonate](https://github.com/nomagick/node-libcurl-impersonate); it is not a Reader source fix.
Admission defaults are Futurity's deployment policy and may need configurable
limits for a general upstream proposal. No upstream issue or PR has been posted.

## Build and verification

Use the upstream Node/npm workflow and its asset setup from CONTRIBUTING.md:

```sh
npm ci
npm run build
npm run test:futurity
npm test
npm run lint
```

Validation of this branch: TypeScript build passed; seven admission regressions,
423 upstream unit tests and 403 upstream e2e tests passed in an isolated container.
`npm run lint` exits 2 because the upstream tree has no ESLint configuration;
this is not a lint pass.

The build applies the curl patch before TypeScript compilation. The upstream
Dockerfile also applies it after installing dependencies. No credentials are
needed for the regression tests. Production integration is tracked separately:
https://github.com/futuritywork/futurity/pull/1311

`futurity/overlay` preserves the exact image-overlay build inputs currently used
in production. It remains independent of the TypeScript source build:

```sh
docker build -f futurity/overlay/Dockerfile futurity/overlay
```

The parent image is pinned to
`sha256:8cc9a5cf6dc9c240235fccc0026661de74b6e13c21b36e6a86b3281b9ef10f28`.
The deployed derived image is
`sha256:f302b36accf02c2567328382f274aa5bb47573b7e16bf0800ba5bc8e8586d9c4`.
The overlay checks all upstream hashes before changing any file.

`futurity/benchmark` preserves the controlled fixture, large-page load test,
byte-identical curl regression, admission tests and actual civkit stream-return
probe. Run the latter against `build/lib/reader-request-limiter.cjs`; run the curl
and load probes inside a bounded container with READER_FIXTURE_URL pointing to
an owned fixture. Do not stress unrelated sites. The standalone admission test
under `tests/futurity` targets the source-built limiter.

Controlled 100-request/concurrency-ten runs of the deployed overlay passed all
large static and JavaScript pages; peaks were 2.46 GB and 2.79 GB under an 8 GB
container limit. These results describe the deployed overlay, not a new benchmark
of this source-built branch, and do not explain the old Railway process's 25 GB
memory accumulation or establish long-term leak-free behavior.

## Updating

```sh
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch alex/reader-resource-bounds
git merge upstream/main
npm ci
npm run build
npm run test:futurity
npm test
```

Keep upstream updates separate from patch commits and resolve conflicts in the
TypeScript sources. Review the curl dependency when its hash changes; do not
silently bypass the guard. The pinned overlay needs its image/source hashes and
replacement counts reviewed separately after an upstream update. Deploying a
rebased source build requires new image and workload validation plus the normal
Agent Gate cutover approval.
