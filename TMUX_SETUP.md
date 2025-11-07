# Tmux Setup for Terminal Persistence

## Why Tmux?

Tmux (Terminal Multiplexer) enables **persistent terminal sessions**. Without tmux:
- ❌ Closing terminal page kills Claude Code session
- ❌ Navigating away loses all terminal state
- ❌ Each visit starts a fresh session

With tmux:
- ✅ Terminal sessions persist even when you close the page
- ✅ Navigate away and come back - everything is still there
- ✅ One persistent session per project
- ✅ Claude Code keeps running in the background

## Installation

### macOS
```bash
brew install tmux
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install tmux
```

### Linux (Fedora/RHEL)
```bash
sudo dnf install tmux
```

### Windows (WSL)
```bash
sudo apt install tmux
```

## How It Works

When you open a terminal for a project:

1. **First time**: Creates new tmux session `vibe-{project-id}`
2. **Return visits**: Attaches to existing session
3. **Navigate away**: Session stays alive in the background
4. **Come back**: Reconnects to same session with full history

## Session Management

### View all sessions
```bash
tmux list-sessions
```

### Manually attach to a session
```bash
tmux attach-session -t vibe-{project-id}
```

### Kill a specific session
```bash
tmux kill-session -t vibe-{project-id}
```

### Kill all Vibe Coders sessions
```bash
tmux kill-session -t vibe-
```

## Fallback Behavior

If tmux is **not installed**:
- Terminal works normally BUT sessions don't persist
- You'll see a warning in the server logs
- Each visit creates a fresh shell session

## Tmux Basics (Optional)

If you manually attach to a tmux session via terminal:

- **Detach**: `Ctrl+B`, then `D`
- **New window**: `Ctrl+B`, then `C`
- **Switch windows**: `Ctrl+B`, then `0-9`
- **List windows**: `Ctrl+B`, then `W`
- **Scroll mode**: `Ctrl+B`, then `[` (use arrows, `q` to exit)

## Configuration

Default behavior:
- Auto-creates tmux session on first connect
- Auto-attaches on subsequent connects
- Sessions persist indefinitely (until manually killed or system restart)

If you want to customize tmux, create `~/.tmux.conf`:

```bash
# Example: Better mouse support
set -g mouse on

# Example: Use 256 colors
set -g default-terminal "screen-256color"

# Example: Increase scrollback buffer
set -g history-limit 10000
```

## Troubleshooting

### "tmux not found" error
Install tmux using the commands above, then refresh the terminal page.

### Session persists but shows old content
This is expected! The session saved your exact terminal state. You can:
- Clear the screen: `clear` or `Ctrl+L`
- Or just continue where you left off

### Can't reconnect to session
Check if session exists:
```bash
tmux list-sessions
```

If missing, a new one will be created on next visit.

### Want to start fresh
Kill the session manually:
```bash
tmux kill-session -t vibe-{project-id}
```

Or from the web terminal:
```bash
exit  # Exit from tmux (also kills the session if last window)
```

## Benefits for Non-Technical Users

**Automatic - Zero Configuration Required!**

Users don't need to know anything about tmux:
- Sessions are created automatically
- Reconnection is automatic
- Works transparently in the background
- No tmux commands needed

If tmux is installed on the system, everything "just works" with persistence!
