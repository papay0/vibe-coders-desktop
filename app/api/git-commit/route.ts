import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function POST() {
  try {

    const startTime = Date.now();
    const messages: string[] = [];

    // Use Claude Agent SDK to analyze git changes
    for await (const event of query({
      prompt: 'give me a summary of the git changes',
      options: {
        maxTurns: 5,
      },
    })) {

      if (event.type === 'assistant') {
        // Collect assistant messages
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              messages.push(block.text);
            }
          }
        }
      } else if (event.type === 'result') {
      }
    }

    const duration = Date.now() - startTime;
    const result = messages.join('\n\n');


    return NextResponse.json({
      message: result || 'No response from Claude',
    });
  } catch (error) {

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute command',
      },
      { status: 500 }
    );
  }
}
