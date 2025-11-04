# Product Requirements Document: Vibe Workspace

## Executive Summary

**Vibe Workspace** bridges the gap between beginner-friendly web-based AI coding tools (like Lovable, Bolt.new) and powerful but intimidating local development tools (like Cursor, Claude Code). It provides a beautiful, user-friendly web interface running locally that makes Claude Code accessible to beginners while retaining the full power of local development.

**Problem**: Beginners want AI-powered coding but find local development scary (installing Node, running commands, managing git). Web tools are limited because users don't have full code access.

**Solution**: A locally-running Next.js web app with a beautiful UI for common workflows (git commits, server management, project creation) that talks to Claude Code under the hood, powered by a cloud backend that manages authentication, billing, and API proxy.

---

## Product Vision

### Target Users

1. **Vibe Coding Workshop Participants** (Primary)
   - Complete beginners learning to code
   - Scared of terminal/command line
   - Want to build real Next.js websites and Expo mobile apps
   - Need hand-holding but want full code ownership

2. **AI-First Developers** (Secondary)
   - Experienced developers who want faster workflows
   - Use Claude Code daily for commits, code generation
   - Want a polished UI instead of terminal commands
   - Example: "I'd use this to generate commit messages!"

### Core Value Propositions

- **No Terminal Fear**: Beautiful UI replaces scary terminal commands
- **Full Code Access**: Unlike web tools, you own and control all code locally
- **Powered by Claude Code**: Leverage the full power of Claude's coding abilities
- **Workshop-Ready**: Install with one command, start building immediately
- **Professional Tool**: Works for beginners AND experienced developers

---

## Architecture Overview

### Two-Server Architecture

#### 1. Local Next.js App (The Tool)
**Location**: User's computer (localhost:3000 or similar)
**Installation**: Via `npx create-vibe-workspace` or `sh | curl install.sh`
**Purpose**: Beautiful UI for local development workflows

**Responsibilities**:
- Provide user-friendly UI for common workflows
- Execute local commands via Next.js API routes
- Manage project configurations and paths
- Communicate with cloud backend for AI features
- Store auth token from cloud backend

**Key Features**:
- Button-based workflows (no terminal needed)
- Project management (multiple projects with paths)
- Easy/Advanced modes (hide/show technical details)
- Real-time logs and command output
- Update checking and notifications

#### 2. Cloud Backend (Vercel Next.js)
**Location**: Hosted on Vercel (vibe-coders.app)
**Purpose**: Landing page, auth, proxy, billing

**Routing**:
- `/` - Public landing page
- `/home` - Authenticated user dashboard (create API keys, manage subscription)
- `/home/create` - Create new API key for local app
- `/api/proxy/*` - Claude API proxy endpoints

**Responsibilities**:
- Marketing landing page (/)
- Clerk authentication (sign up, sign in, user management)
- Generate and validate auth tokens for local app
- Proxy Claude API requests (hide ANTHROPIC_API_KEY)
- Rate limiting and usage tracking
- Subscription management
- Basic analytics (requests per user)
- User data storage (Supabase)

---

## Detailed Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Local Next.js App (localhost:3000)              │    │
│  │                                                          │    │
│  │  [Project A] [Project B] [Project C]                    │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │  📱 UI Components                        │           │    │
│  │  │  • Commit Button                         │           │    │
│  │  │  • Restart Server Button                 │           │    │
│  │  │  • Open Localhost Button                 │           │    │
│  │  │  • Create Project Button                 │           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                    ↓                                     │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │  🔧 Next.js API Routes                   │           │    │
│  │  │  • /api/execute-command                  │           │    │
│  │  │  • /api/projects                         │           │    │
│  │  │  • /api/check-version                    │           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                    ↓                                     │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │  💻 Command Executor                     │           │    │
│  │  │  exec(`claude -p "commit"`)              │           │    │
│  │  │  • Runs in project directory             │           │    │
│  │  │  • Captures stdout/stderr                │           │    │
│  │  │  • Returns formatted results             │           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                    ↓                                     │    │
│  │         Claude CLI (with proxy config)                  │    │
│  │         ANTHROPIC_BASE_URL=vercel-backend.com           │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    ┌──────────────────┐
                    │   HTTPS Request   │
                    │   + Auth Token    │
                    └──────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              Cloud Backend (Vercel Next.js)                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  🌐 Landing Page                                        │    │
│  │  • Marketing site                                       │    │
│  │  • Pricing ($20/month, BYOK free)                      │    │
│  │  • Documentation                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  🔐 Authentication                                      │    │
│  │  • Clerk authentication (sign up/sign in)              │    │
│  │  • Generate API keys for local app                     │    │
│  │  • Validate tokens on each request                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  🔄 Claude API Proxy (from proxy.js)                   │    │
│  │  • Validate auth token                                  │    │
│  │  • Check rate limits                                    │    │
│  │  • Check subscription status                            │    │
│  │  • Forward to api.anthropic.com                        │    │
│  │  • Track usage in Supabase                             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  💳 Subscription Management                             │    │
│  │  • Stripe integration                                   │    │
│  │  • Usage dashboard                                      │    │
│  │  • Token limits                                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  📊 Supabase Database                                   │    │
│  │  • users (email, auth_token, created_at)               │    │
│  │  • subscriptions (user_id, plan, status)               │    │
│  │  • usage (user_id, tokens, requests, date)             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### First-Time Setup Flow

```
1. User visits landing page (vibe-coders.app)
2. Clicks "Get Started"
3. Shown installation command:
   → curl -fsSL vibe-coders.app/install | sh

4. User runs command in terminal
5. Script:
   - Detects OS (Mac/Linux/Windows WSL)
   - Checks for Node.js, Git, Claude CLI
   - Auto-installs missing dependencies (with permission)
   - Downloads Vibe Coders from GitHub
   - Installs dependencies
   - Starts local Next.js dev server
   - Opens browser to localhost:3000

6. Local app loads, shows key selection screen:
   ┌─────────────────────────────────────────┐
   │ Welcome to Vibe Coders!                 │
   │                                          │
   │ Choose your API key option:              │
   │                                          │
   │ ○ Bring Your Own Key (Free)             │
   │   Enter your Anthropic API key          │
   │   [ Input field for API key ]           │
   │                                          │
   │ ○ Use Vibe Coders Key ($20/month)       │
   │   Sign up at vibe-coders.app            │
   │   [Create Account] → vibe-coders.app/home/create
   │                                          │
   │ [Continue]                               │
   └─────────────────────────────────────────┘

7a. If BYOK selected:
    - User enters their Anthropic API key
    - Key stored in localStorage
    - Redirects to /home in local app

7b. If cloud key selected:
    - User clicks link to vibe-coders.app
    - Signs up with Clerk (email/Google/GitHub)
    - Redirected to /home on vibe-coders.app
    - Creates API key via /home/create
    - Copies key
    - Returns to localhost:3000
    - Enters key in local app
    - Key stored in localStorage
    - Redirects to /home in local app

8. Local app home screen shown with project management
```

### Adding a Project Flow

```
1. User clicks "Add Project"
2. Dialog appears:
   - Option A: "Browse for existing project"
   - Option B: "Create new project"

3A. Browse for existing:
   - File picker opens
   - User selects project folder
   - App validates (checks for package.json, etc.)
   - Project added to list

3B. Create new project:
   - User enters project name
   - Selects template:
     * Next.js App
     * Expo Mobile App
     * Custom (empty)
   - User selects location
   - App executes creation command
   - Project added to list
```

### Git Commit Workflow (MVP)

```
1. User selects active project from list
2. User clicks "Commit" button
3. UI shows loading state
4. Local app:
   - Calls /api/execute-command
   - API route executes: exec(`cd ${projectPath} && claude -p "Generate commit"`)
   - Claude CLI configured with ANTHROPIC_BASE_URL=vercel-backend.com
   - Request goes to Vercel proxy

5. Vercel backend:
   - Receives request with auth token
   - Validates token → finds user in Supabase
   - Checks subscription status
   - Checks rate limits
   - Increments usage counter
   - Forwards to api.anthropic.com with ANTHROPIC_API_KEY

6. Anthropic responds → Vercel forwards → Claude CLI processes
7. Claude generates commit message and creates commit
8. Output returned to local app
9. UI shows success:
   - "✅ Commit created: 'feat: add user authentication'"
   - Shows git log in Advanced mode
```

### BYOK (Bring Your Own Key) Flow

```
1. User selects BYOK plan
2. Prompted to enter Anthropic API key
3. Key stored securely in local app config
4. When making Claude requests:
   - Local app still uses Vercel proxy
   - BUT passes custom header: x-user-api-key
   - Vercel proxy uses THAT key instead of shared key
   - No billing/usage tracking (user pays Anthropic directly)
```

---

## MVP Feature Set

### Local Next.js App (MVP)

#### Core Features
1. **Authentication**
   - Login with Google (via Vercel backend)
   - Store auth token locally
   - Token refresh handling

2. **Project Management**
   - Add existing project (file picker)
   - List all projects
   - Select active project
   - Remove project
   - Store project paths in local state

3. **Single Workflow: Git Commit**
   - "Commit" button
   - Executes: `claude -p "Generate git commit and push"`
   - Shows loading state
   - Shows success/error
   - Shows commit message in Advanced mode

4. **UI Modes**
   - Easy Mode (default): Clean, minimal
   - Advanced Mode: Shows logs, terminal output, technical details
   - Toggle in settings

5. **Settings**
   - Auth token display (masked)
   - Current subscription plan
   - Usage stats (requests this month)
   - Mode toggle (Easy/Advanced)
   - Version info
   - Update checker

#### UI Components (MVP)
```
┌─────────────────────────────────────────────────────┐
│  Vibe Workspace                      [⚙️ Settings]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Projects                                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📁 my-nextjs-app          [Active]           │  │
│  │    /Users/you/projects/my-nextjs-app         │  │
│  ├──────────────────────────────────────────────┤  │
│  │ 📱 my-expo-app                                │  │
│  │    /Users/you/projects/my-expo-app           │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [+ Add Project]                                     │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  Quick Actions                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │                                                │  │
│  │         [💾 Generate Commit & Push]           │  │
│  │                                                │  │
│  │  Analyzes changes and creates a commit        │  │
│  │                                                │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  [Advanced Mode] ← Toggle                            │
│                                                      │
│  📊 Output                                           │
│  ┌──────────────────────────────────────────────┐  │
│  │ $ claude -p "Generate commit"                 │  │
│  │                                                │  │
│  │ Analyzing git changes...                      │  │
│  │ Created commit: "feat: add user auth"         │  │
│  │ Pushed to origin/main                         │  │
│  │                                                │  │
│  │ ✅ Done in 3.2s                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Cloud Backend (MVP)

#### Core Features

1. **Landing Page**
   - Hero section with demo video
   - Feature highlights
   - Pricing table
   - **One-command installation** (prominent)
   - Documentation links

**Landing Page Installation Section**:
```
┌─────────────────────────────────────────────────┐
│                                                  │
│           Get Started in Seconds                │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │                                         │    │
│  │  curl -fsSL vibeworkspace.com/install  │    │
│  │                                     | sh│    │
│  │                                         │    │
│  │               [Copy Command]            │    │
│  └────────────────────────────────────────┘    │
│                                                  │
│  Works on Mac, Linux, and Windows (WSL)        │
│  Automatically installs everything you need     │
│                                                  │
└─────────────────────────────────────────────────┘
```

2. **Authentication**
   - Google OAuth setup
   - Token generation (JWT)
   - Token validation middleware
   - User creation in Supabase

3. **Claude API Proxy** (Based on proxy.js)
   - Endpoint: `/api/v1/messages` (and other Claude endpoints)
   - Validate auth token
   - Check subscription status
   - Check rate limits
   - Forward to api.anthropic.com
   - Return response
   - Log usage to Supabase

4. **Subscription Management**
   - Stripe integration (basic)
   - Two plans:
     * BYOK (Free)
     * Premium ($20/month unlimited)
   - Webhook handling for payment events
   - Cancel/upgrade flow

5. **Usage Dashboard**
   - Endpoint: `/api/usage`
   - Returns user's usage stats
   - Token count this month
   - Request count
   - Cost estimate (for BYOK users)

#### Database Schema (Supabase)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE NOT NULL,
  auth_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  plan TEXT NOT NULL, -- 'byok' or 'premium'
  status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
  stripe_subscription_id TEXT,
  byok_api_key TEXT, -- encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Usage table
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Rate limiting table
CREATE TABLE rate_limits (
  user_id UUID REFERENCES users(id),
  minute_key TEXT, -- e.g., '2024-11-04:21:30'
  count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, minute_key)
);
```

---

## Technical Implementation Details

### Installation Script Hosting Strategy

**Primary Installation Method**: Shell script served from custom domain

**User runs**:
```bash
curl -fsSL vibeworkspace.com/install | sh
```

#### Hosting Architecture

**Option 1: GitHub + Domain Proxy (Recommended)**

```
Source of Truth: GitHub Repository
https://github.com/yourusername/vibe-workspace-installer

Script Location:
├── install.sh (main installation script)
├── install-mac.sh (Mac-specific helper)
├── install-linux.sh (Linux-specific helper)
└── README.md (installation docs)

Served via:
vibeworkspace.com/install → Proxies to GitHub raw URL
https://raw.githubusercontent.com/yourusername/vibe-workspace-installer/main/install.sh
```

**Benefits**:
- ✅ Version control in Git
- ✅ Users can inspect script before running (GitHub)
- ✅ Clean, branded URL
- ✅ Easy to update (just commit to repo)
- ✅ Transparent and trustworthy
- ✅ Can have separate repo from main app

**Implementation** (Next.js API Route):
```typescript
// pages/install.tsx or pages/api/install.ts
export default async function handler(req, res) {
  // Fetch latest install script from GitHub
  const GITHUB_RAW_URL =
    'https://raw.githubusercontent.com/yourusername/vibe-workspace-installer/main/install.sh';

  const response = await fetch(GITHUB_RAW_URL);
  const script = await response.text();

  // Set correct headers for shell script
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.setHeader('Content-Disposition', 'inline; filename="install.sh"');

  // Serve the script
  res.status(200).send(script);
}
```

**Alternative: Direct GitHub URL** (Simpler)
```
Users can also run:
curl -fsSL https://raw.githubusercontent.com/yourusername/vibe-workspace-installer/main/install.sh | sh

But we recommend the branded URL for marketing/simplicity.
```

#### Repository Structure

**Recommended Setup**: Two separate repos

1. **vibe-workspace-installer** (Public)
   - Contains: install.sh, documentation
   - Purpose: Installation scripts only
   - Public so users can inspect before running
   - Clean, focused repo

2. **vibe-workspace** (Public or Private)
   - Contains: Actual Next.js app code
   - Purpose: The local app itself
   - Cloned by install.sh during installation

**Why separate repos?**
- ✅ Clear separation of concerns
- ✅ Install script can be public even if app is private
- ✅ Easier to maintain and version
- ✅ Users can star/fork installer repo for trust

#### Installation Flow Diagram

```
User runs: curl -fsSL vibeworkspace.com/install | sh
                    ↓
         ┌──────────────────────┐
         │  Vercel Next.js      │
         │  /install route      │
         └──────────────────────┘
                    ↓
         Fetches from GitHub:
         ┌──────────────────────┐
         │  GitHub Raw URL      │
         │  install.sh          │
         └──────────────────────┘
                    ↓
         Returns script to user
                    ↓
         User's shell executes:
         ┌──────────────────────┐
         │  1. Check deps       │
         │  2. Install missing  │
         │  3. Clone app repo   │
         │  4. npm install      │
         │  5. Start app        │
         └──────────────────────┘
```

#### Versioning Strategy

**Script versions can be pinned**:
```bash
# Latest (rolling)
curl -fsSL vibeworkspace.com/install | sh

# Specific version (for stability)
curl -fsSL vibeworkspace.com/install/v1.2.0 | sh

# Or from GitHub directly
curl -fsSL https://raw.githubusercontent.com/yourusername/vibe-workspace-installer/v1.2.0/install.sh | sh
```

**Implementation**:
```typescript
// pages/install/[version].tsx
export default async function handler(req, res) {
  const { version } = req.query;
  const tag = version || 'main'; // default to latest

  const url = `https://raw.githubusercontent.com/yourusername/vibe-workspace-installer/${tag}/install.sh`;

  const response = await fetch(url);
  if (!response.ok) {
    return res.status(404).send('Version not found');
  }

  const script = await response.text();
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.status(200).send(script);
}
```

### Local App Installation Script

**Smart Installation Script** - Auto-detects and installs missing dependencies

```bash
#!/bin/bash
# install.sh
# Vibe Workspace Installer
# https://github.com/yourusername/vibe-workspace-installer

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🚀 Installing Vibe Workspace..."
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TYPE=Linux;;
    Darwin*)    OS_TYPE=Mac;;
    CYGWIN*|MINGW*|MSYS*) OS_TYPE=Windows;;
    *)          OS_TYPE="UNKNOWN"
esac

echo "📍 Detected OS: $OS_TYPE"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"
    HAS_NODE=true
else
    echo -e "${RED}❌ Node.js not found${NC}"
    HAS_NODE=false
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✅ Git installed: $GIT_VERSION${NC}"
    HAS_GIT=true
else
    echo -e "${RED}❌ Git not found${NC}"
    HAS_GIT=false
fi

# Check Claude CLI
if command -v claude &> /dev/null; then
    echo -e "${GREEN}✅ Claude CLI installed${NC}"
    HAS_CLAUDE=true
else
    echo -e "${RED}❌ Claude CLI not found${NC}"
    HAS_CLAUDE=false
fi

echo ""

# Function to install Node.js
install_node() {
    echo -e "${BLUE}📦 Installing Node.js...${NC}"

    if [ "$OS_TYPE" = "Mac" ]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo -e "${YELLOW}Homebrew not found. Installing Homebrew first...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            brew install node
        fi
    elif [ "$OS_TYPE" = "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            echo "Installing Node.js via apt-get..."
            sudo apt-get update
            sudo apt-get install -y nodejs npm
        elif command -v yum &> /dev/null; then
            echo "Installing Node.js via yum..."
            sudo yum install -y nodejs npm
        else
            echo -e "${RED}Could not auto-install Node.js.${NC}"
            echo "Please install manually from: https://nodejs.org/"
            exit 1
        fi
    else
        echo -e "${RED}Unsupported OS for auto-install.${NC}"
        echo "Please install Node.js manually from: https://nodejs.org/"
        exit 1
    fi

    echo -e "${GREEN}✅ Node.js installed!${NC}"
}

# Function to install Git
install_git() {
    echo -e "${BLUE}📦 Installing Git...${NC}"

    if [ "$OS_TYPE" = "Mac" ]; then
        if command -v brew &> /dev/null; then
            brew install git
        else
            echo -e "${YELLOW}Homebrew not found. Installing Homebrew first...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            brew install git
        fi
    elif [ "$OS_TYPE" = "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get install -y git
        elif command -v yum &> /dev/null; then
            sudo yum install -y git
        fi
    else
        echo -e "${RED}Could not auto-install Git.${NC}"
        echo "Please install manually from: https://git-scm.com/"
        exit 1
    fi

    echo -e "${GREEN}✅ Git installed!${NC}"
}

# Install missing dependencies
if [ "$HAS_NODE" = false ]; then
    echo -e "${YELLOW}Node.js is required. Attempting to install...${NC}"
    install_node
    echo ""
fi

if [ "$HAS_GIT" = false ]; then
    echo -e "${YELLOW}Git is required. Attempting to install...${NC}"
    install_git
    echo ""
fi

# Install Claude CLI if missing
if [ "$HAS_CLAUDE" = false ]; then
    echo -e "${YELLOW}Installing Claude CLI...${NC}"
    npm install -g @anthropics/claude-code
    echo -e "${GREEN}✅ Claude CLI installed!${NC}"
    echo ""
fi

# Clone/Update the Vibe Workspace app
INSTALL_DIR="$HOME/.vibe-workspace"
echo -e "${BLUE}📦 Installing Vibe Workspace to $INSTALL_DIR...${NC}"
echo ""

if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Existing installation found. Updating..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "📥 Downloading from GitHub..."
    git clone https://github.com/yourusername/vibe-workspace.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo ""
echo -e "${BLUE}📚 Installing app dependencies...${NC}"
npm install --silent

# Build the app
echo ""
echo -e "${BLUE}🔨 Building application...${NC}"
npm run build

# Create global command (optional)
if [ -f "$INSTALL_DIR/bin/vibe" ]; then
    echo ""
    echo -e "${BLUE}🔗 Creating global 'vibe' command...${NC}"

    # Make script executable
    chmod +x "$INSTALL_DIR/bin/vibe"

    # Create symlink (may require sudo on some systems)
    if ln -sf "$INSTALL_DIR/bin/vibe" /usr/local/bin/vibe 2>/dev/null; then
        echo -e "${GREEN}✅ Global command created!${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not create global command (may need sudo)${NC}"
        echo "You can run the app directly with: cd ~/.vibe-workspace && npm start"
    fi
fi

# Success!
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                ✅ Installation Complete!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "🎉 Vibe Workspace is ready to use!"
echo ""
echo "Starting the application..."
echo ""

# Start the app
cd "$INSTALL_DIR"
npm run start

# Alternative: if you created global command
# vibe
```

**Key Features of This Script**:

1. **OS Detection** - Automatically detects Mac, Linux, Windows WSL
2. **Dependency Checking** - Checks for Node.js, Git, Claude CLI
3. **Auto-Installation** - Installs missing dependencies automatically
4. **Homebrew Handling** - Installs Homebrew on Mac if needed
5. **Update Support** - Re-running script updates existing installation
6. **Color Output** - Beautiful colored terminal output
7. **Global Command** - Creates `vibe` command (optional)
8. **Error Handling** - Graceful failures with helpful messages

### Command Execution (Local API Route)

```typescript
// pages/api/execute-command.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { command, projectPath } = req.body;

  // Security: whitelist allowed commands
  const allowedCommands = [
    'claude -p',
    'npm run dev',
    'npm run build',
    'git status',
    'git log',
  ];

  const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Command not allowed' });
  }

  try {
    // Set environment variables for Claude CLI
    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: 'https://vibeworkspace.com/api/proxy',
      ANTHROPIC_AUTH_TOKEN: req.headers['x-auth-token'], // Forward user token
    };

    const { stdout, stderr } = await execPromise(command, {
      cwd: projectPath,
      env,
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    return res.status(200).json({
      success: true,
      stdout,
      stderr,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    });
  }
}
```

### Claude Proxy (Vercel Backend)

```typescript
// pages/api/proxy/[...path].ts
// This is the proxy.js we just built, integrated into Next.js

import { createProxyMiddleware } from 'http-proxy-middleware';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // 1. Validate auth token
  const authToken = req.headers['x-auth-token'] ||
                    req.headers['authorization']?.replace('Bearer ', '');

  if (!authToken) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  // 2. Look up user
  const { data: user, error } = await supabase
    .from('users')
    .select('*, subscriptions(*)')
    .eq('auth_token', authToken)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  // 3. Check subscription
  const subscription = user.subscriptions[0];
  if (!subscription || subscription.status !== 'active') {
    return res.status(403).json({ error: 'No active subscription' });
  }

  // 4. Determine which API key to use
  let apiKey;
  if (subscription.plan === 'byok') {
    // Use user's own API key
    apiKey = decrypt(subscription.byok_api_key);
  } else {
    // Use shared API key
    apiKey = process.env.ANTHROPIC_API_KEY;
  }

  // 5. Check rate limits (for premium users)
  if (subscription.plan === 'premium') {
    const now = new Date();
    const minuteKey = `${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM

    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('user_id', user.id)
      .eq('minute_key', minuteKey)
      .single();

    if (rateLimit && rateLimit.count > 60) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Increment rate limit
    await supabase.rpc('increment_rate_limit', {
      p_user_id: user.id,
      p_minute_key: minuteKey,
    });
  }

  // 6. Forward request to Anthropic
  const anthropicPath = req.url.replace('/api/proxy', '');
  const anthropicUrl = `https://api.anthropic.com${anthropicPath}`;

  const response = await fetch(anthropicUrl, {
    method: req.method,
    headers: {
      'x-api-key': apiKey,
      'content-type': req.headers['content-type'],
      'anthropic-version': req.headers['anthropic-version'],
      'anthropic-beta': req.headers['anthropic-beta'],
    },
    body: req.method !== 'GET' ? await getRawBody(req) : undefined,
  });

  // 7. Track usage (for billing)
  if (response.ok && subscription.plan === 'premium') {
    const responseData = await response.json();
    if (responseData.usage) {
      await supabase.rpc('track_usage', {
        p_user_id: user.id,
        p_input_tokens: responseData.usage.input_tokens,
        p_output_tokens: responseData.usage.output_tokens,
      });
    }
  }

  // 8. Return response
  return res.status(response.status).json(await response.json());
}
```

---

## Update Mechanism

### Version Checking

```typescript
// Local app checks for updates on startup
// pages/api/check-version.ts

export default async function handler(req, res) {
  const currentVersion = require('../../package.json').version;

  // Fetch latest version from GitHub releases or Vercel endpoint
  const latestVersion = await fetch('https://vibeworkspace.com/api/latest-version')
    .then(r => r.json());

  if (latestVersion.version !== currentVersion) {
    return res.json({
      updateAvailable: true,
      currentVersion,
      latestVersion: latestVersion.version,
      releaseNotes: latestVersion.notes,
    });
  }

  return res.json({
    updateAvailable: false,
    currentVersion,
  });
}
```

### Update Flow

```
1. App checks version on startup
2. If update available:
   - Shows banner: "Update available! v1.2.0 → v1.3.0"
   - Click banner → shows release notes
   - "Update Now" button
   - Runs: npx create-vibe-workspace@latest --update
3. Script re-runs installation (git pull, npm install, etc.)
4. Restarts app
```

---

## Non-Functional Requirements

### Performance
- Local app startup: < 3 seconds
- Command execution: < 10 seconds (depends on Claude)
- Proxy latency: < 200ms overhead
- UI responsiveness: 60fps

### Security
- Auth tokens: JWT with expiration
- BYOK API keys: Encrypted at rest (AES-256)
- HTTPS only for all cloud communication
- Input sanitization for all executed commands
- Command whitelist (no arbitrary shell commands)

### Reliability
- Proxy uptime: 99.9%
- Error recovery for failed commands
- Graceful handling of network failures
- Local data persistence (projects, settings)

### Scalability
- Support 10,000+ concurrent users (cloud)
- Database query optimization
- CDN for static assets
- Rate limiting per user

---

## Future Features (Post-MVP)

### Phase 2: More Workflows
- "Restart Dev Server" button
- "Open in Browser" button
- "Run Tests" button
- "Deploy to Vercel" button
- "Fix Linting Errors" button

### Phase 3: Project Creation
- Built-in templates
- One-click "Create Next.js App"
- One-click "Create Expo App"
- Template marketplace

### Phase 4: GitHub Integration
- OAuth with GitHub
- Auto-setup SSH keys
- Create repos from UI
- PR creation and management
- Issue tracking

### Phase 5: Advanced Features
- VS Code extension
- Real-time collaboration
- AI pair programming chat
- Custom workflow builder
- Terminal view (for advanced mode)
- Deployment history
- Rollback capabilities

### Phase 6: Enterprise
- Team workspaces
- Shared projects
- Usage analytics per team
- Custom AI prompts/templates
- SSO integration

---

## Success Metrics

### MVP Success Criteria
- 100 workshop participants successfully install and use
- 90%+ complete first git commit without terminal
- < 5% support requests about installation
- Average session duration > 15 minutes

### Business Metrics
- Monthly Active Users (MAU)
- Conversion rate: Free → Premium
- Average revenue per user (ARPU): $20
- Churn rate: < 5%/month
- Net Promoter Score (NPS): > 50

### Technical Metrics
- Proxy uptime: 99.9%
- Average response time: < 2s
- Error rate: < 1%
- Version adoption rate: > 80% within 1 week of release

---

## Development Roadmap

### Milestone 1: Foundation (Week 1-2)
- [ ] Set up Vercel backend Next.js project
- [ ] Set up local Next.js app project
- [ ] Set up Supabase database
- [ ] Implement basic authentication (Google OAuth)
- [ ] Integrate proxy.js into Vercel backend
- [ ] Test end-to-end proxy flow

### Milestone 2: Local App Core (Week 3-4)
- [ ] Build project management UI
- [ ] Implement project add/remove
- [ ] Build "Commit" button workflow
- [ ] Implement command execution API route
- [ ] Add loading states and error handling
- [ ] Test with real Claude Code

### Milestone 3: Cloud Features (Week 5-6)
- [ ] Build landing page
- [ ] Implement subscription management
- [ ] Integrate Stripe
- [ ] Build usage dashboard
- [ ] Implement rate limiting
- [ ] Add usage tracking

### Milestone 4: Polish & Testing (Week 7-8)
- [ ] Easy/Advanced mode UI
- [ ] Installation script
- [ ] Update mechanism
- [ ] Comprehensive error handling
- [ ] User onboarding flow
- [ ] Documentation
- [ ] Beta testing with workshop participants

### Milestone 5: Launch (Week 9)
- [ ] Final testing
- [ ] Deploy to production
- [ ] Launch landing page
- [ ] First workshop!

---

## Open Questions & Decisions Needed

1. **Project Name**: "Vibe Workspace" or something else?
2. **Domain**: vibeworkspace.com available?
3. **Pricing**: Is $20/month the right price point?
4. **Installation**: NPM package name? (@vibe/workspace?)
5. **Branding**: Logo, colors, design system?
6. **Documentation**: Separate docs site or built into landing page?
7. **Support**: Discord community? Email support? In-app chat?

---

## Risks & Mitigation

### Technical Risks

**Risk**: Claude API changes break the proxy
**Mitigation**: Version lock Anthropic SDK, monitor API changes, automated testing

**Risk**: Command execution security vulnerabilities
**Mitigation**: Strict command whitelist, input sanitization, security audit

**Risk**: Local installation fails on different OS (Windows/Mac/Linux)
**Mitigation**: Test on all platforms, provide OS-specific install scripts

### Business Risks

**Risk**: Users prefer pure web tools (no local install)
**Mitigation**: Emphasize benefits of local dev, make install seamless

**Risk**: $20/month too expensive for beginners
**Mitigation**: Keep BYOK free option, add free tier with limits

**Risk**: Anthropic rate limits or costs too high
**Mitigation**: Implement aggressive rate limiting, optimize prompts, increase price if needed

### User Experience Risks

**Risk**: Users still scared despite UI
**Mitigation**: Extensive onboarding, video tutorials, hand-holding in workshops

**Risk**: GitHub not configured (MVP assumes it is)
**Mitigation**: Detect and show clear setup guide, future: automate setup

---

## Appendix

### Tech Stack Summary

**Local App**:
- Next.js 16 (App Router)
- React 19.2
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Node.js child_process for command execution
- localStorage for key storage

**Cloud Backend**:
- Next.js 16 on Vercel (with Turbopack)
- React 19.2
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Supabase (PostgreSQL)
- Stripe for payments
- Clerk authentication

**Infrastructure**:
- Vercel (hosting)
- Supabase (database)
- GitHub (code hosting)
- Cloudflare (CDN/DNS)

### Repository Structure

**Two GitHub Repositories**:

1. **vibe-workspace-installer** (Public)
   - Purpose: Installation scripts only
   - Location: `https://github.com/yourusername/vibe-workspace-installer`
   - Contains:
     * `install.sh` - Main installation script
     * `README.md` - Installation documentation
     * Version tags for stability
   - Why public: Users can inspect script before running (security/trust)

2. **vibe-workspace** (Public or Private)
   - Purpose: The actual local Next.js app
   - Location: `https://github.com/yourusername/vibe-workspace`
   - Contains:
     * Local Next.js application code
     * UI components
     * API routes for command execution
     * Project management logic
   - Cloned by `install.sh` during installation to `~/.vibe-workspace`

3. **vibe-workspace-backend** (Optional - could be same repo as landing page)
   - Purpose: Vercel-hosted backend
   - Contains:
     * Landing page
     * `/install` route (proxies to GitHub)
     * Claude API proxy (from proxy.js)
     * Authentication
     * Subscription management

**Installation Script Hosting**:
- **Source**: GitHub (`vibe-workspace-installer` repo)
- **Served via**: `vibeworkspace.com/install` (Vercel route that proxies to GitHub raw URL)
- **Why this approach**:
  - Version control in Git
  - Users can inspect source on GitHub
  - Clean, branded URL for marketing
  - Easy updates (commit to repo)
  - Can pin versions for stability

### Key Dependencies
- `@anthropic-ai/sdk` - Claude API client
- `stripe` - Payment processing
- `@supabase/supabase-js` - Database client
- `next-auth` - Authentication
- `zod` - Runtime validation
- `swr` - Data fetching

---

## Conclusion

**Vibe Workspace** bridges the gap between beginner-friendly and powerful by providing a beautiful local UI for Claude Code. It eliminates terminal fear while maintaining full local development capabilities.

The two-server architecture (local UI + cloud proxy) enables:
- Easy installation and updates
- Full code ownership
- Hidden API key management
- Subscription billing
- Beginner-friendly workflows

MVP focuses on proving the core concept with a single workflow (git commits) before expanding to more features.

**Next Steps**:
1. Finalize project name and branding
2. Set up repositories (local app + cloud backend)
3. Begin Milestone 1 development
4. Schedule first workshop for beta testing

---

*Document Version: 1.0*
*Last Updated: 2025-11-04*
*Author: Based on conversation with papay0*
