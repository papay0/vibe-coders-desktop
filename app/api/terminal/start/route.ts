import { NextResponse } from 'next/server';
import { startTerminalServer, isTerminalServerRunning } from '@/lib/terminal-manager';

// Use Node.js runtime for this route (required for child_process)
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Check if already running
    const status = await isTerminalServerRunning();
    if (status.running && status.port) {
      return NextResponse.json({
        success: true,
        port: status.port,
        message: 'Terminal server already running',
      });
    }

    // Start the server
    const port = await startTerminalServer();

    return NextResponse.json({
      success: true,
      port,
      message: 'Terminal server started successfully',
    });
  } catch (error) {
    console.error('Failed to start terminal server:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start terminal server',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await isTerminalServerRunning();
    return NextResponse.json({
      running: status.running,
      port: status.port,
    });
  } catch (error) {
    console.error('Failed to check terminal server status:', error);
    return NextResponse.json(
      {
        running: false,
        error: error instanceof Error ? error.message : 'Failed to check status',
      },
      { status: 500 }
    );
  }
}
