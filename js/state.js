export function createStore(initialState, onCommit = null) {
  let current = initialState;
  const listeners = new Set();

  function notify() {
    listeners.forEach(function (listener) {
      listener(current);
    });
    if (typeof onCommit === "function") onCommit(current);
  }

  return {
    get() {
      return current;
    },
    update(updater, options = {}) {
      current = typeof updater === "function" ? updater(current) : updater;
      if (options.silent !== true) notify();
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return function () {
        listeners.delete(listener);
      };
    },
  };
}
