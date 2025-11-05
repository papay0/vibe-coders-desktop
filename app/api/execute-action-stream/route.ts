import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync } from 'fs';
import { getPromptForAction, validateActionParams, type ActionType, type ActionParams } from '@/lib/prompts';

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
        console.log('=== Executing Action with Claude Code (Streaming) ===');
        console.log('Action:', action);
        console.log('Params:', params);

        const { prompt, cwd } = getPromptForAction(action, params);
        console.log('CWD:', cwd);

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
