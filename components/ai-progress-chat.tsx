'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface AIMessage {
  content: string;
  type: 'text' | 'tool' | 'output';
}

interface AIProgressChatProps {
  messages: AIMessage[];
  isLoading?: boolean;
  title?: string;
}

export function AIProgressChat({ messages, isLoading = false, title }: AIProgressChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showDetailed, setShowDetailed] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter messages based on view mode
  const filteredMessages = showDetailed
    ? messages
    : messages.filter(msg => msg.type === 'text');

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
      {title && (
        <div className="mb-4 text-center flex-shrink-0">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}

      <Card className="border-2 flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              AI Progress
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetailed(!showDetailed)}
              className="gap-2 h-8"
            >
              {showDetailed ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Simple View
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Detailed View
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-4 flex-1 overflow-y-auto">
            {messages.length === 0 && isLoading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Initializing AI agent...</span>
              </div>
            )}

            {filteredMessages.map((message, index) => (
              <div
                key={index}
                className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                    message.type === 'text'
                      ? 'bg-gradient-to-br from-teal-600 to-cyan-600'
                      : message.type === 'tool'
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                      : 'bg-gradient-to-br from-blue-600 to-sky-600'
                  }`}>
                    {message.type === 'text' ? 'AI' : message.type === 'tool' ? '⚙️' : '✓'}
                  </div>
                </div>
                <div className={`flex-1 rounded-lg p-3 ${
                  message.type === 'text'
                    ? 'bg-muted'
                    : message.type === 'tool'
                    ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800'
                    : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap font-mono">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && messages.length > 0 && (
              <div className="flex items-center gap-3 text-muted-foreground pl-11">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Working on it...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {filteredMessages.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {filteredMessages.length} {filteredMessages.length === 1 ? 'update' : 'updates'} from AI
          {!showDetailed && messages.length > filteredMessages.length && (
            <span className="ml-2 text-xs">
              ({messages.length - filteredMessages.length} technical {messages.length - filteredMessages.length === 1 ? 'message' : 'messages'} hidden)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
