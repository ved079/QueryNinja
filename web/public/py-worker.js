/* Pyodide Web Worker — runs Python code in an isolated thread */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');

let pyodide = null;

async function init() {
  if (pyodide) return pyodide;
  pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' });
  return pyodide;
}

const FREERUN_SETUP = `
import builtins as _builtins
import sys as _sys
_sys.setrecursionlimit(500)
_input_iter = iter(_mock_inputs)
def _mock_input(prompt=""):
    return next(_input_iter, "")
_builtins.input = _mock_input
`;

const HARNESS = `
import json as _json, sys as _sys, traceback as _tb
_sys.setrecursionlimit(500)

_results = []
_done = False

try:
    exec(_user_code, globals())
except Exception as _e:
    _results = [{"name": "Error in your code", "passed": False, "error": _tb.format_exc(), "actual": None, "expected": None}]
    _done = True

if not _done:
    _fn = globals().get(_fn_name)
    if _fn is None:
        _results = [{"name": "Setup Error", "passed": False, "error": f"Function '{_fn_name}' not found. Make sure you defined it.", "actual": None, "expected": None}]
        _done = True

if not _done:
    for _test in _test_cases:
        try:
            _inp = _test['input']
            _args = _inp if isinstance(_inp, list) else [_inp]
            _actual = _fn(*_args)
            _expected = _test['expectedOutput']
            _results.append({'name': _test['name'], 'passed': _actual == _expected, 'actual': repr(_actual), 'expected': repr(_expected)})
        except Exception as _e:
            _results.append({'name': _test['name'], 'passed': False, 'error': str(_e), 'actual': None, 'expected': repr(_test.get('expectedOutput'))})

print(_json.dumps(_results))
`;

const normalize = (s) => (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Strip internal Pyodide/lib frames, keep only the user-relevant lines.
function cleanError(raw) {
  const msg = raw?.message ?? String(raw ?? '');
  const lines = msg.split('\n');
  // Find lines that don't mention pyodide internals
  const filtered = lines.filter((l) =>
    !l.includes('/lib/python') &&
    !l.includes('_pyodide') &&
    !l.includes('pyodide.asm') &&
    !l.includes('CodeRunner') &&
    l.trim() !== ''
  );
  // Always keep the last line (the actual error message)
  if (!filtered.length) return lines[lines.length - 1]?.trim() ?? msg;
  return filtered.join('\n').trim();
}

self.onmessage = async (e) => {
  const { id, type, code, inputs, functionName, helperCode, tests } = e.data;
  const py = await init();

  // ── FREERUN MODE: just execute code, capture stdout ──
  if (type === 'freerun') {
    py.globals.set('_mock_inputs', py.toPy(inputs ?? []));
    let output = '';
    py.setStdout({ batched: (s) => { output += s + '\n'; } });
    try {
      await py.runPythonAsync(FREERUN_SETUP);
      await py.runPythonAsync(normalize(code));
      self.postMessage({ id, output: output.trimEnd() });
    } catch (err) {
      self.postMessage({ id, output: output.trimEnd(), error: cleanError(err) });
    }
    return;
  }

  // ── FUNCTION MODE: test harness ──
  try {
    const fullCode = helperCode ? `${normalize(helperCode)}\n${normalize(code)}` : normalize(code);
    py.globals.set('_user_code', fullCode);
    py.globals.set('_fn_name', functionName);
    py.globals.set('_test_cases', py.toPy(tests));

    let output = '';
    py.setStdout({ batched: (s) => { output += s + '\n'; } });

    await py.runPythonAsync(HARNESS);

    const results = JSON.parse(output.trim());
    self.postMessage({ id, results });
  } catch (err) {
    self.postMessage({ id, error: cleanError(err) });
  }
};
