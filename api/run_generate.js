const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'generate_output.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

logStream.write('=== STARTING PRISMA GENERATE ===\n');
logStream.write(`Current Dir: ${__dirname}\n`);
logStream.write(`Time: ${new Date().toISOString()}\n\n`);

const run = (cmd, args) => {
  return new Promise((resolve, reject) => {
    logStream.write(`Spawning command: ${cmd} ${args.join(' ')}\n`);
    const proc = spawn(cmd, args, { shell: true, cwd: __dirname });

    proc.stdout.on('data', (data) => {
      logStream.write(`STDOUT: ${data.toString()}`);
    });

    proc.stderr.on('data', (data) => {
      logStream.write(`STDERR: ${data.toString()}`);
    });

    proc.on('close', (code) => {
      logStream.write(`Process exited with code ${code}\n\n`);
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}`));
    });
  });
};

async function main() {
  try {
    await run('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
    logStream.write('=== DB PUSH SUCCESSFUL ===\n\n');
    
    await run('npx', ['prisma', 'generate']);
    logStream.write('=== PRISMA GENERATE SUCCESSFUL ===\n\n');
  } catch (err) {
    logStream.write(`ERROR: ${err.message}\n`);
  } finally {
    logStream.end();
  }
}

main();
