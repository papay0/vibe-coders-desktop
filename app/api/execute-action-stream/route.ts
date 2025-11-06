import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { getPromptForAction, validateActionParams, type ActionType, type ActionParams } from '@/lib/prompts';

/**
 * Execute create-web-project directly without LLM
 * This is much faster and cheaper than using Claude Code
 */
async function executeProjectCreationDirectly(
  name: string,
  parentPath: string,
  sendMessage: (content: string, messageType?: 'text' | 'tool' | 'output') => void,
  sendError: (content: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    // Send initial "thinking" message to mimic LLM
    sendMessage("I'll create a new Next.js project with TypeScript, Tailwind CSS, and shadcn/ui components.", 'text');

    const command = `npx create-next-app@latest ${name} --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm --yes && cd ${name} && npx shadcn@latest init -y -d && npx shadcn@latest add -a -y && git add --all && git commit -m "Initial commit"`;

    console.log('[Project Creation] Command:', command);
    console.log('[Project Creation] CWD:', parentPath);

    sendMessage(`🔧 Running command to create project "${name}"...`, 'tool');

    const process = spawn(command, [], {
      cwd: parentPath,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let lastUpdate = Date.now();

    // Send periodic updates to show progress
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdate) / 1000);
      if (elapsed > 10) {
        sendMessage(`Still working... (${elapsed}s)`, 'output');
      }
    }, 10000);

    process.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      lastUpdate = Date.now();

      console.log('[Project Creation] stdout:', text.substring(0, 200));

      // Send updates for key milestones
      if (text.includes('Creating a new Next.js app')) {
        sendMessage('✨ Creating Next.js application...', 'output');
      } else if (text.includes('Installing dependencies')) {
        sendMessage('📦 Installing dependencies with npm...', 'output');
      } else if (text.includes('Initializing project')) {
        sendMessage('🎨 Setting up shadcn/ui...', 'output');
      } else if (text.includes('Success')) {
        sendMessage('✅ Project structure created successfully!', 'output');
      }
    });

    process.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error('[Project Creation] stderr:', text.substring(0, 200));

      // npm/npx often output progress to stderr, which is not an error
      if (text.includes('warn') || text.includes('deprecated')) {
        // Just warnings, ignore
        return;
      }

      // Send some stderr as progress updates (npm uses stderr for non-error output)
      if (text.includes('Installing') || text.includes('added')) {
        sendMessage('📦 Installing packages...', 'output');
      }
    });

    process.on('close', (code) => {
      clearInterval(progressInterval);
      console.log('[Project Creation] Process closed with code:', code);
      console.log('[Project Creation] Output length:', output.length);
      console.log('[Project Creation] Error output length:', errorOutput.length);

      if (code === 0) {
        sendMessage('✅ Project created successfully! All components installed and initial commit made.', 'text');
        resolve(true);
      } else {
        console.error('[Project Creation] Full error output:', errorOutput);
        sendError(`Failed to create project. Exit code: ${code}\n${errorOutput.substring(0, 1000)}`);
        resolve(false);
      }
    });

    process.on('error', (error) => {
      clearInterval(progressInterval);
      console.error('[Project Creation] Process error:', error);
      sendError(`Failed to execute command: ${error.message}`);
      resolve(false);
    });
  });
}

export async function POST(request: Request) {
  const { action, params } = await request.json() as { action: ActionType; params: ActionParams };

  if (!action || !params) {
    return new Response(
      JSON.stringify({ error: 'Action and params are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate params
  const validationError = validateActionParams(action, params);
  if (validationError) {
    return new Response(
      JSON.stringify({ error: validationError }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if paths exist on filesystem
  if (action === 'create-web-project') {
    const { path: parentPath } = params as { name: string; path: string };
    if (!existsSync(parentPath)) {
      return new Response(
        JSON.stringify({ error: 'Parent directory does not exist' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } else {
    const { projectPath } = params as { projectPath: string };
    if (!existsSync(projectPath)) {
      console.error('Project directory does not exist:', projectPath);
      return new Response(
        JSON.stringify({
          error: `Project directory does not exist: ${projectPath}`,
          path: projectPath
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendMessage = (content: string, messageType: 'text' | 'tool' | 'output' = 'text') => {
        const message = `data: ${JSON.stringify({ type: 'message', content, messageType })}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const sendError = (content: string) => {
        const message = `data: ${JSON.stringify({ type: 'error', content })}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        console.log('=== Executing Action ===');
        console.log('Action:', action);
        console.log('Params:', params);

        // For create-web-project, execute directly without LLM
        if (action === 'create-web-project') {
          const { name, path: parentPath } = params as { name: string; path: string };
          console.log('Using direct execution for project creation');

          const success = await executeProjectCreationDirectly(name, parentPath, sendMessage, sendError);

          if (!success) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        // For other actions, use Claude Code
        const { prompt, cwd } = getPromptForAction(action, params);
        console.log('CWD:', cwd);
        console.log('Using Claude Code for action execution');

        for await (const event of query({
          prompt,
          options: {
            cwd,
            maxTurns: 30,
            permissionMode: 'bypassPermissions',
            maxBudgetUsd: 1.0,
          },
        })) {
          console.log('Event type:', event.type);

          if (event.type === 'assistant') {
            const content = event.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'text') {
                  console.log('Sending message:', block.text.substring(0, 100));
                  sendMessage(block.text, 'text');
                } else if (block.type === 'tool_use') {
                  const toolName = block.name;
                  const toolInput = JSON.stringify(block.input, null, 2);
                  sendMessage(`🔧 Running: ${toolName}\n${toolInput}`, 'tool');
                }
              }
            }
          } else if (event.type === 'user') {
            const content = event.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'tool_result') {
                  const resultContent = block.content;

                  if (Array.isArray(resultContent)) {
                    for (const resultBlock of resultContent) {
                      if (resultBlock.type === 'text') {
                        const text = resultBlock.text;
                        const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
                        sendMessage(`✅ Output:\n${preview}`, 'output');
                      }
                    }
                  }
                }
              }
            }
          } else if (event.type === 'result') {
            console.log('Query completed');
            console.log('Turns used:', event.num_turns);
            console.log('Is error:', event.is_error);

            if (event.is_error) {
              sendError('Claude Code encountered an error');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
          }
        }

        sendMessage('✅ Action completed successfully!', 'text');

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Error:', error);
        sendError(error instanceof Error ? error.message : 'Failed to execute action');
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
