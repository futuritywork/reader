"use strict";
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { PassThrough } = require("node:stream");
const requireReader = createRequire("/app/package.json");
requireReader("reflect-metadata");
const {
  AbstractRPCRegistry,
} = require("/app/node_modules/civkit/civ-rpc/registry.js");
const { RPC_REFLECT } = require("/app/node_modules/civkit/civ-rpc/base.js");
const createLimiter = require(
  process.argv[2] || "/app/build/lib/reader-request-limiter.cjs",
);
const acquire = createLimiter(1, 1, 1000);
const registry = new AbstractRPCRegistry();
const work = [];
registry.conf.set("probe", {
  paramOptions: [{ path: RPC_REFLECT, type: Object }],
  _host: {},
  _func: async (reflect) => {
    const release = await acquire(reflect.signal);
    try {
      reflect.signal.throwIfAborted();
      const record = { settled: false };
      work.push(record);
      const stream = new PassThrough();
      reflect.return(stream);
      await new Promise((resolve) => {
        record.finish = resolve;
      });
      record.settled = true;
      stream.end();
      return stream;
    } finally {
      release();
    }
  },
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  const firstController = new AbortController();
  const firstStream = await registry.exec(
    "probe",
    {},
    undefined,
    firstController.signal,
  );
  assert.equal(work.length, 1);
  assert.equal(work[0].settled, false);
  firstController.abort();
  firstStream.destroy();
  let secondReturned = false;
  const secondResult = registry
    .exec("probe", {}, undefined, new AbortController().signal)
    .then((stream) => {
      secondReturned = true;
      return stream;
    });
  await tick();
  assert.equal(secondReturned, false);
  assert.equal(work.length, 1);
  work[0].finish();
  const secondStream = await secondResult;
  assert.equal(work[0].settled, true);
  assert.equal(work.length, 2);
  work[1].finish();
  await tick();
  secondStream.destroy();
  const recovered = await acquire(new AbortController().signal);
  assert.equal(typeof recovered, "function");
  recovered();
  console.log(
    JSON.stringify({
      passed: true,
      retainedUntilRpcSettled: true,
      recovered: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
