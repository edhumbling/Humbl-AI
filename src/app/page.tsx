'use client';

import { useState } from 'react';

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
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#151514' }}>
      {/* Main Title */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-serif text-white mb-4">
          Humbl AI
        </h1>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-2xl mb-8">
        <div className="relative">
          <div className="flex items-center rounded-2xl px-6 py-4 shadow-lg" style={{ backgroundColor: '#151514' }}>
            {/* Search Icon */}
            <svg 
              className="w-6 h-6 text-white mr-4" 
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder=""
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg"
            />
            
            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="ml-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80"
              style={{ backgroundColor: '#1a1a19' }}
              onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a2a29'}
              onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#1a1a19'}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg 
                  className="w-5 h-5 text-white" 
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
        <div className="w-full max-w-2xl mb-6">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        </div>
      )}

      {/* Streaming Response */}
      {(streamingResponse || isLoading) && (
        <div className="w-full max-w-4xl mb-8">
          <div className="rounded-lg p-6 shadow-lg" style={{ backgroundColor: '#1a1a19' }}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                Search Results for: "{searchQuery}"
              </h2>
              <p className="text-gray-400 text-sm">
                {isLoading ? 'Generating response...' : new Date().toLocaleString()}
              </p>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
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
        <div className="w-full max-w-4xl mb-8">
          <div className="rounded-lg p-6 shadow-lg" style={{ backgroundColor: '#1a1a19' }}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                Search Results for: "{searchResult.query}"
              </h2>
              <p className="text-gray-400 text-sm">
                {new Date(searchResult.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {searchResult.response}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}