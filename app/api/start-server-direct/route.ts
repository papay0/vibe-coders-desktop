import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import { writeFile } from 'fs/promises';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Find an available port starting from 3000
async function findAvailablePort(startPort: number = 3000): Promise<number> {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    console.log('[start-server-direct] ========== REQUEST RECEIVED ==========');
    console.log('[start-server-direct] Project path:', projectPath);

    if (!projectPath) {
      console.log('[start-server-direct] ERROR: No project path provided');
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    console.log('[start-server-direct] Starting dev server for:', projectPath);

    // Find an available port first
    const availablePort = await findAvailablePort();
    console.log('[start-server-direct] Will use port:', availablePort);

    // Start the server and wait for the port
    const { port, pid } = await startDevServer(projectPath, availablePort);

    // Save the server info to a file in the project directory
    const serverInfoPath = path.join(projectPath, '.vibe-coders-server.json');
    await writeFile(
      serverInfoPath,
      JSON.stringify({ port, pid, startedAt: new Date().toISOString() }, null, 2)
    );
    console.log('[start-server-direct] Saved server info to:', serverInfoPath);

    console.log('[start-server-direct] ========== SUCCESS ==========');
    console.log('[start-server-direct] Server started on port:', port, 'with PID:', pid);

    return NextResponse.json({
      success: true,
      port,
    });
  } catch (error: any) {
    console.error('[start-server-direct] ========== ERROR ==========');
    console.error('[start-server-direct] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start server', details: error.message },
      { status: 500 }
    );
  }
}

function startDevServer(projectPath: string, port: number): Promise<{ port: number; pid: number }> {
  return new Promise((resolve, reject) => {
    console.log('[startDevServer] Spawning npm run dev on port', port);
    console.log('[startDevServer] CWD:', projectPath);

    // Spawn npm run dev in the project directory with PORT env variable
    const child = spawn('npm', ['run', 'dev'], {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });

    const pid = child.pid!;
    console.log('[startDevServer] Process spawned with PID:', pid);

    let portFound = false;
    const timeout = setTimeout(() => {
      if (!portFound) {
        console.log('[startDevServer] TIMEOUT - killing process');
        child.kill();
        reject(new Error('Timeout waiting for server to start (60s)'));
      }
    }, 60000); // 60 second timeout

    // Listen to stdout for localhost URL
    child.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[startDevServer] 📤 stdout:', output.trim());

      // Look for localhost:XXXX pattern
      const urlMatch = output.match(/https?:\/\/localhost:(\d+)/);
      if (urlMatch && !portFound) {
        portFound = true;
        clearTimeout(timeout);
        const port = parseInt(urlMatch[1], 10);
        console.log('[startDevServer] ✅ PORT DETECTED:', port);

        // Unref so the process runs in background
        child.unref();

        resolve({ port, pid });
      }
    });

    // Listen to stderr as well (some servers log to stderr)
    child.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('[startDevServer] 🔴 stderr:', output.trim());

      const urlMatch = output.match(/https?:\/\/localhost:(\d+)/);
      if (urlMatch && !portFound) {
        portFound = true;
        clearTimeout(timeout);
        const port = parseInt(urlMatch[1], 10);
        console.log('[startDevServer] ✅ PORT DETECTED (from stderr):', port);

        child.unref();

        resolve({ port, pid });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[startDevServer] ❌ Process error:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      if (!portFound) {
        clearTimeout(timeout);
        console.error('[startDevServer] ❌ Process exited with code:', code);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
