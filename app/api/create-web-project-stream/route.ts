import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const { name, path: parentPath } = await request.json();

  if (!name || !parentPath) {
    return new Response(
      JSON.stringify({ error: 'Project name and path are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate project name
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    return new Response(
      JSON.stringify({ error: 'Project name can only contain letters, numbers, hyphens, and underscores' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if parent directory exists
  if (!existsSync(parentPath)) {
    return new Response(
      JSON.stringify({ error: 'Parent directory does not exist' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const projectPath = path.join(parentPath, name);

  // Check if project folder already exists
  if (existsSync(projectPath)) {
    return new Response(
      JSON.stringify({ error: 'A folder with this name already exists' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
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
        console.log('=== Creating Web Project with Claude Code (Streaming) ===');
        console.log('Project name:', name);
        console.log('Parent path:', parentPath);

        const prompt = `Create a new Next.js web application project with the following setup:

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

Handle any interactive prompts by selecting the appropriate defaults. Work through the steps systematically.`;

        for await (const event of query({
          prompt,
          options: {
            cwd: parentPath,
            maxTurns: 30, // Allow enough turns for interactive prompts and setup
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
                  // Show what command/tool is being used
                  const toolName = block.name;
                  const toolInput = JSON.stringify(block.input, null, 2);
                  sendMessage(`🔧 Running: ${toolName}\n${toolInput}`, 'tool');
                }
              }
            }
          } else if (event.type === 'user') {
            // User messages often contain tool results
            const content = event.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'tool_result') {
                  const toolUseId = block.tool_use_id;
                  const resultContent = block.content;

                  // Parse the result content
                  if (Array.isArray(resultContent)) {
                    for (const resultBlock of resultContent) {
                      if (resultBlock.type === 'text') {
                        // Only show first 500 chars of output to avoid spam
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
              sendError('Claude Code encountered an error while creating the project');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
          }
        }

        // Verify the project was created
        if (!existsSync(projectPath)) {
          sendError('Project directory was not created');
        } else {
          sendMessage('✅ Project created successfully!', 'text');
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Error:', error);
        sendError(error instanceof Error ? error.message : 'Failed to create project');
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
