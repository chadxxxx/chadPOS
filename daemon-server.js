// Self-forking daemon: forks a detached child that survives parent exit
const { fork } = require('child_process');
const path = require('path');

if (process.env._DAEMON_CHILD === '1') {
  // Child process - start Next.js dev server
  console.log('Daemon child started, PID:', process.pid);
  const { spawn } = require('child_process');
  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));
  server.on('exit', (code) => {
    console.log('Server exited with code:', code);
    process.exit(code || 0);
  });
  // Keep child alive
  setInterval(() => {}, 60000);
} else {
  // Parent - fork detached child and exit immediately
  const child = fork(__filename, [], {
    env: { ...process.env, _DAEMON_CHILD: '1' },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  console.log('Forked daemon child PID:', child.pid);
  // Exit parent immediately so the tool returns fast
  setTimeout(() => process.exit(0), 1000);
}
