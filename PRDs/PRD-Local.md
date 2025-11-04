# PRD: Vibe Coders Local App

**Repository**: `vibe-coders-desktop`
**Runs on**: User's local machine (localhost:3000)
**Purpose**: Beautiful UI for Claude Code workflows - no terminal required
**Works with**: `vibe-coders` backend (vibe-coders.app)

---

## Overview

The Vibe Coders local app is a Next.js application that runs on the user's machine, providing a beautiful UI for AI-powered coding workflows. Users install it with one command and never need to touch the terminal again.

**Key Principle**: This app is a **UI layer** over Claude Code CLI. It executes commands on behalf of the user and shows results in a friendly interface.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router with Turbopack)
- **React**: React 19.2
- **Language**: TypeScript
- **Runs on**: localhost:3000 (or auto-assigned port)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
  - Pre-built, accessible components
  - Customizable with Tailwind
  - Copy-paste component library
- **State**: React Context + localStorage
- **Command Execution**: Node.js `child_process`
- **Communication**: Fetch API to backend (vibe-coders.app)
- **Authentication**: localStorage-based (no Clerk, just API key check)

---

## Core Features

### 1. API Key Setup Flow

**On first launch**, user chooses their API key option:

```
User opens localhost:3000
  ↓
Checks localStorage for 'vibe_coders_api_key'
  ↓
No key found
  ↓
Shows key selection screen:
  ┌─────────────────────────────────────┐
  │ Welcome to Vibe Coders!             │
  │                                     │
  │ Choose your API key option:         │
  │                                     │
  │ ○ Bring Your Own Key (Free)        │
  │   [Input: Enter Anthropic API key] │
  │                                     │
  │ ○ Use Vibe Coders Key ($20/month)  │
  │   [Link to: vibe-coders.app/home]  │
  │                                     │
  │ [Continue]                          │
  └─────────────────────────────────────┘
  ↓
If BYOK selected:
  - Store API key in localStorage as 'vibe_coders_api_key'
  - Store key type as 'byok' in localStorage
  - Redirect to /home

If Cloud key selected:
  - Open vibe-coders.app in new tab
  - User signs up with Clerk
  - User creates API key at /home/create
  - User copies key back to localhost:3000
  - Store API key in localStorage as 'vibe_coders_api_key'
  - Store key type as 'cloud' in localStorage
  - Redirect to /home
```

**Implementation**:

```typescript
// app/page.tsx (Key selection screen)
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SetupPage() {
  const router = useRouter();
  const [keyType, setKeyType] = useState<'byok' | 'cloud'>('byok');
  const [apiKey, setApiKey] = useState('');

  // Check if key already exists
  useEffect(() => {
    const existingKey = localStorage.getItem('vibe_coders_api_key');
    if (existingKey) {
      router.push('/home');
    }
  }, [router]);

  const handleContinue = () => {
    if (keyType === 'byok') {
      if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        alert('Please enter a valid Anthropic API key (starts with sk-ant-)');
        return;
      }
      localStorage.setItem('vibe_coders_api_key', apiKey);
      localStorage.setItem('vibe_coders_key_type', 'byok');
      router.push('/home');
    } else {
      // Open cloud signup in new tab
      window.open('https://vibe-coders.app', '_blank');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <Card className="w-full max-w-2xl p-8 shadow-xl">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Welcome to Vibe Coders!
            </h1>
            <p className="text-gray-600 mt-2">
              Code with AI, no terminal required
            </p>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Choose your API key option:</h2>

            <RadioGroup value={keyType} onValueChange={(v) => setKeyType(v as 'byok' | 'cloud')}>
              <div className="space-y-4">
                {/* BYOK Option */}
                <Card className={`p-4 cursor-pointer transition ${keyType === 'byok' ? 'ring-2 ring-blue-600' : ''}`}>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="byok" id="byok" />
                    <div className="flex-1">
                      <Label htmlFor="byok" className="text-lg font-semibold cursor-pointer">
                        Bring Your Own Key (Free)
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Use your own Anthropic API key. You'll be charged directly by Anthropic.
                      </p>

                      {keyType === 'byok' && (
                        <div className="mt-4">
                          <Label htmlFor="api-key">Anthropic API Key</Label>
                          <Input
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-ant-api03-..."
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Get your key at{' '}
                            <a
                              href="https://console.anthropic.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              console.anthropic.com
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Cloud Key Option */}
                <Card className={`p-4 cursor-pointer transition ${keyType === 'cloud' ? 'ring-2 ring-blue-600' : ''}`}>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="cloud" id="cloud" />
                    <div className="flex-1">
                      <Label htmlFor="cloud" className="text-lg font-semibold cursor-pointer">
                        Use Vibe Coders Key ($20/month)
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Unlimited usage with our managed API key. Sign up at vibe-coders.app.
                      </p>

                      {keyType === 'cloud' && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            Click Continue to open vibe-coders.app, create an account, and generate your API key.
                            Then return here and enter the key.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </RadioGroup>
          </div>

          <Button
            onClick={handleContinue}
            size="lg"
            className="w-full"
            disabled={keyType === 'byok' && !apiKey}
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

**If user selected cloud key, they need to enter it after signing up**:

```typescript
// app/enter-key/page.tsx (for cloud key users returning from vibe-coders.app)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EnterKeyPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = () => {
    if (!apiKey || !apiKey.startsWith('vc_')) {
      alert('Please enter a valid Vibe Coders API key (starts with vc_)');
      return;
    }

    localStorage.setItem('vibe_coders_api_key', apiKey);
    localStorage.setItem('vibe_coders_key_type', 'cloud');
    router.push('/home');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Enter Your API Key</h1>

        <div className="space-y-4">
          <div>
            <Label htmlFor="key">Vibe Coders API Key</Label>
            <Input
              id="key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="vc_..."
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy the key from{' '}
              <a
                href="https://vibe-coders.app/home"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                vibe-coders.app/home
              </a>
            </p>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!apiKey}>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

---

### 2. Project Management

**Main feature**: Users can add multiple projects and switch between them.

**Data structure** (stored in localStorage):
```typescript
interface Project {
  id: string;
  name: string;
  path: string; // absolute path on user's machine
  createdAt: string;
  lastUsed: string;
}
```

**UI Layout**:

```
┌─────────────────────────────────────────────────────┐
│  Vibe Coders                      [Settings] [User] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Projects                                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📁 my-nextjs-app          [Active]           │  │
│  │    /Users/you/projects/my-nextjs-app         │  │
│  │    Last used: 2 hours ago                    │  │
│  ├──────────────────────────────────────────────┤  │
│  │ 📱 my-expo-app                                │  │
│  │    /Users/you/projects/my-expo-app           │  │
│  │    Last used: 1 day ago                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [+ Add Project]                                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Add Project Flow**:

```typescript
// components/AddProjectDialog.tsx
'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';

export function AddProjectDialog({ onAdd }: { onAdd: (project: Project) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');

  const handleBrowse = async () => {
    // Use electron or native file picker if available
    // For web, show input field
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        const folderPath = files[0].webkitRelativePath.split('/')[0];
        setPath(files[0].path || folderPath);
        setName(folderPath);
      }
    };

    input.click();
  };

  const handleAdd = () => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      path,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    onAdd(project);
    setIsOpen(false);
    setName('');
    setPath('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="btn-primary">+ Add Project</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="my-awesome-project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Project Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="/Users/you/projects/my-awesome-project"
              />
              <button onClick={handleBrowse} className="btn-secondary">
                Browse
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!name || !path}
            className="w-full btn-primary"
          >
            Add Project
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Projects Context**:

```typescript
// contexts/ProjectsContext.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastUsed: string;
}

interface ProjectsContextType {
  projects: Project[];
  activeProject: Project | null;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string) => void;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('vibe_coders_projects');
    if (stored) {
      const data = JSON.parse(stored);
      setProjects(data.projects || []);
      setActiveProjectId(data.activeProjectId || null);
    }
  }, []);

  // Save to localStorage when projects change
  useEffect(() => {
    localStorage.setItem(
      'vibe_coders_projects',
      JSON.stringify({ projects, activeProjectId })
    );
  }, [projects, activeProjectId]);

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);
  };

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  };

  const setActiveProject = (id: string) => {
    setActiveProjectId(id);
    // Update lastUsed
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, lastUsed: new Date().toISOString() } : p
      )
    );
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        activeProject,
        addProject,
        removeProject,
        setActiveProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export const useProjects = () => {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error('useProjects must be used within ProjectsProvider');
  return context;
};
```

---

### 3. Command Execution System

**Core feature**: Execute commands in user's project directory.

**API Route**:

```typescript
// app/api/execute/route.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: Request) {
  const { command, projectPath, authToken } = await req.json();

  // Security: whitelist allowed commands
  const allowedCommands = [
    'claude -p',
    'npm run dev',
    'npm run build',
    'npm start',
    'git status',
    'git log',
  ];

  const isAllowed = allowedCommands.some((cmd) => command.startsWith(cmd));
  if (!isAllowed) {
    return Response.json(
      { error: 'Command not allowed', success: false },
      { status: 403 }
    );
  }

  try {
    // Set environment variables for Claude CLI
    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: 'https://vibe-coders.app/api/proxy',
      ANTHROPIC_AUTH_TOKEN: authToken,
    };

    const { stdout, stderr } = await execPromise(command, {
      cwd: projectPath,
      env,
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    return Response.json({
      success: true,
      stdout,
      stderr,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    });
  }
}
```

**Client-side hook**:

```typescript
// hooks/useCommand.ts
import { useState } from 'react';

interface UseCommandResult {
  execute: (command: string) => Promise<void>;
  loading: boolean;
  output: string;
  error: string | null;
}

export function useCommand(projectPath: string): UseCommandResult {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const execute = async (command: string) => {
    setLoading(true);
    setOutput('');
    setError(null);

    const authToken = localStorage.getItem('vibe_coders_token');

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          projectPath,
          authToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOutput(data.stdout || data.stderr);
      } else {
        setError(data.error || 'Command failed');
        setOutput(data.stderr || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, output, error };
}
```

---

### 4. Workflows (MVP: Git Commit)

**The ONE button that proves everything works**:

```typescript
// components/GitCommitButton.tsx
'use client';

import { useState } from 'react';
import { useProjects } from '@/contexts/ProjectsContext';
import { useCommand } from '@/hooks/useCommand';

export function GitCommitButton() {
  const { activeProject } = useProjects();
  const { execute, loading, output, error } = useCommand(
    activeProject?.path || ''
  );
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');

  const handleCommit = async () => {
    if (!activeProject) {
      alert('Please select a project first');
      return;
    }

    await execute('claude -p "Generate a git commit message and push to GitHub"');
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setMode(mode === 'easy' ? 'advanced' : 'easy')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {mode === 'easy' ? '🔧 Advanced Mode' : '✨ Easy Mode'}
        </button>
      </div>

      {/* Main button */}
      <button
        onClick={handleCommit}
        disabled={loading || !activeProject}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Generating commit...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">💾</span>
            <span className="text-lg font-semibold">Generate Commit & Push</span>
          </div>
        )}
      </button>

      {/* Output (conditional based on mode) */}
      {mode === 'advanced' && (output || error) && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Output:</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            {error ? (
              <div className="text-red-400">
                <div className="font-bold mb-2">❌ Error:</div>
                <pre>{error}</pre>
              </div>
            ) : (
              <pre>{output}</pre>
            )}
          </div>
        </div>
      )}

      {/* Success message (easy mode) */}
      {mode === 'easy' && output && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-semibold">Commit successful!</div>
              <div className="text-sm">Your changes have been committed and pushed.</div>
            </div>
          </div>
        </div>
      )}

      {/* Error message (easy mode) */}
      {mode === 'easy' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-2xl">❌</span>
            <div>
              <div className="font-semibold">Something went wrong</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 5. Settings Page

```typescript
// app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function Settings() {
  const [authToken, setAuthToken] = useState('');
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('vibe_coders_token');
    setAuthToken(token || '');

    // Fetch subscription info
    if (token) {
      fetch('https://vibe-coders.app/api/usage', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setSubscription(data));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vibe_coders_token');
    window.location.href = '/login';
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Account */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Account</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auth Token
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={authToken}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(authToken)}
                  className="btn-secondary"
                >
                  Copy
                </button>
              </div>
            </div>

            <button onClick={handleLogout} className="btn-danger">
              Logout
            </button>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>

          {subscription ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-semibold">{subscription.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Requests this month:</span>
                <span className="font-semibold">{subscription.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total tokens:</span>
                <span className="font-semibold">
                  {subscription.totalTokens?.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}

          <button className="mt-4 btn-primary w-full">
            Manage Subscription
          </button>
        </div>

        {/* Version */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Version</h2>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">Vibe Coders v1.0.0</div>
              <div className="text-sm text-gray-500">Up to date</div>
            </div>
            <button className="btn-secondary">Check for Updates</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Main App Layout

```typescript
// app/home/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { ProjectList } from '@/components/ProjectList';
import { GitCommitButton } from '@/components/GitCommitButton';

export default function HomePage() {
  const router = useRouter();
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem('vibe_coders_api_key');
    if (!apiKey) {
      router.push('/');
    } else {
      setHasApiKey(true);
    }
  }, [router]);

  if (!hasApiKey) {
    return null; // Will redirect to setup
  }

  return (
    <ProjectsProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Vibe Coders
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/settings')}
                className="text-gray-600 hover:text-gray-900"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Projects */}
            <div className="lg:col-span-1">
              <ProjectList />
            </div>

            {/* Right: Workflows */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <GitCommitButton />
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProjectsProvider>
  );
}
```

---

## File Structure

```
vibe-coders-desktop/
├── app/
│   ├── page.tsx                    # API key selection screen
│   ├── home/
│   │   └── page.tsx                # Main app (project management)
│   ├── enter-key/
│   │   └── page.tsx                # Enter cloud API key
│   ├── settings/
│   │   └── page.tsx                # Settings page
│   ├── api/
│   │   └── execute/
│   │       └── route.ts            # Command execution
│   └── layout.tsx                  # Root layout
├── components/
│   ├── ProjectList.tsx             # Project list UI
│   ├── AddProjectDialog.tsx        # Add project dialog
│   ├── GitCommitButton.tsx         # Commit button
│   └── ui/                         # Shadcn UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── radio-group.tsx
│       └── ...
├── contexts/
│   └── ProjectsContext.tsx         # Projects state
├── hooks/
│   └── useCommand.ts               # Command execution hook
├── lib/
│   └── utils.ts                    # Utilities
├── public/
│   └── logo.svg
├── .env.local
├── package.json
├── next.config.js
├── tailwind.config.ts
├── components.json                 # Shadcn config
└── PRD-Local.md                    # This file
```

---

## Environment Variables

```bash
# .env.local

# Backend URL
NEXT_PUBLIC_BACKEND_URL=https://vibe-coders.app

# Local app settings
PORT=3000  # or auto-assign
```

---

## Project Initialization

```bash
# Create Next.js 16 project
npx create-next-app@latest vibe-coders-desktop --typescript --tailwind --app --turbopack

# Navigate to project
cd vibe-coders-desktop

# Initialize Shadcn UI
npx shadcn@latest init

# Install commonly used Shadcn components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add radio-group
npx shadcn@latest add separator
npx shadcn@latest add toast

# Install dependencies
npm install
```

---

## Development Workflow

```bash
# Run development server
npm run dev

# Open app
open http://localhost:3000
```

---

## Testing Checklist

- [ ] Key selection screen shows on first launch
- [ ] BYOK option accepts and stores Anthropic API key
- [ ] Cloud key option opens vibe-coders.app in new tab
- [ ] Enter key screen accepts cloud API key (vc_)
- [ ] API key is stored in localStorage
- [ ] Can add projects
- [ ] Can switch active project
- [ ] Git commit button executes command
- [ ] Output is shown in Advanced mode
- [ ] Success/error messages shown in Easy mode
- [ ] Settings page shows current API key
- [ ] Can logout and clear API key

---

## Communication with Backend

All requests to backend include auth token:

```typescript
const authToken = localStorage.getItem('vibe_coders_token');

// Example: Get usage stats
const response = await fetch('https://vibe-coders.app/api/usage', {
  headers: {
    Authorization: `Bearer ${authToken}`,
  },
});
```

---

## Security Considerations

1. **Command Whitelist**: Only allowed commands can be executed
2. **Path Validation**: Validate project paths before execution
3. **Token Storage**: Token stored in localStorage (acceptable for local app)
4. **HTTPS**: All backend communication over HTTPS
5. **No Secrets**: Never store API keys in local app

---

## Future Features (Post-MVP)

### Phase 2: More Workflows
- Restart dev server button
- Open in browser button
- Run tests button
- Deploy to Vercel button

### Phase 3: Advanced
- Terminal view (for advanced users)
- Real-time command output streaming
- Multiple commands in queue
- Command history

### Phase 4: Templates
- Create new Next.js app
- Create new Expo app
- Template marketplace

---

## Success Criteria

MVP is successful when:
- [x] User can install with one command
- [x] User can login with Google
- [x] User can add a project
- [x] User can click "Commit" and it works
- [x] Easy mode hides complexity
- [x] Advanced mode shows details

---

## Next Steps

1. Set up Next.js project
2. Build authentication flow
3. Implement projects context
4. Build command execution system
5. Create Git commit button
6. Test with backend
7. Add polish and error handling

---

*Document Version: 1.0*
*Last Updated: 2025-11-04*
*Companion: PRD-Backend.md (cloud backend)*
