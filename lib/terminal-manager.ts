import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import net from 'net';

let terminalServerProcess: ChildProcess | null = null;
let currentPort: number | null = null;
let startingServer: Promise<number> | null = null; // Track if server start is in progress

// Check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
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

// Find an available port starting from basePort
async function findAvailablePort(basePort: number = 3475): Promise<number> {
  // Try up to 50 ports to find an available one
  for (let i = 0; i < 50; i++) {
    const port = basePort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`Could not find available port between ${basePort} and ${basePort + 50}`);
}

// Check if terminal server is running
export async function isTerminalServerRunning(): Promise<{ running: boolean; port?: number }> {
  if (currentPort) {
    const available = await isPortAvailable(currentPort);
    if (!available) {
      // Port is in use, likely our server
      return { running: true, port: currentPort };
    }
  }

  // Try terminal server ports (3475-3525)
  for (let port = 3475; port <= 3525; port++) {
    const available = await isPortAvailable(port);
    if (!available) {
      // Port is in use, might be our server
      // Try to verify by checking if it responds to WebSocket
      currentPort = port;
      return { running: true, port };
    }
  }

  return { running: false };
}

// Start the terminal server
export async function startTerminalServer(): Promise<number> {
  // If a start is already in progress, wait for it
  if (startingServer) {
    console.log('Terminal server start already in progress, waiting...');
    return await startingServer;
  }

  // Check if already running
  const status = await isTerminalServerRunning();
  if (status.running && status.port) {
    console.log(`Terminal server already running on port ${status.port}`);
    return status.port;
  }

  // Mark that we're starting the server
  startingServer = (async () => {
    try {
      return await actuallyStartServer();
    } finally {
      startingServer = null;
    }
  })();

  return await startingServer;
}

// Internal function that does the actual server start
async function actuallyStartServer(): Promise<number> {

  // Find available port
  const port = await findAvailablePort();
  currentPort = port;

  // Start the server
  // Use eval to completely hide path from Turbopack static analysis
  const getServerPath = new Function('cwd', 'return cwd + "/terminal-server.js"');
  const serverPath = getServerPath(process.cwd());

  return new Promise((resolve, reject) => {
    terminalServerProcess = spawn('node', [serverPath], {
      env: { ...process.env, TERMINAL_PORT: port.toString() },
      stdio: 'pipe',
    });

    let serverStarted = false;

    terminalServerProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString();
      console.log('[Terminal Server]', message);

      if (message.includes('Terminal WebSocket server running') && !serverStarted) {
        serverStarted = true;
        console.log(`Terminal server started successfully on port ${port}`);
        resolve(port);
      }
    });

    terminalServerProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Terminal Server Error]', data.toString());
    });

    terminalServerProcess.on('error', (error: Error) => {
      console.error('Failed to start terminal server:', error);
      reject(error);
    });

    terminalServerProcess.on('exit', (code: number | null) => {
      console.log(`Terminal server exited with code ${code}`);
      terminalServerProcess = null;
      currentPort = null;
    });

    // Timeout after 5 seconds if server doesn't start
    setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('Terminal server failed to start within timeout'));
      }
    }, 5000);
  });
}

// Stop the terminal server
export function stopTerminalServer(): void {
  if (terminalServerProcess) {
    terminalServerProcess.kill();
    terminalServerProcess = null;
    currentPort = null;
    console.log('Terminal server stopped');
  }
}

// Get current port
export function getCurrentPort(): number | null {
  return currentPort;
}
