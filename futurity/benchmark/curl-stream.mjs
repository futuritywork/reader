import { createRequire } from "node:module";
import { PassThrough } from "node:stream";

const require = createRequire("/app/package.json");
const {
  Curl,
  CurlFeature,
  Browser,
} = require("@nomagick/node-libcurl-impersonate");
const fixture = process.env.READER_FIXTURE_URL;
if (!fixture)
  throw new Error("Set READER_FIXTURE_URL to the controlled fixture origin");
const count = Number(process.argv[2] || 100);
const concurrency = Number(process.argv[3] || 1);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 1000 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 10
) {
  throw new Error("Use 1-1000 requests and 1-10 concurrent requests");
}
const url = `${fixture}/article?case=curl-stream-regression`;
const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
if (!response.ok) throw new Error(`Fixture returned ${response.status}`);
const expected = Buffer.from(await response.arrayBuffer());
const keepAlive = setInterval(() => {}, 1000);
let cursor = 0;
let failures = 0;

function download() {
  return new Promise((resolve, reject) => {
    const curl = Curl.impersonate(Browser.Chrome);
    let source;
    curl.enable(CurlFeature.StreamResponse);
    curl.setOpt("URL", url);
    curl.setOpt(Curl.option.TIMEOUT_MS, 2000);
    curl.on("stream", (stream) => {
      source = stream;
      const downstream = new PassThrough();
      stream.pipe(downstream);
      stream.once("error", (error) => downstream.destroy(error));
      curl.on("error", (error) => {
        downstream.destroy(error);
        stream.destroy(error);
      });
      resolve(downstream);
    });
    curl.on("end", () => {
      if (!source || source.readableEnded) curl.close();
      else source.once("end", () => curl.close());
    });
    curl.on("error", (error) => {
      curl.close();
      reject(error);
    });
    curl.perform();
  });
}

try {
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < count) {
        const i = cursor++;
        const start = Date.now();
        try {
          const stream = await download();
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          await new Promise((resolve, reject) => {
            stream.once("end", resolve);
            stream.once("error", reject);
          });
          const body = Buffer.concat(chunks);
          const okay = body.equals(expected);
          if (!okay) failures++;
          console.log(
            JSON.stringify({
              i,
              ms: Date.now() - start,
              bytes: body.length,
              okay,
            }),
          );
        } catch (error) {
          failures++;
          console.log(
            JSON.stringify({ i, ms: Date.now() - start, error: String(error) }),
          );
        }
      }
    }),
  );
} finally {
  clearInterval(keepAlive);
}
console.log(JSON.stringify({ count, concurrency, failures }));
if (failures) process.exitCode = 1;
