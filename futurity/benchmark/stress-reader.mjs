import { execFileSync } from "node:child_process";
import fs from "node:fs";
const count = Number(process.argv[2] || 100);
const concurrency = Number(process.argv[3] || 10);
const phase = process.argv[4] || "article";
const fixture = process.env.READER_FIXTURE_URL;
if (!fixture)
  throw new Error("Set READER_FIXTURE_URL to the controlled fixture origin");
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
if (!["article", "dynamic", "small-article", "small-dynamic"].includes(phase))
  throw new Error("Unknown fixture phase");
const minimumChars = phase.startsWith("small-") ? 2000 : 100000;
let cursor = 0,
  complete = 0,
  failures = 0;
const run = Date.now();
function measure(event, extra = {}) {
  const stat = Object.fromEntries(
    fs
      .readFileSync("/sys/fs/cgroup/memory.stat", "utf8")
      .trim()
      .split("\n")
      .map((x) => x.split(" "))
      .map(([k, v]) => [k, Number(v)]),
  );
  console.log(
    JSON.stringify({
      event,
      time: Date.now(),
      phase,
      complete,
      failures,
      memory: Number(fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8")),
      anon: stat.anon,
      file: stat.file,
      ...extra,
    }),
  );
}
measure("before");
const timer = setInterval(() => measure("sample"), 5000);
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < count) {
      const i = cursor++;
      const target = `${fixture}/${phase}?case=${run}-${i}`;
      const started = Date.now();
      try {
        const headers = {
          Accept: "application/json",
          "X-Target-Selector": "main",
        };
        if (phase.includes("dynamic"))
          headers["X-Wait-For-Selector"] = ".ready";
        const resp = await fetch(`http://127.0.0.1:8081/${target}`, {
          headers,
          signal: AbortSignal.timeout(30000),
        });
        const body = await resp.json();
        const content = body.data?.content || "";
        const okay =
          resp.ok && content.includes("48291") && content.length > minimumChars;
        if (!okay) failures++;
        complete++;
        measure("result", {
          i,
          ms: Date.now() - started,
          http: resp.status,
          chars: content.length,
          okay,
          error: okay ? undefined : JSON.stringify(body).slice(0, 300),
        });
      } catch (error) {
        failures++;
        complete++;
        measure("error", { i, ms: Date.now() - started, error: String(error) });
      }
    }
  }),
);
clearInterval(timer);
measure("load-finished", {
  elapsed: Date.now() - run,
  processes: execFileSync("ps", ["-eo", "pid,ppid,rss,comm", "--sort=-rss"], {
    encoding: "utf8",
  }).trim(),
});
await new Promise((resolve) => setTimeout(resolve, 30000));
measure("idle-finished");
if (failures) process.exitCode = 1;
