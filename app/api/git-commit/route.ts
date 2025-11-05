import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function POST() {
  try {
    console.log('=== Git Commit API Debug ===');
    console.log('CWD:', process.cwd());
    console.log('Using Claude Agent SDK...');

    const startTime = Date.now();
    const messages: string[] = [];

    // Use Claude Agent SDK to analyze git changes
    for await (const event of query({
      prompt: 'give me a summary of the git changes',
      options: {
        maxTurns: 5,
      },
    })) {
      console.log('Event type:', event.type);

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
        console.log('Query completed');
        console.log('Turns used:', event.num_turns);
        console.log('Is error:', event.is_error);
      }
    }

    const duration = Date.now() - startTime;
    const result = messages.join('\n\n');

    console.log('Claude Agent SDK completed in', duration, 'ms');
    console.log('Result preview:', result.substring(0, 200));

    return NextResponse.json({
      message: result || 'No response from Claude',
    });
  } catch (error) {
    console.error('=== Error ===');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute command',
      },
      { status: 500 }
    );
  }
}
