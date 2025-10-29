'use client';

import { useState } from 'react';
import Image from 'next/image';
import ResponseRenderer from '../components/ResponseRenderer';

interface SearchResult {
  query: string;
  response: string;
  timestamp: string;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{type: 'user' | 'ai', content: string, timestamp: string}>>([]);
  const [thinkingText, setThinkingText] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Start conversation and add user message to history
    setConversationStarted(true);
    const userMessage = {
      type: 'user' as const,
      content: searchQuery,
      timestamp: new Date().toISOString()
    };
    setConversationHistory(prev => [...prev, userMessage]);

    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setStreamingResponse('');
    
    // Start thinking text rotation
    const thinkingTexts = [
      "Analyzing your query...",
      "Processing information...",
      "Searching knowledge base...",
      "Generating response...",
      "Crafting answer...",
      "Thinking deeply...",
      "Connecting ideas...",
      "Formulating response...",
      "Almost ready...",
      "Finalizing answer..."
    ];
    
    let textIndex = 0;
    setThinkingText(thinkingTexts[0]);
    
    const textInterval = setInterval(() => {
      textIndex = (textIndex + 1) % thinkingTexts.length;
      setThinkingText(thinkingTexts[textIndex]);
    }, 1500);
    
    // Store interval to clear later
    (window as any).thinkingInterval = textInterval;

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
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

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                setError(data.error);
                setIsLoading(false);
                return;
              }
              
                    if (data.done) {
                      // Add AI response to conversation history
                      const aiMessage = {
                        type: 'ai' as const,
                        content: fullResponse,
                        timestamp: new Date().toISOString()
                      };
                      setConversationHistory(prev => [...prev, aiMessage]);
                      
                      // Clear streaming response and search query
                      setStreamingResponse('');
                      setSearchQuery('');
                      setIsLoading(false);
                      setThinkingText('');
                      clearInterval((window as any).thinkingInterval);
                      return;
                    }
              
              if (data.content) {
                fullResponse += data.content;
                setStreamingResponse(fullResponse);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
          } catch (err) {
            setError('Failed to search. Please try again.');
            console.error('Search error:', err);
            setIsLoading(false);
            setThinkingText('');
            clearInterval((window as any).thinkingInterval);
          }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Pendulum-style three dots animation component
  const PendulumDots = () => (
    <div className="flex items-center space-x-1">
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#151514' }}>
      {/* Header - Only show when conversation hasn't started */}
      {!conversationStarted && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          {/* Main Logo */}
          <div className="text-center mb-6 sm:mb-12">
            <button
              onClick={() => window.location.reload()}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
        <Image
                src="/applogo.png"
                alt="Humbl AI"
                width={300}
                height={120}
                className="mx-auto w-48 h-auto sm:w-[300px]"
          priority
        />
            </button>
          </div>

          {/* Search Bar */}
          <div className="w-full max-w-2xl mb-6 sm:mb-8">
            <div className="relative">
              <div className="flex items-start rounded-2xl px-3 py-3 sm:px-6 sm:py-4 shadow-lg" style={{ backgroundColor: '#1f1f1f' }}>
                {/* Search Icon */}
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white mr-2 sm:mr-4 mt-1 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>

                {/* Input Field */}
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder=""
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-base sm:text-lg resize-none min-h-[1.5rem] max-h-32 overflow-y-auto"
                  rows={1}
                  style={{
                    height: 'auto',
                    minHeight: '1.5rem',
                    maxHeight: '8rem'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="ml-2 sm:ml-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 flex-shrink-0"
                  style={{ backgroundColor: '#1a1a19' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a2a29'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#1a1a19'}
                >
                  {isLoading ? (
                    <PendulumDots />
                  ) : (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area - Only show when conversation has started */}
      {conversationStarted && (
        <div className="flex-1 overflow-y-auto py-4">
          <div className="w-full space-y-6">
            {/* Conversation History */}
            {conversationHistory.map((message, index) => (
              <div key={index} className="w-full">
                {message.type === 'user' ? (
                  <div className="text-right pr-4">
                    <p className="text-gray-300 text-sm sm:text-base whitespace-pre-wrap inline-block text-right">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div className="w-full px-4">
                    <ResponseRenderer content={message.content} />
                    {/* Action buttons for AI responses */}
                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(message.content)}
                        className="p-2 rounded hover:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                      </button>
                      <button
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                        title="Upvote"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                        title="Downvote"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Thinking Animation - Show when loading but no streaming response yet */}
            {isLoading && !streamingResponse && (
              <div className="w-full px-4">
                <div className="flex items-center space-x-3 text-gray-300">
                  <PendulumDots />
                  <span className="text-sm sm:text-base animate-pulse">{thinkingText}</span>
                </div>
              </div>
            )}

            {/* Streaming Response */}
            {streamingResponse && (
              <div className="w-full px-4">
                <ResponseRenderer content={streamingResponse} />
                {isLoading && (
                  <div className="flex items-center space-x-2 mt-2 text-gray-300">
                    <PendulumDots />
                    <span className="text-sm animate-pulse">Generating...</span>
                  </div>
                )}
                {/* Action buttons for streaming response */}
                {!isLoading && (
                  <div className="flex items-center space-x-2 mt-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(streamingResponse)}
                      className="p-2 rounded hover:bg-gray-700 transition-colors"
                      title="Copy response"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                    <button
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                      title="Upvote"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                      title="Downvote"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="w-full px-4">
                <p className="text-red-400 text-sm sm:text-base">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar - Only show when conversation has started */}
      {conversationStarted && (
        <div className="w-full px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="flex items-start rounded-2xl px-3 py-3 sm:px-6 sm:py-4 shadow-lg" style={{ backgroundColor: '#1f1f1f' }}>
                {/* Search Icon */}
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white mr-2 sm:mr-4 mt-1 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>

                {/* Input Field */}
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Continue the conversation..."
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-base sm:text-lg resize-none min-h-[1.5rem] max-h-32 overflow-y-auto"
                  rows={1}
                  style={{
                    height: 'auto',
                    minHeight: '1.5rem',
                    maxHeight: '8rem'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="ml-2 sm:ml-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 flex-shrink-0"
                  style={{ backgroundColor: '#1a1a19' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a2a29'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#1a1a19'}
                >
                  {isLoading ? (
                    <PendulumDots />
                  ) : (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}