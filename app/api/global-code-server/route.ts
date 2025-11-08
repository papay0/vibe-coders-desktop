import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const CODE_SERVER_INFO_PATH = path.join(os.homedir(), '.vibe-coders', 'code-server', 'global.json');

async function ensureCodeServerDir() {
  const dir = path.dirname(CODE_SERVER_INFO_PATH);
  await mkdir(dir, { recursive: true });
}

// Find an available port starting from 8080
async function findAvailablePort(startPort: number = 8080): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      // Check if port is in use
      await execAsync(`lsof -iTCP:${port} -sTCP:LISTEN -t`);
      // If we get here, port is in use, try next one
      console.log('[findAvailablePort] Port', port, 'is in use, trying next...');
    } catch (error) {
      // Port is available
      console.log('[findAvailablePort] ✅ Found available port:', port);
      return port;
    }
  }
  throw new Error('No available ports found in range 8080-8179');
}

function startCodeServer(port: number): Promise<{ port: number; pid: number }> {
  return new Promise((resolve, reject) => {
    console.log('[global-code-server] Starting code-server on port', port);

    // Start code-server without opening a specific folder
    // Users can then use ?folder= param to open any folder
    const child = spawn('npx', [
      'code-server',
      '--port', port.toString(),
      '--auth', 'none',
      '--disable-telemetry',
      '--bind-addr', `127.0.0.1:${port}`,
      '--disable-workspace-trust',
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
      },
    });

    const pid = child.pid!;
    console.log('[global-code-server] Process spawned with PID:', pid);

    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        child.kill();
        reject(new Error('Timeout waiting for code-server to start'));
      }
    }, 60000); // 60 second timeout

    // Listen to stdout for ready message
    child.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[global-code-server] stdout:', output);

      // Look for "HTTP server listening on" pattern
      if ((output.includes('HTTP server listening') || output.includes(`http://localhost:${port}`)) && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('[global-code-server] ✅ Code-server started on port:', port);

        // Unref so the process runs in background
        child.unref();

        resolve({ port, pid });
      }
    });

    // Listen to stderr as well
    child.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('[global-code-server] stderr:', output);

      if ((output.includes('HTTP server listening') || output.includes(`http://localhost:${port}`)) && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('[global-code-server] ✅ Code-server started on port:', port);

        child.unref();

        resolve({ port, pid });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[global-code-server] Process error:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      if (!serverReady) {
        clearTimeout(timeout);
        console.error('[global-code-server] Process exited with code:', code);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    console.log('[global-code-server] GET - Checking status');
    await ensureCodeServerDir();

    // Check if we have a saved code-server info
    try {
      const fileContent = await readFile(CODE_SERVER_INFO_PATH, 'utf-8');
      const serverInfo = JSON.parse(fileContent);
      console.log('[global-code-server] Found saved server info:', serverInfo);

      // Verify the PID is still running
      try {
        await execAsync(`ps -p ${serverInfo.pid} -o command=`);
        console.log('[global-code-server] Process is running');

        // Verify the port is still listening
        const portCheck = await execAsync(`lsof -iTCP:${serverInfo.port} -sTCP:LISTEN -t`);
        if (portCheck.stdout.trim()) {
          console.log('[global-code-server] ✅ Code-server verified - port', serverInfo.port, 'is listening');

          return NextResponse.json({
            running: true,
            port: serverInfo.port,
            pid: serverInfo.pid,
          });
        }
      } catch (error) {
        console.log('[global-code-server] Saved PID/port no longer valid:', error);
      }
    } catch (error) {
      console.log('[global-code-server] No saved server info found');
    }

    // Code-server not running
    console.log('[global-code-server] Code-server not running');
    return NextResponse.json({
      running: false,
      port: null,
    });
  } catch (error: any) {
    console.error('[global-code-server] Error checking status:', error);
    return NextResponse.json(
      { error: 'Failed to check code-server status', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[global-code-server] POST - Starting global code-server');
    await ensureCodeServerDir();

    // Check if already running
    try {
      const fileContent = await readFile(CODE_SERVER_INFO_PATH, 'utf-8');
      const serverInfo = JSON.parse(fileContent);

      // Verify it's actually running
      try {
        await execAsync(`ps -p ${serverInfo.pid} -o command=`);
        const portCheck = await execAsync(`lsof -iTCP:${serverInfo.port} -sTCP:LISTEN -t`);
        if (portCheck.stdout.trim()) {
          console.log('[global-code-server] ✅ Already running on port:', serverInfo.port);
          return NextResponse.json({
            success: true,
            port: serverInfo.port,
            pid: serverInfo.pid,
            alreadyRunning: true,
          });
        }
      } catch (error) {
        console.log('[global-code-server] Saved server not actually running, will start new one');
      }
    } catch (error) {
      console.log('[global-code-server] No existing server, will start new one');
    }

    // Find an available port
    const availablePort = await findAvailablePort();

    // Start code-server
    const { port, pid } = await startCodeServer(availablePort);

    // Save the server info
    await writeFile(
      CODE_SERVER_INFO_PATH,
      JSON.stringify({ port, pid, startedAt: new Date().toISOString() }, null, 2)
    );
    console.log('[global-code-server] Saved server info to:', CODE_SERVER_INFO_PATH);

    return NextResponse.json({
      success: true,
      port,
      pid,
    });
  } catch (error: any) {
    console.error('[global-code-server] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start code-server', details: error.message },
      { status: 500 }
    );
  }
}
