let worker = null;
let pending = new Map();
let nextId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker('/py-worker.js');
    worker.onmessage = (e) => {
      const { id, results, output, error } = e.data;
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve({ results, output, error });
      }
    };
    worker.onerror = (e) => {
      for (const [, resolve] of pending) {
        resolve({ error: e.message ?? 'Worker crashed' });
      }
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

export function runPython({ type = 'function', code, inputs = [], functionName, helperCode = '', tests }) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    getWorker().postMessage({ id, type, code, inputs, functionName, helperCode, tests });
  });
}
