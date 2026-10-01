"use strict";

module.exports = function requestLimiter(
  maxActive = 2,
  maxQueued = 32,
  maxWaitMs = 25000,
  capacityError = (message) => new Error(message),
) {
  let active = 0;
  const queue = [];
  function releaseSlot() {
    const waiter = queue.shift();
    if (waiter) waiter.grant();
    else active--;
  }
  function releaseOnce() {
    let released = false;
    return () => {
      if (!released) {
        released = true;
        releaseSlot();
      }
    };
  }
  return async function acquire(signal) {
    signal.throwIfAborted();
    if (active < maxActive) {
      active++;
      return releaseOnce();
    }
    if (queue.length >= maxQueued) throw capacityError("Reader is at capacity");
    return new Promise((resolve, reject) => {
      let timer;
      function cleanup() {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancelled);
      }
      const entry = {
        grant() {
          cleanup();
          resolve(releaseOnce());
        },
      };
      function remove(error) {
        const index = queue.indexOf(entry);
        if (index >= 0) {
          queue.splice(index, 1);
          cleanup();
          reject(error);
        }
      }
      function cancelled() {
        remove(signal.reason);
      }
      signal.addEventListener("abort", cancelled, { once: true });
      timer = setTimeout(
        () => remove(capacityError("Reader queue wait timed out")),
        maxWaitMs,
      );
      queue.push(entry);
    });
  };
};
