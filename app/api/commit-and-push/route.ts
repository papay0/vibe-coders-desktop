import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { projectPath, title, description } = await request.json();

    if (!projectPath || !title) {
      return NextResponse.json(
        { error: 'Missing projectPath or title' },
        { status: 400 }
      );
    }

    // Stage all changes
    await execAsync('git add .', { cwd: projectPath });

    // Create commit message with Claude Code attribution
    const commitMessage = description
      ? `${title}\n\n${description}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`
      : `${title}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;

    // Commit changes using heredoc for proper formatting
    await execAsync(`git commit -m "$(cat <<'EOF'\n${commitMessage.replace(/'/g, "'\\''")}\nEOF\n)"`, {
      cwd: projectPath,
    });

    // Push to remote
    await execAsync('git push', { cwd: projectPath });

    return NextResponse.json({
      success: true,
      message: 'Changes committed and pushed successfully',
    });
  } catch (error) {
    console.error('Error committing and pushing:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to commit and push'
      },
      { status: 500 }
    );
  }
}
