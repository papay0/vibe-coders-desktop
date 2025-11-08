import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

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
  throw new Error('No available ports found in range');
}

// Get the code-server info file path for a project
async function getCodeServerInfoPath(projectPath: string): Promise<string> {
  const hash = crypto.createHash('md5').update(projectPath).digest('hex');
  const serverDir = path.join(os.homedir(), '.vibe-coders', 'code-servers');

  // Ensure directory exists
  await mkdir(serverDir, { recursive: true });

  return path.join(serverDir, `${hash}.json`);
}

function startCodeServer(projectPath: string, port: number): Promise<{ port: number; pid: number }> {
  return new Promise((resolve, reject) => {
    console.log('[startCodeServer] Spawning code-server on port', port);
    console.log('[startCodeServer] Project path:', projectPath);

    // Spawn code-server in the project directory
    const child = spawn('npx', [
      'code-server',
      projectPath,
      '--port', port.toString(),
      '--auth', 'none',
      '--disable-telemetry',
      '--bind-addr', `0.0.0.0:${port}`
    ], {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
      },
    });

    const pid = child.pid!;
    console.log('[startCodeServer] Process spawned with PID:', pid);

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
      console.log('[startCodeServer] stdout:', output);

      // Look for "HTTP server listening on" pattern
      if ((output.includes('HTTP server listening') || output.includes(`http://localhost:${port}`)) && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('[startCodeServer] ✅ Code-server started on port:', port);

        // Unref so the process runs in background
        child.unref();

        resolve({ port, pid });
      }
    });

    // Listen to stderr as well
    child.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('[startCodeServer] stderr:', output);

      if ((output.includes('HTTP server listening') || output.includes(`http://localhost:${port}`)) && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('[startCodeServer] ✅ Code-server started on port:', port);

        child.unref();

        resolve({ port, pid });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[startCodeServer] Process error:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      if (!serverReady) {
        clearTimeout(timeout);
        console.error('[startCodeServer] Process exited with code:', code);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    console.log('[start-code-server] ========== START REQUEST ==========');
    console.log('[start-code-server] Project path:', projectPath);

    // Find an available port
    console.log('[start-code-server] Finding available port...');
    const availablePort = await findAvailablePort();

    console.log('[start-code-server] Starting code-server on port:', availablePort);
    const { port, pid } = await startCodeServer(projectPath, availablePort);

    // Save the code-server info
    const codeServerInfoPath = await getCodeServerInfoPath(projectPath);
    await writeFile(
      codeServerInfoPath,
      JSON.stringify({ port, pid, startedAt: new Date().toISOString() }, null, 2)
    );
    console.log('[start-code-server] Saved code-server info to:', codeServerInfoPath);

    return NextResponse.json({
      success: true,
      port,
      pid,
    });
  } catch (error: any) {
    console.error('[start-code-server] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start code-server', details: error.message },
      { status: 500 }
    );
  }
}
