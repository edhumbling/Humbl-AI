'use client';

import { useState } from 'react';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log('Searching for:', searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Main Title */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-serif text-white mb-4">
          Humbl AI
        </h1>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-2xl mb-8">
        <div className="relative">
          <div className="flex items-center bg-gray-800 rounded-2xl px-6 py-4 shadow-lg">
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
              className="ml-4 w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
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
            </button>
          </div>
        </div>
      </div>

      {/* Articles Available Text */}
      <div className="text-center">
        <p className="text-white text-lg mb-2">Articles Available</p>
        <p className="text-white text-3xl font-bold">Search to discover</p>
      </div>
    </div>
  );
}