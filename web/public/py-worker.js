/* Pyodide Web Worker — runs Python code in an isolated thread */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');

let pyodide = null;

async function init() {
  if (pyodide) return pyodide;
  pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' });
  return pyodide;
}

function buildRunner(code, functionName, tests) {
  const testsJson = JSON.stringify(tests);
  return `
import json as _json, sys as _sys
_sys.setrecursionlimit(500)

${code}

_results = []
_tests = ${testsJson}
for _test in _tests:
    try:
        _inp = _test['input']
        _args = _inp if isinstance(_inp, list) else [_inp]
        _actual = ${functionName}(*_args)
        _expected = _test['expectedOutput']
        _passed = _actual == _expected
        _results.append({
            'name': _test['name'],
            'passed': _passed,
            'actual': repr(_actual),
            'expected': repr(_expected),
        })
    except Exception as _e:
        _results.append({
            'name': _test['name'],
            'passed': False,
            'error': str(_e),
            'actual': None,
            'expected': repr(_test['expectedOutput']),
        })
_json.dumps(_results)
`;
}

self.onmessage = async (e) => {
  const { id, code, functionName, helperCode, tests } = e.data;
  try {
    const py = await init();
    const normalize = (s) => (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const fullCode = helperCode ? `${normalize(helperCode)}\n${normalize(code)}` : normalize(code);
    const script = buildRunner(fullCode, functionName, tests);
    const output = await py.runPythonAsync(script);
    const results = JSON.parse(output);
    self.postMessage({ id, results });
  } catch (err) {
    // Pyodide surfaces Python tracebacks as the error message
    self.postMessage({ id, error: err.message ?? String(err) });
  }
};
