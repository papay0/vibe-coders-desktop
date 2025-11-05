import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    let folderPath = '';

    // Detect OS and use appropriate command
    if (process.platform === 'darwin') {
      // macOS - AppleScript
      try {
        const { stdout } = await execAsync(
          `osascript -e 'POSIX path of (choose folder with prompt "Select Project Folder")'`
        );
        folderPath = stdout.trim();
      } catch (error) {
        // User cancelled or error occurred
        return NextResponse.json({ error: 'Folder selection cancelled' }, { status: 400 });
      }

    } else if (process.platform === 'win32') {
      // Windows - PowerShell
      try {
        const { stdout } = await execAsync(
          `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select Project Folder'; $result = $dialog.ShowDialog(); if($result -eq 'OK'){ $dialog.SelectedPath }"`,
          { timeout: 60000 } // 60 second timeout
        );
        folderPath = stdout.trim();
      } catch (error) {
        return NextResponse.json({ error: 'Folder selection cancelled' }, { status: 400 });
      }

    } else {
      // Linux - zenity (needs to be installed)
      try {
        const { stdout } = await execAsync(
          `zenity --file-selection --directory --title="Select Project Folder"`,
          { timeout: 60000 }
        );
        folderPath = stdout.trim();
      } catch (error) {
        // Check if zenity is installed
        try {
          await execAsync('which zenity');
          // zenity is installed, user just cancelled
          return NextResponse.json({ error: 'Folder selection cancelled' }, { status: 400 });
        } catch {
          // zenity not installed
          return NextResponse.json({
            error: 'Please install zenity: sudo apt-get install zenity'
          }, { status: 500 });
        }
      }
    }

    if (!folderPath) {
      return NextResponse.json({ error: 'No folder selected' }, { status: 400 });
    }

    // Extract folder name from path
    const folderName = folderPath.split(/[\/\\]/).pop() || folderPath;

    return NextResponse.json({
      path: folderPath,
      name: folderName
    });

  } catch (error) {
    console.error('Error in select-folder API:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
