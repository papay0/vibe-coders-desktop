import { createHash } from 'crypto';
import { mkdir } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

/**
 * Get the directory where server info files are stored
 * Creates the directory if it doesn't exist
 */
export async function getServerInfoDir(): Promise<string> {
  const serverInfoDir = path.join(homedir(), '.vibe-coders', 'servers');

  try {
    await mkdir(serverInfoDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create server info directory:', error);
  }

  return serverInfoDir;
}

/**
 * Get the server info file path for a given project path
 * Uses a hash of the project path to create a unique filename
 */
export async function getServerInfoPath(projectPath: string): Promise<string> {
  const serverInfoDir = await getServerInfoDir();

  // Create a hash of the project path for a unique filename
  const hash = createHash('md5').update(projectPath).digest('hex');
  const filename = `${hash}.json`;

  return path.join(serverInfoDir, filename);
}
