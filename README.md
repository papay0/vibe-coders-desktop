# Vibe Coders Desktop

A desktop application that brings AI-powered coding assistance to your projects. Built with Next.js and powered by Claude Code SDK.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## 🌟 Features

### AI-Powered Project Management
- **Create Projects with AI**: Automatically scaffold new Next.js projects with TypeScript, Tailwind CSS, and shadcn/ui
- **Import Existing Projects**: Bring your existing codebases into the platform
- **Real-time Progress Tracking**: Watch AI work through tasks with live updates

### Quick Actions
- **Start Dev Server**: One-click to install dependencies, start your development server, and open in browser
- **Stop Dev Server**: Safely stop running servers for specific projects
- **Simple/Advanced Mode**: Toggle between beginner-friendly and technical terminology

### Smart Features
- **Auto-port Selection**: Never conflicts with existing servers - automatically finds free ports
- **Project Isolation**: Actions only affect the selected project, not others
- **Progress Visualization**: See exactly what AI is doing with detailed/simple view toggle
- **Breadcrumb Navigation**: Easy navigation through your projects

## 🚀 Getting Started

### Quick Install

Install and run Vibe Coders with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/papay0/vibe-coders-desktop/main/install.sh | bash
```

This will:
- ✓ Check and install dependencies (Git, Node.js 18+, npm)
- ✓ Clone the repository to `~/.vibe-coders/vibe-coders-desktop`
- ✓ Install npm packages
- ✓ Set up the `vibe-coders` CLI tool

After installation, restart your terminal or run:
```bash
source ~/.zshrc  # or ~/.bashrc
```

Then start the app:
```bash
vibe-coders
```

The app will start on **port 3737** (or the next available port if 3737 is in use). You'll see the URL in the terminal output.

### CLI Commands

Once installed, you can use these commands:

```bash
vibe-coders          # Start development server
vibe-coders dev      # Start development server (explicit)
vibe-coders update   # Update to latest version (git pull + npm install)
vibe-coders build    # Build for production
vibe-coders --help   # Show all commands
```

Add `--verbose` to any command to see detailed output:
```bash
vibe-coders --verbose
```

### Manual Installation

If you prefer to install manually:

1. Clone the repository:
```bash
git clone https://github.com/papay0/vibe-coders-desktop.git
cd vibe-coders-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open the URL shown in your terminal (default: [http://localhost:3737](http://localhost:3737))

### Configuration

**No configuration required!** Public API keys for Clerk, Supabase, and Claude are included in the codebase (`lib/config.ts`).

**To use your own keys** (optional), create a `.env.local` file:

```bash
# Clerk Authentication (optional - defaults provided)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Supabase (optional - defaults provided)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Claude Agent SDK (optional - defaults provided)
CLAUDE_CODE_OAUTH_TOKEN=your_oauth_token
```

Environment variables take precedence over hardcoded values.

## 📊 Database Schema

### Projects Table

```sql
create table projects (
  id uuid default gen_random_uuid() primary key,
  clerk_user_id text not null,
  project_name text not null,
  project_path text not null,
  project_type text not null check (project_type in ('import', 'web', 'mobile')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table projects enable row level security;

-- Policy: Users can only see their own projects
create policy "Users can only access their own projects"
  on projects
  for all
  using (auth.uid()::text = clerk_user_id);
```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 16 with App Router, React 19
- **Styling**: Tailwind CSS, shadcn/ui components
- **Authentication**: Clerk (client-side only)
- **Database**: Supabase with Row Level Security
- **AI**: Claude Code SDK (Anthropic)
- **Language**: TypeScript

### Project Structure

```
vibe-coders-desktop/
├── app/
│   ├── api/
│   │   ├── execute-action-stream/   # Generic AI action executor
│   │   ├── git-commit/              # Git operations
│   │   └── select-folder/           # Native folder picker
│   ├── home/
│   │   ├── add-project/             # Project creation flow
│   │   ├── project/[id]/            # Project detail page
│   │   └── projects/                # Projects list
│   └── page.tsx                     # Landing page
├── components/
│   ├── ai-progress-chat.tsx         # Reusable AI chat UI
│   ├── app-sidebar.tsx              # Navigation sidebar
│   └── ui/                          # shadcn components
├── lib/
│   ├── prompts.ts                   # Centralized AI prompts
│   ├── prompts.README.md            # Prompt documentation
│   └── supabase.ts                  # Database client
└── README.md
```

## 🤖 AI Actions

The app uses a centralized prompt management system for AI-powered actions:

### Available Actions

1. **create-web-project**
   - Creates a new Next.js app with TypeScript, Tailwind, and shadcn/ui
   - Automatically initializes git and creates initial commit

2. **start-dev-server**
   - Installs npm dependencies if needed
   - Starts development server on available port
   - Opens project in default browser

3. **kill-server**
   - Finds and stops dev servers for specific project
   - Only affects the target project (safe)

### Adding New Actions

See `lib/prompts.README.md` for detailed instructions on adding new AI actions.

## 🎨 UI/UX Features

### Simple Mode (Default)
Perfect for non-technical users:
- "Open Website" instead of "Start Dev Server"
- "Close Website" instead of "Stop Server"
- Simplified descriptions and terminology

### Advanced Mode
For developers who want technical details:
- Full technical terminology
- Detailed command explanations
- AI execution visibility

### Progress Tracking
- **Simple View**: Only shows AI messages
- **Detailed View**: Shows commands, outputs, and full execution flow
- Real-time streaming updates
- Auto-scroll to latest message

## 🔒 Security

- **Row Level Security**: Each user can only access their own projects
- **Client-side Auth**: Clerk handles authentication securely
- **API Key Protection**: Environment variables keep keys safe
- **Sandboxed Execution**: Claude Code SDK runs in controlled environment
- **Permission Bypass**: Auto-approves safe operations for better UX

## 🤝 Contributing

This is an open-source project! Contributions are welcome.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- Authentication by [Clerk](https://clerk.com/)
- Database by [Supabase](https://supabase.com/)

## 🐛 Known Issues

- Currently only supports macOS for the "open browser" command
- Mobile project creation is coming soon
- Advanced git operations are in development

## 🗺️ Roadmap

- [ ] Mobile app project scaffolding
- [ ] Advanced git operations (push, pull, branch)
- [ ] Code review features
- [ ] Testing automation
- [ ] Deployment workflows
- [ ] Multi-platform support (Windows, Linux)
- [ ] Plugin system for custom actions

## 💬 Support

For questions, issues, or feature requests:
- Open an issue on [GitHub](https://github.com/papay0/vibe-coders-desktop/issues)
- Check out the [Claude Code documentation](https://docs.anthropic.com/claude/docs/claude-code)

---

Made with ❤️ by the Vibe Coders team
