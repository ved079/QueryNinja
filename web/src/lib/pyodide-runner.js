let worker = null;
let pending = new Map();
let nextId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker('/py-worker.js');
    worker.onmessage = (e) => {
      const { id, results, error } = e.data;
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve({ results, error });
      }
    };
    worker.onerror = (e) => {
      // Reject all pending on unrecoverable worker crash
      for (const [id, resolve] of pending) {
        resolve({ error: e.message ?? 'Worker crashed' });
      }
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

export function runPython({ code, functionName, helperCode = '', tests }) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    getWorker().postMessage({ id, code, functionName, helperCode, tests });
  });
}
