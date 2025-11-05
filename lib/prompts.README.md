# Prompt Manager

Centralized prompt management for AI-powered actions in Vibe Coders Desktop.

## Overview

This library provides a clean, type-safe way to manage prompts for Claude Code actions. Instead of having prompts scattered throughout API routes, all prompts are defined in one place.

## Usage

```typescript
import { getPromptForAction, validateActionParams, type ActionType, type ActionParams } from '@/lib/prompts';

// Get a prompt configuration
const config = getPromptForAction('start-dev-server', {
  projectPath: '/path/to/project'
});

// Validate params before execution
const error = validateActionParams('start-dev-server', params);
if (error) {
  throw new Error(error);
}

// Use the prompt with Claude Code SDK
const result = await query({
  prompt: config.prompt,
  options: {
    cwd: config.cwd,
    // ... other options
  }
});
```

## Available Actions

### `create-web-project`
Creates a new Next.js application with TypeScript, Tailwind CSS, and shadcn/ui.

**Params:**
- `name: string` - Project name (alphanumeric, hyphens, underscores only)
- `path: string` - Parent directory where project will be created

**What it does:**
1. Runs `create-next-app` with interactive prompts
2. Initializes shadcn/ui with defaults
3. Adds all shadcn components
4. Creates initial git commit

---

### `start-dev-server`
Installs dependencies, starts the development server, and opens in browser.

**Params:**
- `projectPath: string` - Full path to the project directory

**What it does:**
1. Ensures npm dependencies are installed
2. Starts `npm run dev` (uses free port if 3000 is taken)
3. Extracts the localhost URL from output
4. Opens the URL in the default browser

**Safety:** Never kills existing processes. Always lets Next.js find a free port.

---

### `kill-server`
Stops the development server for a specific project.

**Params:**
- `projectPath: string` - Full path to the project directory

**What it does:**
1. Finds Node.js processes running from THIS specific project directory
2. Verifies the process working directory matches the project path
3. Gracefully kills only the matched processes (SIGTERM)

**Safety:** Only kills servers from the specified project path. Will not kill servers on the same port from different projects.

---

## Adding New Actions

To add a new action:

1. **Add the action type:**
```typescript
export type ActionType = 'create-web-project' | 'start-dev-server' | 'kill-server' | 'your-new-action';
```

2. **Define params interface (if new type needed):**
```typescript
interface YourActionParams {
  // your params
}
```

3. **Create the prompt function:**
```typescript
function yourActionPrompt(params: YourActionParams): PromptConfig {
  return {
    prompt: `Your detailed prompt here...`,
    cwd: params.somePath,
  };
}
```

4. **Add to the switch statement in `getPromptForAction`:**
```typescript
case 'your-new-action':
  return yourActionPrompt(params as YourActionParams);
```

5. **Add validation in `validateActionParams`:**
```typescript
case 'your-new-action': {
  const { requiredField } = params as YourActionParams;
  if (!requiredField) return 'Required field is missing';
  return null;
}
```

## Best Practices

### Writing Prompts

1. **Be explicit and detailed** - Claude Code works best with clear, step-by-step instructions
2. **Include safety warnings** - Prevent destructive actions (e.g., "DO NOT kill existing processes")
3. **Specify exact commands** - Don't assume, tell it exactly what to run
4. **Handle edge cases** - Mention what to do if ports are taken, files exist, etc.
5. **Request confirmation** - Ask Claude Code to report when actions complete

### Prompt Structure

```
Goal: [What we're trying to accomplish]

Project Location: ${path}

Steps:
1. [First step with exact command]
   - [Important detail or flag]
   - [Warning or note]
2. [Second step]
...

IMPORTANT: [Critical safety or behavior note]

Report: [What to tell the user when done]
```

## Type Safety

All actions and params are fully typed:

```typescript
// ✅ Type-safe
getPromptForAction('start-dev-server', { projectPath: '/path' });

// ❌ TypeScript error - wrong params
getPromptForAction('start-dev-server', { name: 'foo' });

// ❌ TypeScript error - unknown action
getPromptForAction('invalid-action', { projectPath: '/path' });
```

## Testing

When testing new prompts:

1. Test happy path - normal execution
2. Test edge cases - port conflicts, missing files, etc.
3. Test safety - ensure it doesn't do destructive actions
4. Test error handling - what happens when commands fail

## Examples

See `app/api/execute-action-stream/route.ts` for a complete example of using this library in an API route.
