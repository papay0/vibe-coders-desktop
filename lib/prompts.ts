/**
 * Prompt Manager
 * Centralized location for all AI action prompts
 */

export type ActionType = 'create-web-project' | 'start-dev-server' | 'kill-server';

interface CreateWebProjectParams {
  name: string;
  path: string;
}

interface ProjectActionParams {
  projectPath: string;
}

export type ActionParams = CreateWebProjectParams | ProjectActionParams;

interface PromptConfig {
  prompt: string;
  cwd: string;
}

/**
 * Create Web Project
 * Sets up a new Next.js application with TypeScript, Tailwind, and shadcn/ui
 */
function createWebProjectPrompt(params: CreateWebProjectParams): PromptConfig {
  const { name, path: parentPath } = params;

  return {
    prompt: `Create a new Next.js web application project with the following setup:

Project Name: ${name}
Location: ${parentPath}

Steps:
1. Run: npx create-next-app@latest ${name}
   - Choose TypeScript, Tailwind CSS, App Router, ESLint when prompted
   - Use npm as package manager
2. Navigate into the project: cd ${name}
3. Run: npx shadcn@latest init
   - Use default options when prompted
4. Run: npx shadcn@latest add -a
   - This adds all shadcn components
5. Create initial commit: git add . && git commit -m "Initial commit with Next.js and shadcn/ui"

Handle any interactive prompts by selecting the appropriate defaults. Work through the steps systematically.`,
    cwd: parentPath,
  };
}

/**
 * Start Dev Server
 * Installs dependencies, starts the dev server, and opens in browser
 */
function startDevServerPrompt(params: ProjectActionParams): PromptConfig {
  const { projectPath } = params;

  return {
    prompt: `Start the development server for this Next.js project:

Project Location: ${projectPath}

Steps:
1. Make sure dependencies are installed: npm install (skip if already installed)
2. Start the development server: npm run dev
   - Next.js will automatically find a free port if 3000 is taken
   - DO NOT kill any existing processes
   - Let it use whatever port is available
3. Wait for the server to start and look for the localhost URL in the output (e.g., "Local: http://localhost:3000" or whatever port it picks)
4. Extract the exact URL from the output
5. Open that URL in the default browser using the 'open' command (on macOS)

IMPORTANT: Never kill existing processes. Always let Next.js find a free port.

Report the URL when the server is ready.`,
    cwd: projectPath,
  };
}

/**
 * Kill Server
 * Stops the development server for this specific project only
 */
function killServerPrompt(params: ProjectActionParams): PromptConfig {
  const { projectPath } = params;

  return {
    prompt: `Stop the development server for this specific project:

Project Location: ${projectPath}

Steps:
1. Find Node.js processes that are running specifically from THIS project directory (${projectPath})
   - Use 'lsof' or 'ps' to check the working directory of processes
   - Look for 'next dev' or 'npm run dev' processes
2. ONLY kill processes that have this exact project path as their working directory
3. DO NOT kill processes running on ports unless you verify they belong to THIS project
4. Use SIGTERM for graceful shutdown

IMPORTANT: Only kill servers running from ${projectPath}, not other projects!

Report when the server is successfully stopped, or if no server was found running for this project.`,
    cwd: projectPath,
  };
}

/**
 * Get the appropriate prompt configuration for an action
 */
export function getPromptForAction(action: ActionType, params: ActionParams): PromptConfig {
  switch (action) {
    case 'create-web-project':
      return createWebProjectPrompt(params as CreateWebProjectParams);

    case 'start-dev-server':
      return startDevServerPrompt(params as ProjectActionParams);

    case 'kill-server':
      return killServerPrompt(params as ProjectActionParams);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Helper to validate params for a specific action
 */
export function validateActionParams(action: ActionType, params: ActionParams): string | null {
  switch (action) {
    case 'create-web-project': {
      const { name, path } = params as CreateWebProjectParams;
      if (!name) return 'Project name is required';
      if (!path) return 'Project path is required';
      if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
        return 'Project name can only contain letters, numbers, hyphens, and underscores';
      }
      return null;
    }

    case 'start-dev-server':
    case 'kill-server': {
      const { projectPath } = params as ProjectActionParams;
      if (!projectPath) return 'Project path is required';
      return null;
    }

    default:
      return `Unknown action: ${action}`;
  }
}
