'use client';

import { useState } from 'react';
import Image from 'next/image';

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setStreamingResponse('');

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
                setSearchResult({
                  query: searchQuery,
                  response: fullResponse,
                  timestamp: new Date().toISOString(),
                });
                setIsLoading(false);
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
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center px-4 py-8 sm:py-12 ${!searchResult && !streamingResponse && !isLoading ? 'h-screen overflow-hidden' : 'min-h-screen'}`} style={{ backgroundColor: '#151514' }}>
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
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

      {/* Error Message */}
      {error && (
        <div className="w-full max-w-2xl mb-4 sm:mb-6 px-4">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 sm:p-4">
            <p className="text-red-400 text-center text-sm sm:text-base">{error}</p>
          </div>
        </div>
      )}

      {/* Streaming Response */}
      {(streamingResponse || isLoading) && (
        <div className="w-full max-w-4xl mb-6 sm:mb-8 px-4">
          <div className="rounded-lg p-4 sm:p-6 shadow-lg" style={{ backgroundColor: '#1a1a19' }}>
            <div className="mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Search Results for: "{searchQuery}"
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm">
                {isLoading ? 'Generating response...' : new Date().toLocaleString()}
              </p>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                {streamingResponse}
                {isLoading && (
                  <span className="inline-block w-2 h-5 bg-white ml-1 animate-pulse"></span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Final Search Results */}
      {searchResult && !isLoading && (
        <div className="w-full max-w-4xl mb-6 sm:mb-8 px-4">
          <div className="rounded-lg p-4 sm:p-6 shadow-lg" style={{ backgroundColor: '#1a1a19' }}>
            <div className="mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Search Results for: "{searchResult.query}"
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm">
                {new Date(searchResult.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                {searchResult.response}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}