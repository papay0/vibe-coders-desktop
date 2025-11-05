#!/usr/bin/env node
import { createServer } from 'net';
import { spawn } from 'child_process';

/**
 * Find an available port starting from the preferred port
 */
async function findAvailablePort(startPort = 3737, maxAttempts = 100) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`Could not find an available port between ${startPort} and ${startPort + maxAttempts}`);
}

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

/**
 * Start Next.js dev server on an available port
 */
async function startDevServer() {
  try {
    // Preferred port - 3737 (unlikely to be used, easy to remember)
    const preferredPort = 3737;
    const port = await findAvailablePort(preferredPort);

    if (port !== preferredPort) {
      console.log(`\n⚠️  Port ${preferredPort} is in use, using port ${port} instead\n`);
    }

    // Start Next.js with the found port
    const nextDev = spawn('next', ['dev', '-p', String(port)], {
      stdio: 'inherit',
      shell: true
    });

    nextDev.on('error', (error) => {
      console.error('Failed to start Next.js:', error);
      process.exit(1);
    });

    nextDev.on('exit', (code) => {
      process.exit(code || 0);
    });

    // Handle termination signals
    const handleExit = () => {
      nextDev.kill();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

  } catch (error) {
    console.error('Error finding available port:', error);
    process.exit(1);
  }
}

// Run the dev server
startDevServer();
