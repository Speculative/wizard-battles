// A detached Vite process: no dispatch-owned terminal or pipes to keep alive.
import { spawn } from 'node:child_process';
import { openSync, closeSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
const directory = resolve(process.env.WIZARD_SERVER_DIR ?? resolve(root, 'runs-server'));
const stateFile = resolve(directory, 'server.json');
const logFile = resolve(directory, 'server.log');
const command = process.argv[2] ?? 'status';
const pause = ms => new Promise(r => setTimeout(r, ms));
function state() { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; } }
function alive(s) {
  if (!s) return false;
  try {
    // Check identity before sending signals; never kill a recycled PID.
    const args = readFileSync(`/proc/${s.pid}/cmdline`, 'utf8').split('\0');
    return args.includes(script) && args.includes(s.token);
  } catch { return false; }
}
async function healthy(s) {
  try {
    const response = await fetch(`http://127.0.0.1:${s.port}/api/feedback/health`, { signal: AbortSignal.timeout(2000) });
    const data = await response.json();
    return response.ok && data.service === 'wizard-battles-feedback' && data.instance === s.token;
  } catch { return false; }
}
if (command === 'serve') {
  const token = process.argv[3];
  const port = Number(process.argv[4]);
  process.env.WIZARD_SERVER_INSTANCE = token;
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { host: '0.0.0.0', port, strictPort: true } });
  await server.listen();
  const stop = async () => { console.log(`${new Date().toISOString()} Managed shutdown requested`); await server.close(); process.exit(0); };
  process.on('exit', code => console.log(`${new Date().toISOString()} Server exited (${code})`));
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  console.log(`${new Date().toISOString()} Detached server listening on ${port}`);
} else {
  if (!['start', 'stop', 'restart', 'status'].includes(command)) throw new Error('Use start, stop, restart or status');
  mkdirSync(directory, { recursive: true });
  // Serialize controllers, including startup, so two agents cannot orphan a server.
  const lock = resolve(directory, 'controller.lock');
  try { mkdirSync(lock); } catch { throw new Error(`Another controller is active. If it crashed, remove ${lock} after checking processes.`); }
  try {
    let s = state();
    if (command === 'status') {
      const running = alive(s);
      console.log(JSON.stringify({ ...s, running, healthy: running && await healthy(s), log: logFile }, null, 2));
      if (!running || !await healthy(s)) process.exitCode = 1;
    } else {
      if (command === 'stop' || command === 'restart') {
        if (alive(s)) {
          process.kill(s.pid, 'SIGTERM');
          for (let i = 0; i < 100 && alive(s); i++) await pause(100);
          if (alive(s)) throw new Error('Server did not stop; inspect the log.');
        }
        rmSync(stateFile, { force: true });
        s = null;
        console.log('Managed server stopped.');
      }
      if (command === 'start' || command === 'restart') {
        if (alive(s)) {
          if (!await healthy(s)) throw new Error('Managed process exists but storage is unhealthy; inspect the log or restart.');
          console.log(`Already running: http://localhost:${s.port} (PID ${s.pid})`);
        } else {
          const port = Number(process.env.WIZARD_DEV_PORT ?? 5173);
          const token = randomUUID();
          const log = openSync(logFile, 'a');
          const child = spawn(process.execPath, [script, 'serve', token, String(port)], { cwd: root, detached: true, stdio: ['ignore', log, log], env: process.env });
          child.on('error', error => console.error(error));
          child.unref(); closeSync(log);
          s = { pid: child.pid, token, port, startedAt: new Date().toISOString() };
          writeFileSync(stateFile, JSON.stringify(s, null, 2) + '\n');
          let ready = false;
          for (let i = 0; i < 100; i++) {
            if (!alive(s)) break;
            if (await healthy(s)) { ready = true; break; }
            await pause(100);
          }
          if (!ready) {
            if (alive(s)) process.kill(s.pid, 'SIGTERM');
            rmSync(stateFile, { force: true });
            throw new Error(`Server failed to start; see ${logFile}. Port conflicts never select another port.`);
          }
          console.log(`Started http://localhost:${port} (PID ${s.pid}); log: ${logFile}`);
        }
      }
    }
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
