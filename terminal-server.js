const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const os = require('os');
const net = require('net');

// Allow port to be configured via environment variable
// Use a unique port that's unlikely to conflict with common dev servers
const PORT = process.env.TERMINAL_PORT || 3475;

// Function to check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
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

// Start server on available port
async function startServer() {
  let currentPort = parseInt(PORT);

  // Try up to 50 ports to find an available one
  for (let i = 0; i < 50; i++) {
    const portToTry = currentPort + i;
    const available = await isPortAvailable(portToTry);

    if (available) {
      try {
        const wss = new WebSocketServer({ port: portToTry });
        console.log(`✓ Terminal WebSocket server running on ws://localhost:${portToTry}`);
        if (portToTry !== parseInt(PORT)) {
          console.log(`  (Port ${PORT} was in use, using ${portToTry} instead)`);
        }

        setupWebSocketServer(wss);
        return;
      } catch (err) {
        // Port might have been taken between check and creation, try next
        console.log(`  Port ${portToTry} taken, trying next...`);
      }
    }
  }

  console.error(`✗ Could not find an available port between ${PORT} and ${currentPort + 50}`);
  process.exit(1);
}

function setupWebSocketServer(wss) {

wss.on('connection', (ws, req) => {
  console.log('New terminal connection');

  // Parse project path from URL query params
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectPath = url.searchParams.get('path') || os.homedir();
  const projectId = url.searchParams.get('project') || 'default';
  const autoCommand = url.searchParams.get('cmd');

  // Create sanitized session name from project ID
  const sessionName = `vibe-${projectId}`;

  // Determine shell based on OS
  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';

  // Check if tmux is available
  const { execSync } = require('child_process');
  let useTmux = false;
  try {
    execSync('which tmux', { stdio: 'ignore' });
    useTmux = true;
  } catch (err) {
    console.log('⚠️  tmux not found - sessions will NOT persist when you navigate away');
    console.log('   Install tmux: brew install tmux (macOS) or apt install tmux (Linux)');
  }

  let ptyProcess;
  let isExistingSession = false;

  if (useTmux) {
    // Try to attach to existing tmux session, or create new one
    try {
      execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, { stdio: 'ignore' });

      // Check if the session has any windows/panes running
      try {
        const windowCount = execSync(`tmux list-windows -t ${sessionName} 2>/dev/null | wc -l`, { encoding: 'utf-8' }).trim();
        if (windowCount === '0') {
          // Session exists but is empty, kill it and create new one
          console.log(`Tmux session ${sessionName} is empty, recreating...`);
          execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`, { stdio: 'ignore' });
          throw new Error('Session was empty');
        }
      } catch (err) {
        // If we can't check or session is empty, recreate it
        throw new Error('Session needs recreation');
      }

      console.log(`Attaching to existing tmux session: ${sessionName}`);
      isExistingSession = true;
      // Session exists and has content, attach to it
      ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: process.env,
      });

      // Ensure mouse mode is enabled on existing session too
      setTimeout(() => {
        try {
          execSync(`tmux set-option -t ${sessionName} -g mouse on 2>/dev/null`, { stdio: 'ignore' });
          console.log(`✓ Enabled mouse mode for existing session: ${sessionName}`);
        } catch (e) {
          console.log(`⚠️  Could not enable mouse mode for ${sessionName}`);
        }
      }, 500);
    } catch (err) {
      console.log(`Creating new tmux session: ${sessionName} in ${projectPath}`);
      isExistingSession = false;
      // Session doesn't exist or needs recreation, create it
      const tmuxArgs = autoCommand
        ? ['new-session', '-s', sessionName, '-c', projectPath, autoCommand]
        : ['new-session', '-s', sessionName, '-c', projectPath];

      ptyProcess = pty.spawn('tmux', tmuxArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: process.env,
      });

      // Enable mouse mode after session creation (works for both cases)
      setTimeout(() => {
        try {
          execSync(`tmux set-option -t ${sessionName} -g mouse on 2>/dev/null`, { stdio: 'ignore' });
          console.log(`✓ Enabled mouse mode for tmux session: ${sessionName}`);
        } catch (e) {
          console.log(`⚠️  Could not enable mouse mode for ${sessionName}`);
        }
      }, 1000);
    }
  } else {
    // Fallback to regular shell without persistence
    // If autoCommand is provided, execute it directly
    if (autoCommand) {
      ptyProcess = pty.spawn(shell, ['-c', autoCommand], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: process.env,
      });
    } else {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: process.env,
      });
    }
  }

  console.log(`Terminal spawned with PID ${ptyProcess.pid} in ${projectPath}${autoCommand ? ` (running: ${autoCommand})` : ''}`);

  // Send data from PTY to WebSocket
  ptyProcess.onData((data) => {
    try {
      ws.send(data);
    } catch (err) {
      console.error('Error sending data to WebSocket:', err);
    }
  });

  // Send data from WebSocket to PTY
  ws.on('message', (msg) => {
    try {
      const msgStr = msg.toString();

      // Check if it's a control message (JSON)
      if (msgStr.startsWith('{')) {
        try {
          const data = JSON.parse(msgStr);
          if (data.type === 'resize') {
            ptyProcess.resize(data.cols, data.rows);
            return; // Don't send to terminal
          }
        } catch (err) {
          // Not valid JSON, treat as regular input
        }
      }

      // Regular input - send to PTY
      ptyProcess.write(msgStr);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed');

    if (useTmux) {
      // For tmux sessions, we want to detach gracefully rather than kill
      // Send Ctrl+B, D to detach from tmux session
      try {
        ptyProcess.write('\x02d'); // Ctrl+B, then D
        setTimeout(() => {
          if (ptyProcess && !ptyProcess.process.killed) {
            ptyProcess.kill();
          }
        }, 100);
      } catch (err) {
        // Session might already be closed
      }
      console.log(`Detached from tmux session: ${sessionName} (session persists)`);
    } else {
      // For regular shells, kill the process
      ptyProcess.kill();
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Terminal process exited with code ${exitCode}, signal ${signal}`);
    try {
      if (exitCode !== 0) {
        ws.send(`\r\n\x1b[1;31mTerminal process exited with code ${exitCode}\x1b[0m\r\n`);
      }
      // Small delay before closing to ensure last messages are sent
      setTimeout(() => ws.close(), 100);
    } catch (err) {
      ws.close();
    }
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    ptyProcess.kill();
  });
});

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down terminal server...');
    wss.close(() => {
      console.log('Terminal server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer();
