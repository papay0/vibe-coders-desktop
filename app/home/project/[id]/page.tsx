'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Loader2, Eye, Save, Play, Square, RefreshCw, ExternalLink, RotateCw, Code2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { DiffViewer } from '@/components/diff-viewer';

interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  additions?: number;
  deletions?: number;
}

interface GitDiffResponse {
  files: GitFileStatus[];
  totalFiles: number;
  hasChanges: boolean;
  error?: string;
}

interface GitFileDiffResponse {
  oldContent: string;
  newContent: string;
  unifiedDiff: string;
  fileName: string;
  language: string;
  error?: string;
}

export default function Project2Page() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const { theme, systemTheme } = useTheme();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [serverStarting, setServerStarting] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [serverRunning, setServerRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checkingServer, setCheckingServer] = useState(false);
  const [startingServer, setStartingServer] = useState(false);
  const [restartingServer, setRestartingServer] = useState(false);
  const [devServerPort, setDevServerPort] = useState<number | null>(null);

  // Diff view state
  const [viewMode, setViewMode] = useState<'preview' | 'changes' | 'code'>('preview');
  const [gitStatus, setGitStatus] = useState<GitDiffResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<GitFileDiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [loadingGitStatus, setLoadingGitStatus] = useState(false);

  // Code-server state
  const [codeServerPort, setCodeServerPort] = useState<number | null>(null);
  const [codeServerRunning, setCodeServerRunning] = useState(false);
  const [startingCodeServer, setStartingCodeServer] = useState(false);

  // Debug: Log preview URL changes
  useEffect(() => {
    console.log('🎬 [Frontend] Preview URL changed to:', previewUrl);
  }, [previewUrl]);

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<{ terminal: Terminal; ws: WebSocket; fitAddon: FitAddon } | null>(null);
  const isDarkRef = useRef<boolean>(false);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the effective theme
  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const isDark = effectiveTheme === 'dark';

  // Keep ref in sync with current theme
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Terminal themes
  const darkTheme = {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  };

  const lightTheme = {
    background: '#ffffff',
    foreground: '#1e1e1e',
    cursor: '#1e1e1e',
    cursorAccent: '#ffffff',
    selectionBackground: '#add6ff',
    selectionForeground: '#1e1e1e',
    black: '#000000',
    red: '#cd3131',
    green: '#008000',
    yellow: '#6d5c00',
    blue: '#0451a5',
    magenta: '#a31515',
    cyan: '#098658',
    white: '#383838',
    brightBlack: '#555555',
    brightRed: '#cd3131',
    brightGreen: '#007700',
    brightYellow: '#5c4d00',
    brightBlue: '#0451a5',
    brightMagenta: '#a31515',
    brightCyan: '#098658',
    brightWhite: '#2d2d2d',
  };

  // Load project
  useEffect(() => {
    if (!user || !session || !params.id) return;

    const loadProject = async () => {
      setLoading(true);
      try {
        const supabase = createClerkSupabaseClient(() => session.getToken());

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
          .eq('clerk_user_id', user.id)
          .single();

        if (error) throw error;

        if (!data) {
          setError('Project not found');
        } else {
          setProject(data);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, params.id]); // Only depend on stable IDs, not session

  // Start terminal server
  useEffect(() => {
    if (!project) return;

    const startServer = async () => {
      setServerStarting(true);
      try {
        const response = await fetch('/api/terminal/start', {
          method: 'POST',
        });

        const data = await response.json();

        if (data.success && data.port) {
          setServerPort(data.port);
        } else {
          setError('Failed to start terminal server: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Error starting terminal server:', err);
        setError('Failed to connect to terminal server');
      } finally {
        setServerStarting(false);
      }
    };

    startServer();
  }, [project?.id]);

  // Check if dev server is running and auto-start if needed
  useEffect(() => {
    if (!project) return;

    const checkAndStartServer = async () => {
      console.log('🔄 [Frontend] Starting server check/start sequence');
      console.log('🔄 [Frontend] Project:', project.id);
      console.log('🔄 [Frontend] Path:', project.project_path);

      setCheckingServer(true);
      try {
        // Check if server is already running
        console.log('🔍 [Frontend] Checking if server is already running...');
        const checkResponse = await fetch(
          `/api/check-server-status?path=${encodeURIComponent(project.project_path)}`
        );
        const checkData = await checkResponse.json();
        console.log('🔍 [Frontend] Check response:', checkData);

        if (checkData.running && checkData.port) {
          setDevServerPort(checkData.port);
          setServerRunning(true);

          if (checkData.healthy) {
            console.log('✅ [Frontend] Server HEALTHY on port:', checkData.port);
            const url = `http://localhost:${checkData.port}`;
            console.log('✅ [Frontend] Setting preview URL:', url);
            setPreviewUrl(url);
          } else {
            console.log('⏳ [Frontend] Server STARTING on port:', checkData.port, '- waiting for health check...');
            // Server is starting, poll until it's healthy
            let attempts = 0;
            const maxAttempts = 10; // 10 attempts * 2 seconds = 20 seconds max
            healthCheckIntervalRef.current = setInterval(async () => {
              attempts++;
              console.log(`⏳ [Frontend] Health check attempt ${attempts}/${maxAttempts}...`);

              const pollResponse = await fetch(
                `/api/check-server-status?path=${encodeURIComponent(project.project_path)}`
              );
              const pollData = await pollResponse.json();

              if (pollData.healthy) {
                console.log('✅ [Frontend] Server now HEALTHY!');
                const url = `http://localhost:${pollData.port}`;
                setPreviewUrl(url);
                if (healthCheckIntervalRef.current) {
                  clearInterval(healthCheckIntervalRef.current);
                  healthCheckIntervalRef.current = null;
                }
              } else if (attempts >= maxAttempts) {
                console.log('❌ [Frontend] Health check timed out - server appears stuck, auto-restarting...');
                if (healthCheckIntervalRef.current) {
                  clearInterval(healthCheckIntervalRef.current);
                  healthCheckIntervalRef.current = null;
                }

                // Automatically restart the stuck server
                setCheckingServer(false);
                setStartingServer(false);
                handleRestartServer();
              }
            }, 2000);
          }
        } else {
          // Server not running, start it
          console.log('❌ [Frontend] Server NOT running, starting now...');
          setStartingServer(true);

          const startResponse = await fetch('/api/start-server-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: project.project_path }),
          });

          const startData = await startResponse.json();
          console.log('🚀 [Frontend] Start response:', startData);

          if (startData.success && startData.port) {
            console.log('✅ [Frontend] Server STARTED on port:', startData.port);
            setDevServerPort(startData.port);
            const url = `http://localhost:${startData.port}`;
            console.log('✅ [Frontend] Setting preview URL:', url);
            setPreviewUrl(url);
            setServerRunning(true);
          } else {
            throw new Error(startData.error || 'Failed to start server');
          }
        }
      } catch (error) {
        console.error('💥 [Frontend] Error checking/starting server:', error);
        setError('Failed to start development server. Click Restart to try again.');
      } finally {
        setCheckingServer(false);
        setStartingServer(false);
        console.log('✅ [Frontend] Server check/start sequence complete');
      }
    };

    checkAndStartServer();

    // Cleanup function to clear interval when component unmounts or dependencies change
    return () => {
      if (healthCheckIntervalRef.current) {
        console.log('🧹 [Frontend] Cleaning up health check polling interval');
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [project?.id, project?.project_path]);

  // Update terminal theme when theme changes
  useEffect(() => {
    if (terminalInstanceRef.current) {
      const { terminal, ws } = terminalInstanceRef.current;
      const newTheme = isDark ? darkTheme : lightTheme;
      terminal.options.theme = newTheme;

      // Force tmux to redraw by sending a resize event (triggers refresh)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }));
      }
    }
  }, [isDark]);

  // Check/start global code-server once when project loads
  useEffect(() => {
    if (!project) return;

    const ensureGlobalCodeServer = async () => {
      console.log('[global-code-server] Checking if global code-server is running...');

      // Check if global code-server is already running
      try {
        const checkResponse = await fetch('/api/global-code-server');
        const checkData = await checkResponse.json();

        if (checkData.running && checkData.port) {
          console.log('[global-code-server] ✅ Already running on port:', checkData.port);
          setCodeServerPort(checkData.port);
          setCodeServerRunning(true);
          return;
        }
      } catch (error) {
        console.error('[global-code-server] Error checking status:', error);
      }

      // Code-server not running, start it
      console.log('[global-code-server] Starting global code-server...');
      setStartingCodeServer(true);

      try {
        const startResponse = await fetch('/api/global-code-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const startData = await startResponse.json();
        console.log('[global-code-server] Start response:', startData);

        if (startData.success && startData.port) {
          console.log('[global-code-server] ✅ Code-server started on port:', startData.port);
          setCodeServerPort(startData.port);
          setCodeServerRunning(true);
        } else {
          throw new Error(startData.error || 'Failed to start code-server');
        }
      } catch (error) {
        console.error('[global-code-server] Error starting code-server:', error);
      } finally {
        setStartingCodeServer(false);
      }
    };

    ensureGlobalCodeServer();

    // No cleanup - global code-server stays running across projects
  }, [project?.id]);

  // Initialize terminal once server is ready
  useEffect(() => {
    if (!project || !terminalRef.current || !serverPort) return;
    if (terminalInstanceRef.current) return;

    setError(null);
    setConnecting(true);

    const initialTheme = isDark ? darkTheme : lightTheme;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace, "Apple Color Emoji"',
      scrollback: 10000,
      scrollOnUserInput: false,
      fastScrollModifier: 'shift',
      allowTransparency: false,
      theme: initialTheme,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    const wsUrl = `ws://localhost:${serverPort}?path=${encodeURIComponent(project.project_path)}&project=${encodeURIComponent(project.id)}&cmd=claude`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnecting(false);
      setTimeout(() => {
        fitAddon.fit();
      }, 150);
    };

    ws.onmessage = (event) => {
      let data = event.data;

      // Don't filter in dark mode - just pass through
      if (isDarkRef.current) {
        terminal.write(data);
        return;
      }

      // LIGHT MODE ONLY - Filter ANSI codes to convert white/light colors to dark
      // Replace 256-color white/light codes
      data = data.replace(/\x1b\[38;5;231m/g, '\x1b[38;5;16m'); // bright white (231) -> black (16)
      data = data.replace(/\x1b\[38;5;247m/g, '\x1b[38;5;240m'); // light gray (247) -> dark gray (240)
      data = data.replace(/\x1b\[38;5;255m/g, '\x1b[38;5;16m'); // white (255) -> black (16)
      data = data.replace(/\x1b\[38;5;15m/g, '\x1b[38;5;16m'); // bright white (15) -> black (16)

      // Replace basic 16-color white codes (fallback)
      data = data.replace(/\x1b\[97m/g, '\x1b[90m'); // bright white -> bright black
      data = data.replace(/\x1b\[1;37m/g, '\x1b[90m'); // bold white -> bright black
      data = data.replace(/\x1b\[37m/g, '\x1b[30m'); // white -> black

      terminal.write(data);

      // Listen for localhost URLs in terminal output to auto-update preview
      const urlMatch = event.data.match(/https?:\/\/localhost:\d+/);
      if (urlMatch && !previewUrl) {
        setPreviewUrl(urlMatch[0]);
        setServerRunning(true);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to terminal');
      setConnecting(false);
    };

    ws.onclose = (event) => {
      setError('Connection closed');
      setConnecting(false);
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Mouse scrolling support
    let startY = 0;
    let isScrolling = false;
    let lastScrollTime = 0;

    // Disable tmux mouse mode entirely on connection
    // We'll handle scrolling via wheel events, and selection via xterm.js
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l');
    }

    // Use xterm's attachCustomWheelEventHandler to intercept wheel events for scrolling
    // With tmux mouse mode off, we use tmux copy mode for scrolling
    let inCopyMode = false;

    (terminal as any).attachCustomWheelEventHandler?.((e: WheelEvent) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return true;
      }

      // Prevent page scroll
      e.preventDefault();
      e.stopPropagation();

      const currentTime = Date.now();
      if (currentTime - lastScrollTime < 50) {
        return false; // Throttle
      }

      // Calculate scroll amount - about 1/3 of terminal height
      const linesToScroll = Math.max(5, Math.floor(terminal.rows / 3));

      // Enter copy mode if not already in it
      if (!inCopyMode) {
        ws.send('\x02['); // Ctrl+B then [
        inCopyMode = true;

        // Small delay before sending scroll commands
        setTimeout(() => {
          for (let i = 0; i < linesToScroll; i++) {
            if (e.deltaY < 0) {
              ws.send('\x1b[A'); // Up arrow
            } else {
              ws.send('\x1b[B'); // Down arrow
            }
          }
        }, 10);
      } else {
        // Already in copy mode, just send scroll commands
        for (let i = 0; i < linesToScroll; i++) {
          if (e.deltaY < 0) {
            ws.send('\x1b[A'); // Up arrow
          } else {
            ws.send('\x1b[B'); // Down arrow
          }
        }
      }

      lastScrollTime = currentTime;

      // Auto-exit copy mode after 2 seconds of no scrolling
      setTimeout(() => {
        if (inCopyMode && Date.now() - lastScrollTime > 1800) {
          ws.send('q'); // Exit copy mode
          inCopyMode = false;
        }
      }, 2000);

      return false;
    });

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      const currentTime = Date.now();

      if (Math.abs(deltaY) > 20) {
        isScrolling = true;
        e.preventDefault();
        e.stopPropagation();

        if (currentTime - lastScrollTime > 100) {
          const charX = Math.floor(terminal.cols / 2);
          const charY = Math.floor(terminal.rows / 2);
          const scrollSteps = Math.min(Math.ceil(Math.abs(deltaY) / 40), 5);

          for (let i = 0; i < scrollSteps; i++) {
            if (deltaY < 0) {
              ws.send(`\x1b[<64;${charX};${charY}M`);
            } else {
              ws.send(`\x1b[<65;${charX};${charY}M`);
            }
          }

          lastScrollTime = currentTime;
          startY = currentY;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isScrolling) {
        e.preventDefault();
        e.stopPropagation();
      }
      isScrolling = false;
    };

    // Attach touch event handlers for mobile scrolling
    const terminalElement = terminalRef.current?.querySelector('.xterm') as HTMLElement;
    if (terminalElement) {
      terminalElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      terminalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      terminalElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows,
          }));
        }
      }, 50);
    });

    // Observe the container, not the terminal element itself
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    terminalInstanceRef.current = { terminal, ws, fitAddon };

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();

      if (terminalElement) {
        terminalElement.removeEventListener('touchstart', handleTouchStart);
        terminalElement.removeEventListener('touchmove', handleTouchMove);
        terminalElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [project?.id, project?.project_path, serverPort, isDark, previewUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalInstanceRef.current) {
        const { terminal, ws } = terminalInstanceRef.current;
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
        terminal.dispose();
        terminalInstanceRef.current = null;
      }
    };
  }, []);

  const getDisplayName = (proj: Project) => {
    if (proj.project_name.includes('/') || proj.project_name.includes('\\')) {
      return proj.project_name.split(/[\/\\]/).filter(Boolean).pop() || proj.project_name;
    }
    return proj.project_name;
  };

  // Action handlers
  const handleStartServer = async () => {
    if (!project) return;

    console.log('▶️ [Frontend] ========== MANUAL START REQUEST ==========');
    console.log('▶️ [Frontend] Project path:', project.project_path);

    setCheckingServer(true);
    setStartingServer(true);
    setError(null);

    try {
      // Try to start the server
      const startResponse = await fetch('/api/start-server-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.project_path }),
      });

      const startData = await startResponse.json();
      console.log('▶️ [Frontend] Start response:', startData);

      if (startData.success && startData.port) {
        console.log('✅ [Frontend] Server started on port:', startData.port);
        setDevServerPort(startData.port);
        setPreviewUrl(`http://localhost:${startData.port}`);
        setServerRunning(true);
      } else {
        throw new Error(startData.error || 'Failed to start server');
      }
    } catch (error: any) {
      console.error('💥 [Frontend] Error starting server:', error);
      setError(error.message || 'Failed to start development server. Click Start to try again.');
      setServerRunning(false);
      setPreviewUrl(null);
    } finally {
      setCheckingServer(false);
      setStartingServer(false);
      console.log('▶️ [Frontend] ========== START COMPLETE ==========');
    }
  };

  const handleStopServer = async () => {
    if (!project) return;

    console.log('🛑 [Frontend] ========== STOPPING SERVER ==========');
    console.log('🛑 [Frontend] Project path:', project.project_path);

    try {
      const response = await fetch('/api/stop-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: project.project_path,
        }),
      });

      const data = await response.json();
      console.log('🛑 [Frontend] Stop response:', data);

      if (response.ok && data.success) {
        console.log('✅ [Frontend] Server stopped successfully');
        setServerRunning(false);
        setPreviewUrl(null);
        setDevServerPort(null);
      } else {
        throw new Error(data.error || 'Failed to stop server');
      }
    } catch (error: any) {
      console.error('💥 [Frontend] Error stopping server:', error);
      setError(error.message || 'Failed to stop server');
    } finally {
      console.log('🛑 [Frontend] ========== STOP COMPLETE ==========');
    }
  };

  const loadGitStatus = async () => {
    if (!project) return;

    setLoadingGitStatus(true);
    try {
      const response = await fetch('/api/git-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.project_path }),
      });

      const data: GitDiffResponse = await response.json();
      setGitStatus(data);

      // Auto-select first file if available
      if (data.files.length > 0) {
        setSelectedFile(data.files[0].path);
        await loadFileDiff(project.project_path, data.files[0].path);
      }
    } catch (error) {
      console.error('Error loading git status:', error);
    } finally {
      setLoadingGitStatus(false);
    }
  };

  const loadFileDiff = async (projectPath: string, filePath: string) => {
    setLoadingDiff(true);
    try {
      const response = await fetch('/api/git-file-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filePath }),
      });

      const data: GitFileDiffResponse = await response.json();
      setFileDiff(data);
    } catch (error) {
      console.error('Error loading file diff:', error);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleViewChanges = async () => {
    if (!project) return;

    // Always switch to changes view and load git status
    setViewMode('changes');
    await loadGitStatus();
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    if (project) {
      loadFileDiff(project.project_path, filePath);
    }
  };

  const handleSave = () => {
    if (!project) return;
    router.push(`/home/project/${project.id}/save`);
  };

  const handleRefreshPreview = () => {
    setPreviewUrl((prev) => prev ? `${prev}?t=${Date.now()}` : prev);
  };

  const handleRestartServer = async () => {
    if (!project) {
      console.log('🔄 [Frontend] Restart aborted - missing project');
      return;
    }

    console.log('🔄 [Frontend] ========== RESTARTING SERVER ==========');
    console.log('🔄 [Frontend] Project path:', project.project_path);

    setRestartingServer(true);
    setError(null); // Clear any previous errors
    try {
      const response = await fetch('/api/restart-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: project.project_path,
        }),
      });

      const data = await response.json();
      console.log('🔄 [Frontend] Restart response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to restart server');
      }

      if (data.success && data.port) {
        console.log('✅ [Frontend] Server restarted on port:', data.port);
        setDevServerPort(data.port);
        const url = `http://localhost:${data.port}`;
        console.log('✅ [Frontend] Setting new preview URL:', url);
        setPreviewUrl(url);
        setServerRunning(true);
      } else {
        throw new Error('Server restart returned invalid response');
      }
    } catch (error: any) {
      console.error('💥 [Frontend] Error restarting server:', error);
      setError(error.message || 'Failed to restart server. Click Restart to try again.');
      setServerRunning(false);
      setPreviewUrl(null);
    } finally {
      setRestartingServer(false);
      console.log('🔄 [Frontend] ========== RESTART COMPLETE ==========');
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  if (loading || serverStarting) {
    return (
      <>
        <SetBreadcrumbName name="Loading..." />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading project...' : 'Starting terminal server...'}
          </p>
        </div>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <SetBreadcrumbName name="Error" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-red-600 dark:text-red-400">
              {error || 'Project not found'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SetBreadcrumbName name={getDisplayName(project)} />

      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - Terminal */}
            <ResizablePanel
              defaultSize={33}
              minSize={20}
              maxSize={50}
              onResize={() => {
                // Trigger terminal resize when panel size changes
                if (terminalInstanceRef.current) {
                  setTimeout(() => {
                    const { terminal, ws, fitAddon } = terminalInstanceRef.current!;
                    const oldCols = terminal.cols;
                    const oldRows = terminal.rows;
                    fitAddon.fit();
                    const newCols = terminal.cols;
                    const newRows = terminal.rows;

                    if (ws.readyState === WebSocket.OPEN && (oldCols !== newCols || oldRows !== newRows)) {
                      ws.send(JSON.stringify({
                        type: 'resize',
                        cols: newCols,
                        rows: newRows,
                      }));
                    }
                  }, 50);
                }
              }}
            >
              <div className="h-full flex flex-col p-2 pr-1">
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Claude Code
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        serverRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex items-center gap-2">
                      {!serverRunning ? (
                        <Button
                          onClick={handleStartServer}
                          size="sm"
                          className="h-7 gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <Play className="h-3 w-3" fill="currentColor" />
                          Start
                        </Button>
                      ) : (
                        <Button
                          onClick={handleStopServer}
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1.5 rounded-lg text-xs"
                        >
                          <Square className="h-3 w-3" fill="currentColor" />
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Terminal Body */}
                  <div ref={terminalContainerRef} className="flex-1 relative overflow-hidden">
                    <div
                      ref={terminalRef}
                      className={`w-full h-full ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}
                    />
                    {connecting && (
                      <div className={`absolute inset-0 flex items-center justify-center ${
                        isDark ? 'bg-[#1e1e1e]/90' : 'bg-white/90'
                      } backdrop-blur-sm`}>
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                          <p className="text-sm font-medium text-muted-foreground">Connecting to Claude Code...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Preview */}
            <ResizablePanel defaultSize={67} minSize={50}>
              <div className="h-full flex flex-col p-2 pl-1">
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700">
                  {/* Preview Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setViewMode('preview')}
                          size="sm"
                          variant={viewMode === 'preview' ? 'default' : 'ghost'}
                          className={`h-7 gap-1.5 rounded-lg text-xs ${
                            viewMode === 'preview'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                        <Button
                          onClick={handleViewChanges}
                          size="sm"
                          variant={viewMode === 'changes' ? 'default' : 'ghost'}
                          className={`h-7 gap-1.5 rounded-lg text-xs ${
                            viewMode === 'changes'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Code2 className="h-3 w-3" />
                          Changes
                        </Button>
                        <Button
                          onClick={() => setViewMode('code')}
                          size="sm"
                          variant={viewMode === 'code' ? 'default' : 'ghost'}
                          className={`h-7 gap-1.5 rounded-lg text-xs ${
                            viewMode === 'code'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Code2 className="h-3 w-3" />
                          Code
                        </Button>
                      </div>
                      {viewMode === 'preview' && previewUrl && (
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-500 truncate max-w-xs">
                          {previewUrl}
                        </span>
                      )}
                      {viewMode === 'changes' && gitStatus && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {gitStatus.totalFiles} file{gitStatus.totalFiles !== 1 ? 's' : ''} changed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {viewMode === 'preview' && previewUrl && (
                        <>
                          <Button
                            onClick={handleOpenInNewTab}
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 rounded-lg text-xs"
                            title="Open in New Tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={handleRestartServer}
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 rounded-lg text-xs"
                            disabled={restartingServer}
                            title="Restart Server"
                          >
                            <RotateCw className={`h-3 w-3 ${restartingServer ? 'animate-spin' : ''}`} />
                          </Button>
                        </>
                      )}
                      {viewMode === 'changes' && (
                        <Button
                          onClick={loadGitStatus}
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 rounded-lg text-xs"
                          disabled={loadingGitStatus}
                        >
                          <RefreshCw className={`h-3 w-3 ${loadingGitStatus ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      )}
                      <Button
                        onClick={handleSave}
                        size="sm"
                        className="h-7 gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs shadow-lg"
                      >
                        <Save className="h-3 w-3" />
                        Save & Publish
                      </Button>
                    </div>
                  </div>

                  {/* Preview/Changes/Code Body */}
                  <div className="flex-1 relative overflow-hidden bg-white dark:bg-gray-950">
                    {viewMode === 'changes' && (
                      // Show diff viewer
                      loadingGitStatus ? (
                        <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                        </div>
                      ) : (
                        <DiffViewer
                          gitStatus={gitStatus}
                          selectedFile={selectedFile}
                          fileDiff={fileDiff}
                          loadingDiff={loadingDiff}
                          onFileSelect={handleFileSelect}
                        />
                      )
                    )}

                    {viewMode === 'code' && (
                      // Show code-server iframe with ?folder= parameter
                      codeServerPort && project ? (
                        <iframe
                          key={`code-server-${project.id}`}
                          src={`http://localhost:${codeServerPort}/?folder=${encodeURIComponent(project.project_path)}`}
                          className="w-full h-full border-0"
                          title="Code Editor"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                          {startingCodeServer ? (
                            <>
                              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  Starting Code Editor...
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                  Launching VSCode in your browser. This may take a moment...
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
                                <Code2 className="h-8 w-8 text-blue-600" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  Code Editor Not Running
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                  The code editor failed to start. Please try switching to another tab and back.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    )}

                    {viewMode === 'preview' && (
                      // Show preview iframe
                      previewUrl ? (
                        <>
                          <iframe
                            key="preview"
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title="Preview"
                          />
                          {restartingServer && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
                              <div className="flex flex-col items-center gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                <p className="text-sm font-medium text-muted-foreground">Restarting server...</p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                          {checkingServer || startingServer ? (
                            <>
                              <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {checkingServer
                                    ? 'Checking server...'
                                    : serverRunning && !previewUrl
                                      ? 'Compiling...'
                                      : 'Starting server...'}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                  {checkingServer
                                    ? 'Looking for running development server...'
                                    : serverRunning && !previewUrl
                                      ? 'Server is running but still compiling. This may take a moment...'
                                      : 'Starting your development server. This may take a moment...'}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center">
                                <Play className="h-8 w-8 text-purple-600" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  Server Error
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                  {error || 'Failed to start development server. Click Restart to try again.'}
                                </p>
                              </div>
                              <Button
                                onClick={handleRestartServer}
                                className="gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg"
                                disabled={restartingServer}
                              >
                                <RotateCw className={`h-4 w-4 ${restartingServer ? 'animate-spin' : ''}`} />
                                <span className="font-semibold">Restart Server</span>
                              </Button>
                            </>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </>
  );
}
