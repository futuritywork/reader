const { test } = require("node:test");
const assert = require("node:assert/strict");
const limitRequests = require("../request-limiter.cjs");
const signal = () => new AbortController().signal;
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("holds admission across an early stream return until the actual crawl settles", async () => {
  const acquire = limitRequests(1);
  let finishWork, returnStream;
  const returned = new Promise((resolve) => {
    returnStream = resolve;
  });
  async function crawl() {
    const release = await acquire(signal());
    try {
      returnStream({ stream: true });
      await new Promise((resolve) => {
        finishWork = resolve;
      });
    } finally {
      release();
    }
  }
  const work = crawl();
  await returned;
  let admitted = false;
  const waiting = acquire(signal()).then((release) => {
    admitted = true;
    return release;
  });
  await tick();
  assert.equal(admitted, false);
  finishWork();
  await work;
  const release = await waiting;
  assert.equal(admitted, true);
  release();
});

test("removes cancelled waiters and admits the remaining queue in order", async () => {
  const acquire = limitRequests(1);
  const first = await acquire(signal());
  const cancelled = new AbortController();
  const abandoned = acquire(cancelled.signal);
  const rejected = assert.rejects(abandoned, { name: "AbortError" });
  const order = [];
  const second = acquire(signal()).then((release) => {
    order.push(2);
    return release;
  });
  const third = acquire(signal()).then((release) => {
    order.push(3);
    return release;
  });
  cancelled.abort();
  await rejected;
  first();
  const releaseSecond = await second;
  assert.deepEqual(order, [2]);
  releaseSecond();
  const releaseThird = await third;
  assert.deepEqual(order, [2, 3]);
  releaseThird();
});

test("rejects excess capacity and releases a slot only once", async () => {
  const acquire = limitRequests(1, 1);
  const first = await acquire(signal());
  const second = acquire(signal());
  await assert.rejects(acquire(signal()), /Reader is at capacity/);
  first();
  first();
  const releaseSecond = await second;
  let admitted = false;
  const third = acquire(signal()).then((release) => {
    admitted = true;
    return release;
  });
  await tick();
  assert.equal(admitted, false);
  releaseSecond();
  const releaseThird = await third;
  assert.equal(admitted, true);
  releaseThird();
});

test("expires queued work without consuming a slot and allows later recovery", async () => {
  const acquire = limitRequests(1, 1, 15);
  const first = await acquire(signal());
  await assert.rejects(acquire(signal()), /Reader queue wait timed out/);
  first();
  const release = await acquire(signal());
  assert.equal(typeof release, "function");
  release();
});

test("already cancelled requests never consume capacity", async () => {
  const acquire = limitRequests(1, 0);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(acquire(cancelled.signal), { name: "AbortError" });
  const release = await acquire(signal());
  assert.equal(typeof release, "function");
  release();
});

test("releases failed work through the crawl's finally boundary", async () => {
  const acquire = limitRequests(1, 0);
  await assert.rejects(
    (async () => {
      const release = await acquire(signal());
      try {
        throw new Error("crawl failed");
      } finally {
        release();
      }
    })(),
    /crawl failed/,
  );
  const release = await acquire(signal());
  assert.equal(typeof release, "function");
  release();
});

test("a grant followed by cancellation can be released without stranding capacity", async () => {
  const acquire = limitRequests(1, 1);
  const first = await acquire(signal());
  const controller = new AbortController();
  const queued = acquire(controller.signal);
  first();
  controller.abort();
  const release = await queued;
  assert.throws(() => controller.signal.throwIfAborted(), {
    name: "AbortError",
  });
  release();
  const recovered = await acquire(signal());
  assert.equal(typeof recovered, "function");
  recovered();
});
