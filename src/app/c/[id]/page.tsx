'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Mic, Share2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import ResponseRenderer from '@/components/ResponseRenderer';
import { useConversation } from '@/contexts/ConversationContext';
import { useUser } from '@stackframe/stack';

export default function SharedConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useUser();
  const { addUserMessage, addAIMessage, conversationHistory, clearConversation, startConversation } = useConversation();
  
  interface Message {
    type: 'user' | 'ai';
    content: string;
    images?: string[];
    citations?: Array<{ title: string; url: string }>;
    timestamp: string;
  }
  
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('humblai-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Fetch conversation and messages
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setIsLoading(true);
        // Use public endpoint that doesn't require authentication
        const response = await fetch(`/api/conversations/${conversationId}/public`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Conversation not found');
          } else {
            setError('Failed to load conversation');
          }
          return;
        }

        const data = await response.json();
        setConversation(data.conversation);
        
        // Convert messages to conversation history format
        interface FormattedMessage {
          type: 'user' | 'ai';
          content: string;
          images: string[];
          citations?: Array<{ title: string; url: string }>;
          timestamp: string;
        }
        
        const formattedMessages: FormattedMessage[] = (data.conversation.messages || []).map((msg: any) => ({
          type: msg.role === 'user' ? 'user' : 'ai' as 'user' | 'ai',
          content: msg.content || '',
          images: msg.images || [],
          citations: msg.citations || [],
          timestamp: msg.created_at || new Date().toISOString(),
        }));
        
        setMessages(formattedMessages);
        
        // Load into conversation context if user wants to continue
        clearConversation();
        formattedMessages.forEach((msg: FormattedMessage) => {
          if (msg.type === 'user') {
            addUserMessage(msg.content, msg.images);
          } else {
            addAIMessage(msg.content, msg.images, msg.citations);
          }
        });
        
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError('Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId, clearConversation, addUserMessage, addAIMessage]);

  const handleContinueConversation = async () => {
    if (!query.trim() || isStreaming) return;

    const userQuery = query;
    setQuery('');
    addUserMessage(userQuery);

    setIsStreaming(true);
    setStreamingResponse('');

    try {
      // Build conversation history from loaded messages + new query
      const allMessages: Message[] = [...messages, { type: 'user', content: userQuery, images: [], timestamp: new Date().toISOString() }];
      const historyForAPI = allMessages
        .filter((msg: Message) => msg.content && msg.content.trim() !== '')
        .map((msg: Message) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content || '',
          images: msg.images || [],
        }));

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          images: [],
          mode: 'default',
          conversationHistory: historyForAPI,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingResponse(fullResponse);
              }
              if (data.done) {
                break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      addAIMessage(fullResponse);
      
      // Update messages state to include the new messages
      const newUserMessage = { type: 'user' as const, content: userQuery, images: [], timestamp: new Date().toISOString() };
      const newAIMessage = { type: 'ai' as const, content: fullResponse, images: [], citations: [], timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, newUserMessage, newAIMessage]);
      
      setStreamingResponse('');
      
      // If user is logged in, save the continuation to a new conversation
      // Use a ref to track if we've already created a continuation conversation
      if (user) {
        const continuationKey = `continuation_${conversationId}`;
        let newConversationId = sessionStorage.getItem(continuationKey);
        
        try {
          if (!newConversationId) {
            // Create a new conversation based on the shared one
            const response = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                title: `Continuation: ${conversation?.title || 'Shared Conversation'}` 
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              newConversationId = data.conversation.id;
              if (newConversationId) {
                sessionStorage.setItem(continuationKey, newConversationId);
                
                // Save all original messages first
                for (const msg of messages) {
                  await fetch(`/api/conversations/${newConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      role: msg.type,
                      content: msg.content,
                      images: msg.images || [],
                      citations: msg.citations || [],
                      mode: 'default'
                    }),
                  });
                }
              }
            }
          }
          
          // Save the new messages to continuation
          if (newConversationId) {
            await fetch(`/api/conversations/${newConversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'user',
                content: userQuery,
                images: [],
                mode: 'default'
              }),
            });
            
            await fetch(`/api/conversations/${newConversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'assistant',
                content: fullResponse,
                images: [],
                citations: [],
                mode: 'default'
              }),
            });
          }
        } catch (err) {
          console.error('Failed to save continuation:', err);
          // Continue anyway - user can still interact
        }
      }
    } catch (error) {
      console.error('Error continuing conversation:', error);
      addAIMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/c/${conversationId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Conversation link copied to clipboard!');
    } catch (err) {
      prompt('Copy this link:', shareUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" data-theme={theme} style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent mx-auto mb-4" style={{ borderColor: '#f1d08c' }} />
          <p style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" data-theme={theme} style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#f1d08c', color: '#000000' }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col transition-colors duration-300" data-theme={theme} style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
      {/* Header */}
      <div className="w-full border-b transition-colors duration-300" style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
        <div className="w-full px-4 md:px-8 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-300"
              style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
            >
              <ArrowLeft size={18} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
              <span className="text-sm" style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }}>Back</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-6 w-auto opacity-90" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg transition-colors duration-300"
                style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
                title="Share conversation"
              >
                <Share2 size={18} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversation Title */}
          {conversation && (
            <div className="mb-6">
              <h1 className="text-2xl font-semibold mb-2 transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                {conversation.title || 'Shared Conversation'}
              </h1>
              <p className="text-sm transition-colors duration-300" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Shared conversation • {new Date(conversation.created_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'rounded-br-none'
                    : 'rounded-bl-none'
                }`}
                style={{
                  backgroundColor: message.type === 'user'
                    ? '#f1d08c'
                    : theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
                  color: message.type === 'user' ? '#000000' : (theme === 'dark' ? '#e5e7eb' : '#111827'),
                }}
              >
                {message.type === 'ai' ? (
                  <ResponseRenderer
                    content={index === messages.length - 1 && isStreaming ? streamingResponse : message.content}
                    isLoading={index === messages.length - 1 && isStreaming}
                    theme={theme}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message placeholder */}
          {isStreaming && !streamingResponse && (
            <div className="flex justify-start">
              <div
                className="max-w-[85%] md:max-w-[70%] rounded-lg rounded-bl-none px-4 py-3"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
                }}
              >
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Continue Conversation Input */}
      <div className="w-full border-t transition-colors duration-300" style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
        <div className="w-full px-4 md:px-8 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleContinueConversation();
                    }
                  }}
                  placeholder="Continue this conversation..."
                  className="w-full px-4 py-3 pr-12 rounded-2xl border-none outline-none transition-colors duration-300"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  disabled={isStreaming}
                />
                <button
                  onClick={handleContinueConversation}
                  disabled={!query.trim() || isStreaming}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#f1d08c' }}
                >
                  <Send size={18} className="text-black" />
                </button>
              </div>
            </div>
            {!user && (
              <p className="text-xs mt-2 text-center transition-colors duration-300" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Continue without account • <button onClick={() => router.push('/handler/signup')} className="underline">Sign up</button> to save your conversations
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

