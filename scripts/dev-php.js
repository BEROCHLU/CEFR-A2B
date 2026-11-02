import { spawn } from 'child_process';
import fs from 'fs';

const phpCandidates = [
  'C:\\xampp\\php\\php.exe',
  'C:\\php\\php.exe',
  'php'
];

const phpPath = phpCandidates.find(p => p !== 'php' && fs.existsSync(p)) || 'php';

console.log(`Starting PHP server using [${phpPath}] on http://localhost:8000 (docroot: public)...`);

const server = spawn(phpPath, ['-S', 'localhost:8000', '-t', 'public'], {
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start PHP server:', err.message);
});

process.on('SIGINT', () => server.kill());
process.on('SIGTERM', () => server.kill());
