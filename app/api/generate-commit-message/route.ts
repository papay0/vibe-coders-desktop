import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { projectPath } = await request.json();

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    let title = '';
    let description = '';
    let foundMessage = false;

    // Use Claude Code to analyze changes and generate commit message
    const prompt = `Analyze the git changes in this project and generate a conventional commit message. DO NOT COMMIT OR PUSH ANYTHING.

Project Location: ${projectPath}

Your task:
1. Run 'git status --short' to see what files have changed
2. Run 'git diff HEAD' to see all changes (both staged and unstaged)
3. Analyze what was modified and why

After analyzing, you MUST end your response with a commit message in this EXACT format:

---COMMIT-MESSAGE-START---
TITLE: [one line summary using conventional commits format, max 72 chars]
DESCRIPTION: [2-3 sentences explaining what changed and why, or write "none" if changes are simple]
---COMMIT-MESSAGE-END---

CRITICAL RULES:
- Use conventional commit prefixes: feat:, fix:, docs:, chore:, style:, refactor:, test:, perf:
- Keep title under 72 characters
- If changes are simple, set DESCRIPTION to "none"
- ALWAYS include the ---COMMIT-MESSAGE-START--- and ---COMMIT-MESSAGE-END--- markers
- DO NOT run git add, git commit, or git push commands
- ONLY analyze and generate the message`;

    let allText = '';

    for await (const event of query({
      prompt,
      options: {
        cwd: projectPath,
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
        maxBudgetUsd: 0.5,
      },
    })) {
      if (event.type === 'assistant') {
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              const text = block.text;
              allText += text + '\n';

              // Try to extract from the marked section
              const messageSection = allText.match(/---COMMIT-MESSAGE-START---\s*([\s\S]*?)\s*---COMMIT-MESSAGE-END---/);

              if (messageSection) {
                const messageContent = messageSection[1];

                const titleMatch = messageContent.match(/TITLE:\s*(.+?)(?:\n|$)/i);
                const descMatch = messageContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/is);

                if (titleMatch) {
                  title = titleMatch[1].trim();
                  foundMessage = true;
                }

                if (descMatch) {
                  const desc = descMatch[1].trim();
                  if (desc && desc.toLowerCase() !== 'none' && desc.toLowerCase() !== 'empty' && desc !== '') {
                    description = desc;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!foundMessage || !title) {
      // Return a default message for no changes
      return NextResponse.json({
        title: 'chore: no changes detected',
        description: 'No git changes found in the working directory.',
      });
    }

    return NextResponse.json({
      title,
      description,
    });
  } catch (error) {
    console.error('Error generating commit message:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate commit message'
      },
      { status: 500 }
    );
  }
}
