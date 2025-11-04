'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, ArrowUp, Square, Plus, X, Image as ImageIcon, ChevronDown, Check, Edit2, MoreVertical, Download, Copy as CopyIcon, Info } from 'lucide-react';
import Image from 'next/image';
import ResponseRenderer from '@/components/ResponseRenderer';
import Sidebar from '@/components/Sidebar';
import { useConversation } from '@/contexts/ConversationContext';
import { useUser } from '@stackframe/stack';

export default function SharedConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useUser();
  const { 
    conversationHistory, 
    conversationStarted,
    getConversationHistory,
    addUserMessage, 
    addAIMessage, 
    clearConversation,
    startConversation 
  } = useConversation();
  
  const [conversation, setConversation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [continuationConversationId, setContinuationConversationId] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [imageGenerationMode, setImageGenerationMode] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [mode, setMode] = useState<'default' | 'search'>('default');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showWebSearchDropdown, setShowWebSearchDropdown] = useState(false);
  const [imageMenuOpen, setImageMenuOpen] = useState<number | null>(null);
  const [imageIconDropdownOpen, setImageIconDropdownOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const conversationBarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('humblai-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Fetch conversation and load into context
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setIsLoading(true);
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
        
        // Load messages into conversation context
        clearConversation();
        const messages = data.conversation.messages || [];
        messages.forEach((msg: any) => {
          if (msg.role === 'user') {
            addUserMessage(msg.content || '', msg.images || []);
          } else {
            addAIMessage(msg.content || '', msg.images || [], msg.citations || []);
          }
        });
        
        // Mark conversation as started
        startConversation();
        
        // Check if user has a continuation conversation for this shared conversation
        if (user) {
          const continuationKey = `continuation_${conversationId}`;
          const existingContinuationId = sessionStorage.getItem(continuationKey);
          if (existingContinuationId) {
            setContinuationConversationId(existingContinuationId);
          }
        }
        
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
  }, [conversationId, clearConversation, addUserMessage, addAIMessage, startConversation, user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationScrollRef.current) {
      conversationScrollRef.current.scrollTop = conversationScrollRef.current.scrollHeight;
    }
  }, [conversationHistory, streamingResponse]);

  const handleSearch = async () => {
    if (!searchQuery.trim() && attachedImages.length === 0) return;
    if (isStreaming) return;

    const queryToUse = searchQuery.trim();
    setSearchQuery('');
    addUserMessage(queryToUse, attachedImages);
    setAttachedImages([]);
    setImageGenerationMode(false);

    setIsStreaming(true);
    setStreamingResponse('');

    try {
      const historyForAPI = getConversationHistory()
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content || '',
          images: msg.images || [],
        }));

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: queryToUse, 
          images: attachedImages.slice(0, 3), 
          mode: modeToUse,
          conversationHistory: historyForAPI,
        }),
      });

      if (!response.ok) throw new Error('Search failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

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
              if (data.done) break;
            } catch (e) {}
          }
        }
      }

      addAIMessage(fullResponse);
      setStreamingResponse('');
      
      // Save continuation if user is logged in
      if (user) {
        const continuationKey = `continuation_${conversationId}`;
        let newConversationId = sessionStorage.getItem(continuationKey);
        
        try {
          if (!newConversationId) {
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
                setContinuationConversationId(newConversationId); // Store in state for sharing
                
                // Save all original messages
                const originalMessages = conversation?.messages || [];
                for (const msg of originalMessages) {
                  await fetch(`/api/conversations/${newConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      role: msg.role,
                      content: msg.content,
                      images: msg.images || [],
                      citations: msg.citations || [],
                      mode: 'default'
                    }),
                  });
                }
              }
            }
          } else {
            // If continuation already exists, use it
            setContinuationConversationId(newConversationId);
          }
          
          // Save new messages
          if (newConversationId) {
            await fetch(`/api/conversations/${newConversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: 'user',
                content: queryToUse,
                images: attachedImages,
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
        }
      }
    } catch (error) {
      console.error('Error:', error);
      addAIMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const modeToUse = mode === 'search' ? 'search' : webSearchMode === 'on' ? 'search' : webSearchMode === 'auto' ? 'auto' : 'default';
  const canSend = searchQuery.trim().length > 0 || attachedImages.length > 0;
  const placeholderText = imageGenerationMode ? 'Describe the image you want to generate...' : 'Ask anything...';

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Function to scroll input bar above mobile keyboard
  const scrollBarAboveKeyboard = (el: HTMLElement | null) => {
    if (!el) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isMobile) return;
    
    const doScroll = () => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.scrollBy({ top: -16, left: 0, behavior: 'smooth' });
      } catch {
        const rect = el.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - 16, behavior: 'smooth' });
      }
    };
    
    // Small delay to allow keyboard animation to begin
    setTimeout(doScroll, 50);
    
    // Use visualViewport API if available (mobile browsers)
    const vv: any = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
      // Listen for viewport changes continuously while keyboard is open
      const handleViewportChange = () => {
        requestAnimationFrame(doScroll);
      };
      
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
      
      // Store cleanup function on the element
      (el as any)._keyboardCleanup = () => {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      };
    }
  };

  const handleImagePickClick = () => {
    fileInputRef.current?.click();
  };

  const handleImagePickClickLower = () => {
    fileInputRef2.current?.click();
  };

  const handleImagesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + attachedImages.length > 3) {
      alert('Maximum 3 images allowed');
      return;
    }
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setAttachedImages(prev => [...prev, src]);
      };
      reader.readAsDataURL(file);
    });
    
    if (e.target) e.target.value = '';
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleImageMode = () => {
    setImageGenerationMode(!imageGenerationMode);
    if (!imageGenerationMode) {
      setMode('default');
      setWebSearchMode('off');
    }
  };

  const handleShare = () => {
    // Use continuation conversation ID if it exists (user's own conversation), otherwise use original shared ID
    const shareId = continuationConversationId || conversationId;
    if (shareId) {
      setShowShareModal(true);
    }
  };

  const getShareUrl = () => {
    const shareId = continuationConversationId || conversationId;
    return `${window.location.origin}/c/${shareId}`;
  };

  const startNewConversation = () => {
    router.push('/');
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
      {/* Header Bar - Same as main page */}
      <div className="w-full transition-colors duration-300" style={{ borderBottom: theme === 'dark' ? '1px solid rgba(55, 65, 81, 0.6)' : '1px solid rgba(229, 231, 235, 0.6)' }}>
        <div className="w-full px-4 md:px-8 py-3">
          <div className="flex items-center justify-between relative">
            {/* Left: Hamburger menu and New conversation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-lg transition-colors duration-300"
                style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)'}
                title="Menu"
              >
                <Image src="/sidebar menu.png" alt="Menu" width={18} height={18} className="opacity-80" style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }} />
              </button>
              <button
                onClick={startNewConversation}
                className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#f1d08c' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
                title="New conversation"
              >
                <Image src="/new chat.png" alt="New chat" width={18} height={18} />
              </button>
              <span className={`text-sm hidden sm:inline transition-colors duration-300 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>New</span>
            </div>

            {/* Center: Logo when conversation is active */}
            {/* Mobile: Small favicon */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:hidden">
              {conversationStarted && (
                <button onClick={startNewConversation} className="cursor-pointer hover:opacity-80 transition-opacity" title="New conversation">
                  <Image src="/small favicon.png" alt="Humbl AI" width={32} height={32} className="h-8 w-8 opacity-90" />
                </button>
              )}
            </div>
            {/* Desktop: Full logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
              {conversationStarted && (
                <button onClick={startNewConversation} className="cursor-pointer hover:opacity-80 transition-opacity" title="New conversation">
                  <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-6 w-auto opacity-90" />
                </button>
              )}
            </div>

            {/* Right: Share button */}
            {conversationStarted && (conversationId || continuationConversationId) && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg transition-colors duration-300"
                  style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)'}
                  title="Share conversation"
                >
                  <Image src="/share.png" alt="Share" width={18} height={18} style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' }} />
                </button>
                <span className={`text-sm hidden sm:inline transition-colors duration-300 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Share</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation Area - Same as main page */}
      {conversationStarted && (
        <div ref={conversationScrollRef} className="flex-1 relative overflow-y-auto py-4 humbl-scroll">
          <div className="w-full px-4">
            <div className="max-w-xl lg:max-w-3xl mx-auto space-y-6 pb-52">
              {/* Conversation History */}
              {conversationHistory.map((message, index) => (
                <div key={index} className="w-full">
                  {message.type === 'user' ? (
                    <div className="flex flex-col items-end">
                      {message.images && message.images.length > 0 && (
                        <div className="mb-2 flex items-center">
                          {message.images.map((src, idx) => (
                            <div key={idx} className={"relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-1 ring-white/20 shadow bg-black group " + (idx > 0 ? "-ml-2" : "")}>
                              <img src={src} alt={`user-attachment-${idx+1}`} className="w-full h-full object-cover" />
                              <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white">{idx+1}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement('a');
                                  link.href = src;
                                  link.download = `attachment-${idx+1}.png`;
                                  link.click();
                                }}
                                className="absolute bottom-1 right-1 p-1.5 rounded-full bg-black/80 hover:bg-[#f1d08c] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Download image"
                              >
                                <Download size={12} className="text-white group-hover:text-black" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="max-w-[80%] rounded-2xl px-4 py-3 transition-colors duration-300" style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f3f4f6' }}>
                        <p className={`text-sm sm:text-base whitespace-pre-wrap transition-colors duration-300 ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      {message.images && message.images.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-3">
                          {message.images.map((src, idx) => (
                            <div key={idx} className="relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-lg bg-black max-w-full group">
                              <img src={src} alt={`generated-image-${idx+1}`} className="max-w-xs sm:max-w-md lg:max-w-lg h-auto object-contain" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement('a');
                                  link.href = src;
                                  link.download = `generated-image-${idx+1}.png`;
                                  link.click();
                                }}
                                className="absolute bottom-2 right-2 p-2 rounded-full transition-all z-10 hover:scale-110"
                                style={{ backgroundColor: '#f1d08c' }}
                                title="Download image"
                              >
                                <Download size={16} className="text-black" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {message.content && <ResponseRenderer content={message.content} theme={theme} />}
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming Response */}
              {streamingResponse && (
                <div className="w-full">
                  <ResponseRenderer content={streamingResponse} isLoading={isStreaming} theme={theme} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar - Same as main page conversation bar */}
      {conversationStarted && (
        <div className="w-full px-4 pb-4" ref={conversationBarRef}>
          <div className="max-w-xl lg:max-w-3xl mx-auto">
            <div className="relative">
              <div className="relative overflow-visible flex flex-col rounded-2xl px-4 pt-4 pb-12 shadow-lg transition-colors duration-300" style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f9fafb', border: '1px solid #f1d08c' }}>
                {/* Attached images preview */}
                {attachedImages.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {attachedImages.map((src, idx) => (
                      <div key={idx} className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shadow-lg bg-black flex-shrink-0 group">
                        <img src={src} alt={`attachment-${idx+1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeAttachedImage(idx)}
                          className="absolute top-0 right-0 bg-black/90 hover:bg-black rounded-full p-0.5 transition-colors z-10"
                          title="Remove"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Field */}
                <div className="flex items-start gap-2">
                  <textarea
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={() => scrollBarAboveKeyboard(conversationBarRef.current as HTMLElement)}
                    placeholder={placeholderText}
                    className={`humbl-textarea flex-1 bg-transparent outline-none text-base sm:text-lg resize-none min-h-[1.5rem] max-h-32 overflow-y-auto transition-colors duration-300 ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-black placeholder-gray-500'}`}
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
                </div>

                {/* Bottom controls row */}
                <div className="absolute left-4 right-4 bottom-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={handleImagePickClickLower}
                      disabled={attachedImages.length >= 3}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#2a2a29' }}
                      title="Attach images"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                    <input ref={fileInputRef2} type="file" accept="image/*" multiple onChange={handleImagesSelected} className="hidden" />

                    {/* Mode buttons */}
                    <div className="ml-2 hidden sm:flex items-center gap-2 relative">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowWebSearchDropdown(!showWebSearchDropdown);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors hover:bg-opacity-80"
                          style={{ backgroundColor: webSearchMode !== 'off' ? '#f1d08c' : '#2a2a29', color: webSearchMode !== 'off' ? '#000000' : '#ffffff' }}
                          title="Search the web"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span className="text-xs font-medium hidden lg:inline">
                            Search: {webSearchMode === 'auto' ? 'auto' : webSearchMode === 'on' ? 'on' : 'off'}
                          </span>
                        </button>
                        {showWebSearchDropdown && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowWebSearchDropdown(false)}
                            />
                            <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-gray-900 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setWebSearchMode('auto');
                                    setMode('default');
                                    setImageGenerationMode(false);
                                    setShowWebSearchDropdown(false);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-white text-sm font-medium">Auto</div>
                                    <div className="text-gray-400 text-xs mt-0.5">Automatically determine whether to search the web to answer your question.</div>
                                  </div>
                                  {webSearchMode === 'auto' && <Check size={16} className="text-white flex-shrink-0" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setWebSearchMode('on');
                                    setMode('search');
                                    setImageGenerationMode(false);
                                    setShowWebSearchDropdown(false);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-white text-sm font-medium">On</div>
                                    <div className="text-gray-400 text-xs mt-0.5">Always search the web before answering your question.</div>
                                  </div>
                                  {webSearchMode === 'on' && <Check size={16} className="text-white flex-shrink-0" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setWebSearchMode('off');
                                    setMode('default');
                                    setShowWebSearchDropdown(false);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-white text-sm font-medium">Off</div>
                                    <div className="text-gray-400 text-xs mt-0.5">Never search the web before answering your question.</div>
                                  </div>
                                  {webSearchMode === 'off' && <Check size={16} className="text-white flex-shrink-0" />}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="ml-2 relative">
                        <button
                          onClick={handleToggleImageMode}
                          className={`h-8 flex items-center justify-center transition-colors hover:bg-opacity-80 rounded-full px-3`}
                          style={{ backgroundColor: imageGenerationMode ? '#f1d08c' : '#2a2a29', color: imageGenerationMode ? '#000000' : '#ffffff' }}
                          title="Create image"
                        >
                          <ImageIcon size={16} className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="ml-2 flex sm:hidden items-center gap-2">
                      <button onClick={() => { setMode(prev => (prev === 'search' ? 'default' : 'search')); if (mode !== 'search') setImageGenerationMode(false); }} className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " + (mode==='search' ? '' : 'hover:bg-opacity-80')} style={{ backgroundColor: mode==='search' ? '#f1d08c' : '#2a2a29', color: mode==='search' ? '#000000' : '#ffffff' }} title="Search the web">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                      <button
                        onClick={handleToggleImageMode}
                        className={`h-8 flex items-center justify-center transition-colors hover:bg-opacity-80 rounded-full px-3`}
                        style={{ backgroundColor: imageGenerationMode ? '#f1d08c' : '#2a2a29', color: imageGenerationMode ? '#000000' : '#ffffff' }}
                        title="Create image"
                      >
                        <ImageIcon size={16} className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => setIsRecording(!isRecording)}
                      className="mr-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80"
                      style={{ backgroundColor: '#2a2a29' }}
                      title={isRecording ? 'Stop dictation' : 'Dictate'}
                    >
                      <Mic size={20} className={isRecording ? 'text-red-500 animate-pulse' : 'text-white'} />
                    </button>
                    <div className="relative inline-block">
                      {isStreaming && (
                        <span className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#f1d08c] animate-spin" />
                      )}
                      <button
                        onClick={handleSearch}
                        disabled={isStreaming || (!searchQuery.trim() && attachedImages.length === 0)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: (isStreaming || canSend) ? '#f1d08c' : '#1a1a19' }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isStreaming || canSend) ? '#e8c377' : '#2a2a29'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isStreaming || canSend) ? '#f1d08c' : '#1a1a19'}
                      >
                        {isStreaming ? (
                          <Square size={18} className="text-black" />
                        ) : (
                          <ArrowUp size={18} className={(isStreaming || canSend) ? 'text-black' : 'text-white'} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Disclaimer */}
            <p className="text-center mt-2 text-xs text-gray-500/60">
              AI can make mistakes, kindly fact check if possible.
            </p>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (conversationId || continuationConversationId) && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <div
              className="relative rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto share-modal-scroll"
              style={{
                backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base sm:text-lg font-semibold" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  Share Conversation
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 mb-4 share-modal-horizontal-scroll">
                {/* X (formerly Twitter) */}
                <button
                  onClick={() => {
                    const shareUrl = getShareUrl();
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on X"
                >
                  <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="X" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>X</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={() => {
                    const shareUrl = getShareUrl();
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on Facebook"
                >
                  <img src="https://www.facebook.com/images/fb_icon_325x325.png" alt="Facebook" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>Facebook</span>
                </button>

                {/* LinkedIn */}
                <button
                  onClick={() => {
                    const shareUrl = getShareUrl();
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on LinkedIn"
                >
                  <img src="https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca" alt="LinkedIn" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>LinkedIn</span>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const shareUrl = getShareUrl();
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on WhatsApp"
                >
                  <img src="https://static.whatsapp.net/rsrc.php/v3/yL/r/ujTY9BX_Jk7.png" alt="WhatsApp" className="w-10 h-10 mb-1.5" onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTcuNDcyIDguNzA0Yy0uMjI5LS4xMjMtLjQ5LS4yMTktLjcyLS4yODlBMjAuMjA4IDIwLjIwOCAwIDAgMCAxMy4wMyA3Ljk4Yy0uMjQ4LS4wMTQtLjQ5OC0uMDIxLS43NS0uMDIxYTEwLjk3IDEwLjk3IDAgMCAwLTcuNDkyIDMuMzA0QTExLjExIDExLjExIDAgMCAwIDIgMTMuMjYxYTExLjE4IDExLjE4IDAgMCAwIDEuODIxIDYuMDI2bC0xLjYyOCA0LjkyNmE0LjgyIDQuODIgMCAwIDAgNS44NTggMy4wMTJsNC44MjktMS42ODRhMTEgMTEgMCAwIDAgNS4yOTguNjI1YzEuODkzLjE2NyAzLjgwNi41MyA1LjU2NiAxLjEwNmExLjQ4IDEuNDggMCAwIDAgMS41ODUtLjMyNGwxLjM2Mi0xLjE2NGEuNzUuNzUgMCAwIDAgLjEtLjEwOGwzLjE0MS0yLjY1MWEuNzUuNzUgMCAwIDAgLjEtLjEwOGMuMTI2LS4xMjMuMjQ3LS4yNS4zNjEtLjM3OGEuNzUuNzUgMCAwIDAgLjEtLjA4NmMyLjA3LTIuMjA0IDMuMTUzLTQuOTg1IDMuMTUzLTcuNzgyIDAtMi4xOTItLjkxNC00LjI3MS0yLjUyOC01Ljc2NnoiIGZpbGw9IiMyNUQzNjYiLz48L3N2Zz4=';
                  }} />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>WhatsApp</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => {
                    const shareUrl = getShareUrl();
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on Telegram"
                >
                  <img src="https://web.telegram.org/a/icon-192x192.png" alt="Telegram" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>Telegram</span>
                </button>

                {/* Copy Link */}
                <button
                  onClick={async () => {
                    const shareUrl = getShareUrl();
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      const toast = document.createElement('div');
                      toast.textContent = 'Link copied to clipboard!';
                      toast.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: ${theme === 'dark' ? '#1f1f1f' : '#ffffff'};
                        color: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
                        padding: 12px 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 9999;
                        font-size: 14px;
                        border: 1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'};
                      `;
                      document.body.appendChild(toast);
                      setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transition = 'opacity 0.3s';
                        setTimeout(() => document.body.removeChild(toast), 300);
                      }, 2000);
                      setShowShareModal(false);
                    } catch (err) {
                      prompt('Copy this link:', shareUrl);
                    }
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Copy Link"
                >
                  <CopyIcon size={40} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827', marginBottom: '4px' }} />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>Copy</span>
                </button>
              </div>
            </div>
          </div>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowShareModal(false)}
          />
        </>
      )}

      {/* Developer Info Modal - Higher z-index than sidebar */}
      {showInfo && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setShowInfo(false)}
          />
          <div className="relative h-full w-full flex items-center justify-center px-4">
            <div 
              className="w-[90%] sm:w-full max-w-sm sm:max-w-3xl rounded-2xl shadow-xl transition-colors duration-300" 
              style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-3 py-2 sm:px-5 sm:py-4 transition-colors duration-300 ${theme === 'dark' ? 'border-b border-gray-800/60' : 'border-b border-gray-200'}`}>
                <div className="flex items-center space-x-2">
                  <Info size={18} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
                  <span className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>About this app</span>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className={`p-2 rounded-lg transition-colors duration-300 ${theme === 'dark' ? 'hover:bg-gray-800/60' : 'hover:bg-gray-200'}`}
                  title="Close"
                >
                  <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
                </button>
              </div>

              <div className="px-4 py-4 sm:px-5 sm:py-5 lg:grid lg:grid-cols-2 lg:gap-10 space-y-4 sm:space-y-6 lg:space-y-0">
                {/* About - Left */}
                <div className="space-y-3">
                  <h3 className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>About Humbl AI</h3>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
                      <Image src="/applogo.png" alt="Humbl AI" width={48} height={48} />
                    </div>
                    <div>
                      <div className={`text-sm sm:text-base transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>Humbl AI</div>
                      <div className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Your Intelligent AI Assistant</div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>About</h4>
                    <p className={`text-xs sm:text-sm leading-relaxed transition-colors duration-300 ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>
                      Humbl AI is an advanced conversational assistant designed to help you research, analyze images, and get precise answers in real time. It combines internet search, voice input, and safe educational filtering to deliver concise, helpful responses.
                    </p>
                  </div>
                </div>

                {/* Right column: Features + Developer */}
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-xs sm:text-sm mb-2 transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>Features</h3>
                    <ul className={`list-disc pl-5 space-y-1 text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>
                      <li>Voice input and text-to-speech</li>
                      <li>Image analysis capabilities</li>
                      <li>Internet search integration</li>
                      <li>Educational content filtering</li>
                      <li>Real-time conversation</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h3 className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>Developer</h3>
                    <div className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>EH — Emmanuel Humbling</div>
                    <div className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>AI Developer, AIDEL</div>
                    <div className="pt-2">
                      <a
                        href="https://www.linkedin.com/in/edhumbling"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs sm:text-sm transition-colors duration-300 ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        theme={theme}
        setTheme={setTheme}
        onShowInfo={() => setShowInfo(true)}
        user={user}
        onNewConversation={startNewConversation}
        onSelectConversation={(id) => {
          // If user selects a conversation, navigate to it
          router.push(`/c/${id}`);
        }}
        currentConversationId={continuationConversationId || conversationId}
      />

      <style jsx global>{`
        .humbl-textarea::-webkit-scrollbar { width: 8px; }
        .humbl-textarea::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 8px; }
        .humbl-textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 8px; }
        .humbl-textarea::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
        .humbl-textarea { scrollbar-color: rgba(255,255,255,0.25) rgba(0,0,0,0.2); scrollbar-width: thin; }
        /* Conversation scroll: dark, faded scrollbar */
        .humbl-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.6) transparent; }
        .humbl-scroll::-webkit-scrollbar { width: 10px; }
        .humbl-scroll::-webkit-scrollbar-track { background: linear-gradient(to bottom, rgba(0,0,0,0.0), rgba(0,0,0,0.45)); border-radius: 8px; }
        .humbl-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.6); border-radius: 8px; border: 2px solid rgba(0,0,0,0.2); }
        .humbl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.7); }
        /* Share modal horizontal scrollbar - desktop only */
        @media (min-width: 640px) {
          .share-modal-horizontal-scroll { 
            scrollbar-width: thin; 
            scrollbar-color: rgba(0,0,0,0.4) transparent; 
          }
          .share-modal-horizontal-scroll::-webkit-scrollbar { 
            height: 6px; 
          }
          .share-modal-horizontal-scroll::-webkit-scrollbar-track { 
            background: transparent; 
            border-radius: 3px;
          }
          .share-modal-horizontal-scroll::-webkit-scrollbar-thumb { 
            background: rgba(0,0,0,0.4); 
            border-radius: 3px; 
          }
          .share-modal-horizontal-scroll::-webkit-scrollbar-thumb:hover { 
            background: rgba(0,0,0,0.6); 
          }
        }
        /* Hide horizontal scrollbar on mobile */
        @media (max-width: 639px) {
          .share-modal-horizontal-scroll { 
            -ms-overflow-style: none; 
            scrollbar-width: none; 
          }
          .share-modal-horizontal-scroll::-webkit-scrollbar { 
            display: none; 
          }
        }
        /* Share modal vertical scrollbar */
        .share-modal-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
        .share-modal-scroll::-webkit-scrollbar { width: 8px; }
        .share-modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .share-modal-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.3); border-radius: 4px; }
        .share-modal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
}
