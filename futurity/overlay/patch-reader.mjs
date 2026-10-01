import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const filename = join(process.argv[2], "services/puppeteer.js");
const source = readFileSync(filename, "utf8");
const expected =
  "d3281fe291c636ebc0c7e36fdfdb6bf82822bcf4a44a970e4f983e50292eea47";
if (createHash("sha256").update(source).digest("hex") !== expected) {
  throw new Error("Reader source differs from the pinned, reviewed version");
}

const capture = `                screenshot = (await this.takeScreenShot(page)) || screenshot;
                pageshot = (await this.takeScreenShot(page, { fullPage: true })) || pageshot;`;
if (source.split(capture).length !== 2) {
  throw new Error(
    "Expected exactly one unconditional final screenshot capture",
  );
}
const guarded = `                screenshot = (options.favorScreenshot ? await this.takeScreenShot(page) : undefined) || screenshot;
                pageshot = (options.favorScreenshot ? await this.takeScreenShot(page, { fullPage: true }) : undefined) || pageshot;`;
const page =
  "        this.lifeCycleTrack.set(page, this.asyncLocalContext.ctx);";
if (source.split(page).length !== 2) {
  throw new Error("Expected exactly one browser page lifecycle binding");
}
const cancellablePage = `${page}
        const readerAbortSignal = this.asyncLocalContext.get('readerAbortSignal');
        const readerAbortDeferred = (0, defer_1.Defer)();
        readerAbortDeferred.promise.catch(() => void 0);
        const closeCancelledPage = () => {
            readerAbortDeferred.reject(new Error('Reader request cancelled'));
            void this.ditchPage(page);
        };
        if (readerAbortSignal) {
            readerAbortSignal.addEventListener('abort', closeCancelledPage, { once: true });
            page.once('close', () => readerAbortSignal.removeEventListener('abort', closeCancelledPage));
            if (readerAbortSignal.aborted) {
                await this.ditchPage(page);
                return;
            }
        }`;
const crawlerFilename = join(process.argv[2], "api/crawler.js");
const crawler = readFileSync(crawlerFilename, "utf8");
if (
  createHash("sha256").update(crawler).digest("hex") !==
  "44d1487549a13ba4c647da63a2c8091c01d3c450d06fc6bd5f35101458629ba6"
) {
  throw new Error("Crawler source differs from the pinned, reviewed version");
}
const configure =
  "        const crawlOpts = await this.configure(crawlerOptions);";
if (crawler.split(configure).length !== 2) {
  throw new Error("Expected exactly one request configuration binding");
}
const cancellableConfigure = `${configure}
        this.threadLocal.set('readerAbortSignal', rpcReflect.signal);`;
const format =
  /^( *)const formatted = await this\.formatSnapshot\(crawlerOptions, (?:scrapped|lastScrapped), targetUrl, this\.urlValidMs\);$/gm;
if ([...crawler.matchAll(format)].length !== 5) {
  throw new Error("Expected exactly five request formatting boundaries");
}
const cancellableCrawler = crawler
  .replace(configure, cancellableConfigure)
  .replace(
    format,
    (line, indent) => `${indent}rpcReflect.signal.throwIfAborted();\n${line}`,
  );
const checkpoint =
  "                const ckpt = [nextSnapshotDeferred.promise, waitForPromise ?? gotoPromise];";
if (source.split(checkpoint).length !== 2) {
  throw new Error("Expected exactly one browser snapshot wait");
}
const threadedFilename = join(process.argv[2], "services/threaded.js");
const threaded = readFileSync(threadedFilename, "utf8");
if (
  createHash("sha256").update(threaded).digest("hex") !==
  "58adf21a7f891d4eec0e79f7ef4571facd67b0c1327305733416e552536ac1dd"
) {
  throw new Error("Threaded source differs from the pinned, reviewed version");
}
const workerLimit =
  "        this.maxWorkers = isLikelyHyperThreaded ? cpuStat.length / 2 : cpuStat.length;";
if (threaded.split(workerLimit).length !== 2) {
  throw new Error("Expected exactly one worker pool limit");
}
const configuredWorkers = `${workerLimit}
        if (process.env.READER_MAX_WORKERS !== undefined) {
            const configuredMaxWorkers = Number(process.env.READER_MAX_WORKERS);
            if (!Number.isInteger(configuredMaxWorkers) || configuredMaxWorkers < 2) {
                throw new Error('READER_MAX_WORKERS must be an integer of at least two');
            }
            this.maxWorkers = Math.min(this.maxWorkers, configuredMaxWorkers);
        }`;
const curlFilename = join(
  process.argv[2],
  "../node_modules/@nomagick/node-libcurl-impersonate/dist/Curl.js",
);
const curl = readFileSync(curlFilename, "utf8");
if (
  createHash("sha256").update(curl).digest("hex") !==
  "f01a81e0aa1876a879a8946a19d771793d91a6a2c0ca9d8a1cc6df9e45e3b484"
) {
  throw new Error(
    "Curl stream adapter differs from the pinned, reviewed version",
  );
}
const streamRead = `                    handle.streamPendingReadSize += size;
                    if (handle.handle.isPausedRecv && handle.isRunning) {
                        handle.nextPauseFlags = handle.handle.pauseFlags & ~CurlPause_1.CurlPause.Recv;
                    }`;
if (curl.split(streamRead).length !== 2) {
  throw new Error("Expected exactly one curl response stream read callback");
}
const resumableRead = `                    handle.streamPendingReadSize += size;
                    setImmediate(() => {
                        if (handle.handle.isOpen && handle.isRunning && handle.handle.isPausedRecv && handle.streamPendingReadSize > 0) {
                            const pauseFlags = (handle.nextPauseFlags ?? handle.handle.pauseFlags) & ~CurlPause_1.CurlPause.Recv;
                            handle.nextPauseFlags = null;
                            handle.pause(pauseFlags);
                        }
                    });`;
const crawlerHasher =
  "exports.sha256Hasher = new hash_1.HashManager('sha256', 'hex');";
const crawlMethod =
  "    async crawl(rpcReflect, ctx, auth, crawlerOptionsHeaderOnly, crawlerOptionsParamsAllowed) {";
const crawlEnd = "    }\n    _finalFormat(crawlerOptions, formatted) {";
if (
  [crawlerHasher, crawlMethod, crawlEnd].some(
    (anchor) => crawler.split(anchor).length !== 2,
  )
) {
  throw new Error("Expected exactly one Reader crawl admission boundary");
}
const boundedCrawler = cancellableCrawler
  .replace(
    crawlerHasher,
    `${crawlerHasher}
const readerAdmission = require('../lib/reader-request-limiter.cjs')(2, 32, 25000, (message) => new errors_1.ServiceNodeResourceDrainError(message));`,
  )
  .replace(
    crawlMethod,
    `${crawlMethod}
        const releaseReaderSlot = await readerAdmission(rpcReflect.signal);
        try {
            rpcReflect.signal.throwIfAborted();`,
  )
  .replace(
    crawlEnd,
    `        } finally {
            releaseReaderSlot();
        }
${crawlEnd}`,
  );
writeFileSync(
  filename,
  source
    .replace(capture, guarded)
    .replace(page, cancellablePage)
    .replace(
      checkpoint,
      "                const ckpt = [nextSnapshotDeferred.promise, waitForPromise ?? gotoPromise, readerAbortDeferred.promise];",
    ),
);
writeFileSync(crawlerFilename, boundedCrawler);
writeFileSync(
  threadedFilename,
  threaded.replace(workerLimit, configuredWorkers),
);
writeFileSync(curlFilename, curl.replace(streamRead, resumableRead));
