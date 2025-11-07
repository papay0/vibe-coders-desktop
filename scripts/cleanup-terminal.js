// Cleanup script to stop terminal server when Next.js stops
const { exec } = require('child_process');

function killTerminalServer() {
  // Kill any process listening on terminal server ports 3475-3525
  for (let port = 3475; port <= 3525; port++) {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, (error) => {
      if (!error) {
        console.log(`Killed terminal server on port ${port}`);
      }
    });
  }
}

// Handle process termination
process.on('SIGINT', killTerminalServer);
process.on('SIGTERM', killTerminalServer);
process.on('exit', killTerminalServer);

killTerminalServer();
