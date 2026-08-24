import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TIMEOUT_MS = 5000;
// On Windows python3 may not exist; try both
const PYTHON_CMDS = process.platform === 'win32'
  ? ['python', 'python3', 'py']
  : ['python3', 'python'];

function buildRunner(code, functionName, tests) {
  return `import json as _json, sys as _sys
_sys.setrecursionlimit(500)

${code}

_results = []
_tests = ${JSON.stringify(tests)}
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
print(_json.dumps(_results))
`;
}

async function trySpawn(cmd, scriptPath) {
  return new Promise((resolve) => {
    let py;
    try {
      py = spawn(cmd, [scriptPath], {
        timeout: TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      return resolve({ ok: false });
    }

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (d) => { stdout += d; });
    py.stderr.on('data', (d) => { stderr += d; });

    py.on('close', (code, signal) => {
      if (signal === 'SIGTERM' || code === null) {
        resolve({ ok: true, timedOut: true });
      } else {
        resolve({ ok: true, stdout, stderr, exitCode: code });
      }
    });
    py.on('error', () => resolve({ ok: false }));
  });
}

export async function runPython(code, functionName, tests) {
  const scriptPath = join(tmpdir(), `qn_${randomUUID()}.py`);
  await writeFile(scriptPath, buildRunner(code, functionName, tests), 'utf8');
  const cleanup = () => unlink(scriptPath).catch(() => {});

  try {
    for (const cmd of PYTHON_CMDS) {
      const res = await trySpawn(cmd, scriptPath);
      if (!res.ok) continue;

      if (res.timedOut) {
        return { error: 'Time limit exceeded (5 s)', results: [] };
      }

      const { stdout, stderr } = res;

      // Pure stderr with no stdout = compile/runtime error before runner ran
      if (!stdout.trim() && stderr.trim()) {
        return { error: stderr.trim(), results: [] };
      }

      try {
        const results = JSON.parse(stdout.trim());
        return { results, stderr: stderr.trim() || undefined };
      } catch {
        return { error: stderr.trim() || 'Unexpected runner output', results: [] };
      }
    }
    return { error: 'Python is not installed or not in PATH. Install Python 3 from python.org.', results: [] };
  } finally {
    await cleanup();
  }
}
