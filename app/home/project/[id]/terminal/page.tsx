'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [serverStarting, setServerStarting] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<{ terminal: Terminal; ws: WebSocket; fitAddon: FitAddon } | null>(null);

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
  }, [user?.id, params.id]); // Only depend on user.id - session is captured in closure and checked at runtime

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]); // Only depend on project.id - project is captured in closure

  // Initialize terminal once server is ready
  useEffect(() => {
    if (!project || !terminalRef.current || !serverPort) return;

    // Don't create if already exists
    if (terminalInstanceRef.current) return;

    // Clear any previous errors when creating new terminal
    setError(null);
    setConnecting(true);

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace, "Apple Color Emoji"',
      scrollback: 10000,
      scrollOnUserInput: false,
      fastScrollModifier: 'shift',
      allowTransparency: false,
      theme: {
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
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);

    // Fit terminal to container after a brief delay to ensure DOM is ready
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Connect to WebSocket
    const wsUrl = `ws://localhost:${serverPort}?path=${encodeURIComponent(project.project_path)}&project=${encodeURIComponent(project.id)}&cmd=claude`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnecting(false);
      setTimeout(() => {
        fitAddon.fit();
      }, 150);
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
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

    // SGR mouse protocol for tmux scrolling (based on working implementation)
    let startY = 0;
    let isScrolling = false;
    let lastScrollTime = 0;

    const handleWheel = (e: WheelEvent) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      e.preventDefault();
      e.stopPropagation();

      const currentTime = Date.now();

      // Throttle scroll events
      if (currentTime - lastScrollTime > 50) {
        // Use center of terminal for mouse position
        const charX = Math.floor(terminal.cols / 2);
        const charY = Math.floor(terminal.rows / 2);

        if (e.deltaY < 0) {
          // Scroll up (show earlier content)
          // SGR format: \x1b[<64;x;yM (wheel up)
          const sgrWheelUp = `\x1b[<64;${charX};${charY}M`;
          ws.send(sgrWheelUp);
        } else if (e.deltaY > 0) {
          // Scroll down (show later content)
          // SGR format: \x1b[<65;x;yM (wheel down)
          const sgrWheelDown = `\x1b[<65;${charX};${charY}M`;
          ws.send(sgrWheelDown);
        }

        lastScrollTime = currentTime;
      }
    };

    // Handle touch scrolling for mobile
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      const currentTime = Date.now();

      // Only handle vertical scrolling with minimum threshold
      if (Math.abs(deltaY) > 20) {
        isScrolling = true;
        e.preventDefault();
        e.stopPropagation();

        // Throttle scroll events
        if (currentTime - lastScrollTime > 100) {
          const charX = Math.floor(terminal.cols / 2);
          const charY = Math.floor(terminal.rows / 2);

          // Calculate scroll steps based on gesture size
          const scrollSteps = Math.min(Math.ceil(Math.abs(deltaY) / 40), 5);

          for (let i = 0; i < scrollSteps; i++) {
            if (deltaY < 0) {
              // Swipe down = scroll up (show earlier content)
              ws.send(`\x1b[<64;${charX};${charY}M`);
            } else {
              // Swipe up = scroll down (show later content)
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

    if (terminalRef.current) {
      terminalRef.current.addEventListener('wheel', handleWheel, { passive: false });
      terminalRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
      terminalRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
      terminalRef.current.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    // Handle resize
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

    // Also watch the terminal container for size changes (with throttling)
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
      }, 100);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Store instance
    terminalInstanceRef.current = { terminal, ws, fitAddon };

    // Only clean up the resize listener and observer - terminal and WebSocket stay alive
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('wheel', handleWheel);
        terminalRef.current.removeEventListener('touchstart', handleTouchStart);
        terminalRef.current.removeEventListener('touchmove', handleTouchMove);
        terminalRef.current.removeEventListener('touchend', handleTouchEnd);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.project_path, serverPort]); // Only depend on stable IDs

  // Cleanup terminal and WebSocket ONLY on true unmount (navigation away)
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
  }, []); // Empty deps = only runs on true unmount

  const getDisplayName = (proj: Project) => {
    if (proj.project_name.includes('/') || proj.project_name.includes('\\')) {
      return proj.project_name.split(/[\/\\]/).filter(Boolean).pop() || proj.project_name;
    }
    return proj.project_name;
  };

  // Show loading state only until server is ready
  if (loading || serverStarting) {
    return (
      <>
        <SetBreadcrumbName name="Terminal" />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading project...' : 'Starting terminal server...'}
          </p>
        </div>
      </>
    );
  }

  // Show error state
  if (error || !project) {
    return (
      <>
        <SetBreadcrumbName name="Terminal" />
        <div className="space-y-6">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                {error || 'Project not found'}
              </CardTitle>
              <CardDescription>
                {error === 'Connection closed'
                  ? 'The terminal connection was closed. Please refresh the page to reconnect.'
                  : 'The project you are looking for does not exist or you do not have access to it.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Show terminal
  return (
    <>
      <SetBreadcrumbName name={getDisplayName(project)} />

      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3e3e42]">
          <div>
            <h1 className="text-2xl font-bold">Claude Code Terminal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {getDisplayName(project)} • {project.project_path}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/home/project/${project.id}`)}
          >
            <X className="h-4 w-4 mr-2" />
            Close Terminal
          </Button>
        </div>

        <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden">
          <div
            ref={terminalRef}
            className="w-full h-full bg-[#1e1e1e]"
          />
          {connecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm text-muted-foreground">Connecting to terminal...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
