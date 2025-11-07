# Terminal Integration

## Overview

The Vibe Coders Desktop app now includes a fully integrated terminal that runs Claude Code CLI directly in your browser - completely transparent to users!

## How It Works

When a user clicks "Open Terminal" from a project page:

1. **Automatic Server Start**: The app automatically starts a WebSocket terminal server on an available port (3001-3010)
2. **Terminal Opens**: A full xterm.js terminal appears in the browser
3. **Claude Auto-Runs**: The `claude` command is automatically executed in the project directory
4. **Ready to Use**: User can immediately start interacting with Claude Code

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js App (http://localhost:3000)            │
│                                                  │
│  /home/project/[id]/terminal                   │
│  ┌──────────────────────────────────────────┐  │
│  │  React Component                          │  │
│  │  - xterm.js terminal UI                  │  │
│  │  - Auto-starts server via API            │  │
│  │  - Connects via WebSocket                │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                       │
                       │ WebSocket
                       ▼
┌─────────────────────────────────────────────────┐
│  Terminal Server (ws://localhost:3001)          │
│                                                  │
│  - Spawned automatically by API route           │
│  - Uses node-pty for real shell                │
│  - Finds available port automatically          │
│  - Auto-executes 'claude' command              │
└─────────────────────────────────────────────────┘
                       │
                       ▼
              Claude Code CLI Process
              (running in project directory)
```

## Files Created

### Core Implementation
- `/lib/terminal-manager.ts` - Server lifecycle management
- `/app/api/terminal/start/route.ts` - API endpoint to start server
- `/app/home/project/[id]/terminal/page.tsx` - Terminal UI page
- `/terminal-server.js` - WebSocket server with node-pty

### Supporting Files
- `/scripts/cleanup-terminal.js` - Cleanup utility (optional)

### Modified Files
- `/app/home/project/[id]/page.tsx` - Added "Open Terminal" action button
- `/package.json` - Added dependencies and optional terminal-server script

## User Experience

**For Non-Technical Users:**
1. Click "Open Terminal" button
2. Wait 2-3 seconds (shows "Starting terminal server...")
3. Terminal appears with Claude ready to use
4. No commands to run, no configuration needed!

**Features:**
- ✅ Automatic port detection (no conflicts)
- ✅ Runs in project directory
- ✅ Full terminal colors and formatting
- ✅ Resizes with window
- ✅ Clickable links
- ✅ Copy/paste support
- ✅ **Session persistence** (with tmux installed)
- ✅ One persistent session per project

## Technical Details

### Dependencies
- `@xterm/xterm` - Terminal emulator for the browser
- `@xterm/addon-fit` - Auto-resize terminal
- `@xterm/addon-web-links` - Clickable URLs in terminal
- `node-pty` - Pseudo-terminal for Node.js
- `ws` - WebSocket server

### Port Management
The system automatically finds an available port:
- Default: **3475** (chosen to avoid conflicts with common dev servers)
- Fallback: 3476-3525 (tries up to 50 ports)
- Configurable via `TERMINAL_PORT` environment variable
- Smart detection: Won't conflict with your Next.js app or other services

### Security Considerations
- Only spawns terminal in user's project directories
- Uses authenticated routes (Clerk integration)
- Terminal server only accepts WebSocket connections from localhost
- No arbitrary command execution - only spawns configured shell

## Development

### Manual Server Control (Optional)
For development/debugging, you can manually start the terminal server:

```bash
npm run terminal-server
```

But users never need to do this - it starts automatically!

### Environment Variables
Optional configuration in `.env.local`:

```bash
TERMINAL_PORT=3475  # Set specific port for terminal server (default)
```

## Session Persistence (Tmux)

The terminal automatically uses **tmux** for session persistence:

- **If tmux is installed**: Sessions persist when you navigate away
- **If tmux is NOT installed**: Works normally but sessions don't persist

### Installation
```bash
# macOS
brew install tmux

# Linux
sudo apt install tmux
```

See [TMUX_SETUP.md](./TMUX_SETUP.md) for detailed setup instructions.

### How It Works
- Each project gets its own tmux session: `vibe-{project-id}`
- Navigate away → Session stays alive
- Come back → Reconnects to same session
- Everything preserved: command history, running processes, Claude state

## Future Enhancements

Potential improvements:
- Multiple terminal tabs per project
- Custom themes and color schemes
- Terminal sharing/collaboration
- Split panes support
- Integration with file explorer (click file → opens in editor)
- Terminal command palette

## Troubleshooting

### Terminal Won't Connect
- Check browser console for errors
- Ensure port 3475-3525 aren't blocked by firewall
- Try refreshing the page
- Check Next.js server logs for the actual port being used

### "claude" Command Not Found
- User needs to install Claude Code CLI first
- Installation: `curl -fsSL https://claude.ai/install.sh | bash`

### Server Won't Start
- Check if ports 3001-3010 are all in use
- Set custom port via `TERMINAL_PORT` env variable
- Check Next.js logs for errors
