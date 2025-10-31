'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Send, Copy as CopyIcon, ThumbsUp, ThumbsDown, Plus, Info, X, ArrowUp, Square } from 'lucide-react';
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
  const [conversationHistory, setConversationHistory] = useState<Array<{type: 'user' | 'ai', content: string, timestamp: string, images?: string[], citations?: Array<{ title: string; url: string }> }>>([]);
  const [thinkingText, setThinkingText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const responseStartRef = useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const startVisualizer = (stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioContextRef.current!;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const canvas = waveCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const render = () => {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth * dpr;
        const height = canvas.clientHeight * dpr;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, width, height);
        const bars = 64;
        const barWidth = Math.max(2 * dpr, Math.floor(width / (bars * 1.5)));
        const gap = 2 * dpr;
        let x = 0;
        for (let i = 0; i < bars; i++) {
          const v = dataArray[Math.floor((i / bars) * bufferLength)] / 255;
          const barHeight = Math.max(2 * dpr, v * height);
          ctx.fillStyle = '#8b8b8a';
          ctx.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
          x += barWidth + gap;
        }
        animationRef.current = requestAnimationFrame(render);
      };
      render();
    } catch (e) {
      // fail silently if visualizer can't start
    }
  };

  const startRecording = async () => {
    try {
      // Reuse microphone stream within the same browsing session to avoid repeated prompts
      let stream = micStreamRef.current;
      if (!stream) {
        // Check Permissions API when available
        if (navigator.permissions && 'query' in navigator.permissions) {
          try {
            const status = await (navigator.permissions as any).query({ name: 'microphone' });
            if (status.state === 'denied') {
              console.warn('Microphone permission denied by the user');
              return;
            }
          } catch {
            // ignore - not all browsers support permissions query for microphone
          }
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        // Mark permission as granted for this tab session
        try { sessionStorage.setItem('humblai_mic_granted', 'true'); } catch {}
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      // Start waveform visualizer
      startVisualizer(stream);
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        // Stop visualizer and clear canvas
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        const c = waveCanvasRef.current;
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        }
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        try {
          setIsTranscribing(true);
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const json = await res.json();
          if (json?.text) {
            setSearchQuery(prev => (prev ? prev + ' ' : '') + json.text);
          }
        } catch (e) {
          console.error('Transcription request failed', e);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone permission/recording error:', err);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    // Stop all audio tracks
    const micStream = micStreamRef.current;
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    // Close the audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  const startNewConversation = () => {
    try {
      // Stop any ongoing recording/visualizer
      if (isRecording) {
        stopRecording();
      }
      if ((window as any).thinkingInterval) {
        clearInterval((window as any).thinkingInterval);
      }
    } catch {}

    setConversationStarted(false);
    setConversationHistory([]);
    setSearchQuery('');
    setSearchResult(null);
    setStreamingResponse('');
    setError(null);
    setThinkingText('');
  };

  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState<'default' | 'search' | 'study'>('default');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);
  const canSend = (!!searchQuery.trim() || attachedImages.length > 0) && !isLoading;

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const suggestTimeoutRef = useRef<number | null>(null);
  const initialSearchRef = useRef<HTMLDivElement | null>(null);

  const handleImagePickClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImagePickClickLower = () => {
    if (fileInputRef2.current) fileInputRef2.current.click();
  };

  const handleImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const maxAllowed = 4 - attachedImages.length;
    const toRead = Array.from(files).slice(0, Math.max(0, maxAllowed));
    const readers = toRead.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }));
    try {
      const results = await Promise.all(readers);
      setAttachedImages(prev => [...prev, ...results].slice(0, 4));
    } catch {}
    // reset input so selecting the same file again triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && attachedImages.length === 0) return;

    // Start conversation and add user message to history
    setConversationStarted(true);
    const userMessage = {
      type: 'user' as const,
      content: searchQuery,
      images: attachedImages.slice(0, 4),
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
        body: JSON.stringify({ query: searchQuery, images: attachedImages.slice(0, 4), mode }),
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
      let finalCitations: Array<{ title: string; url: string }> | undefined = undefined;

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
                        citations: data.citations || finalCitations,
                        timestamp: new Date().toISOString()
                      };
                      setConversationHistory(prev => [...prev, aiMessage]);
                      
                      // Clear streaming response and search query
                      setStreamingResponse('');
                      setSearchQuery('');
                      setIsLoading(false);
                      setThinkingText('');
                      clearInterval((window as any).thinkingInterval);
                      setAttachedImages([]);
                      return;
                    }
              
              if (data.content) {
                fullResponse += data.content;
                setStreamingResponse(fullResponse);
              }
              if (data.citations) {
                finalCitations = data.citations;
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
    if (showSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const count = suggestions.length;
      if (count === 0) return;
      setActiveSuggestionIndex(prev => {
        const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1;
        const wrapped = (next + count) % count;
        return wrapped;
      });
      return;
    }
    if (showSuggestions && e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      const chosen = suggestions[activeSuggestionIndex];
      if (chosen) {
        setSearchQuery(chosen);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Fetch suggestions (debounced)
  useEffect(() => {
    // Only suggest on first queries (before conversation starts)
    if (conversationStarted) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      if (suggestTimeoutRef.current) {
        window.clearTimeout(suggestTimeoutRef.current);
        suggestTimeoutRef.current = null;
      }
      return;
    }
    if (suggestTimeoutRef.current) {
      window.clearTimeout(suggestTimeoutRef.current);
      suggestTimeoutRef.current = null;
    }
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    suggestTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions(Array.isArray(json?.suggestions) ? json.suggestions : []);
        setShowSuggestions(true);
        setActiveSuggestionIndex(-1);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
    return () => {
      if (suggestTimeoutRef.current) window.clearTimeout(suggestTimeoutRef.current);
    };
  }, [searchQuery, conversationStarted]);

  // Ensure suggestions stay visible on mobile when keyboard opens
  useEffect(() => {
    if (conversationStarted || !showSuggestions) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isMobile) return;

    const scrollIntoViewSafely = () => {
      const el = initialSearchRef.current;
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.scrollBy({ top: -24, left: 0, behavior: 'smooth' });
      } catch {
        const rect = el.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - 24 });
      }
    };

    // Attempt immediately and after viewport settles (keyboard shown)
    scrollIntoViewSafely();
    const raf = requestAnimationFrame(scrollIntoViewSafely);

    // Listen for visualViewport changes where supported (mobile browsers)
    const vv: any = (window as any).visualViewport;
    const onVVChange = () => scrollIntoViewSafely();
    if (vv && vv.addEventListener) {
      vv.addEventListener('resize', onVVChange);
      vv.addEventListener('scroll', onVVChange);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (vv && vv.removeEventListener) {
        vv.removeEventListener('resize', onVVChange);
        vv.removeEventListener('scroll', onVVChange);
      }
    };
  }, [showSuggestions, conversationStarted]);

  // Auto-scroll to the beginning of the streaming response when it starts
  useEffect(() => {
    if (!(isLoading && streamingResponse)) return;
    // Wait for DOM to paint the marker
    requestAnimationFrame(() => {
      const container = conversationScrollRef.current;
      const target = responseStartRef.current;
      if (container && target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + container.scrollTop - 8;
        try {
          container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        } catch {
          container.scrollTop = Math.max(0, offset);
        }
      } else {
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [isLoading, streamingResponse]);

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
      {/* Header Bar with New Conversation button */}
      <div className="w-full border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={startNewConversation}
                className="p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
                title="New conversation"
              >
                <Plus size={18} className="text-gray-200" />
              </button>
              <span className="text-sm text-gray-400 hidden sm:inline">New</span>
            </div>
            <button
              onClick={() => setShowInfo(true)}
              className="p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
              title="Info"
            >
              <Info size={18} className="text-gray-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowInfo(false)}
          />
          <div className="relative h-full w-full flex items-center justify-center px-4">
            <div className="w-full max-w-3xl rounded-2xl shadow-xl" style={{ backgroundColor: '#1f1f1f' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <div className="flex items-center space-x-2">
                  <Info size={18} className="text-gray-200" />
                  <span className="text-sm text-gray-200">About this app</span>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
                  title="Close"
                >
                  <X size={16} className="text-gray-300" />
                </button>
              </div>

              <div className="px-5 py-5 lg:grid lg:grid-cols-2 lg:gap-10 space-y-6 lg:space-y-0">
                {/* About - Left */}
                <div className="space-y-3">
                  <h3 className="text-gray-200 text-sm">About Humbl AI</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                      <Image src="/applogo.png" alt="Humbl AI" width={48} height={48} />
                    </div>
                    <div>
                      <div className="text-gray-200 text-base">Humbl AI</div>
                      <div className="text-gray-400 text-sm">Your Intelligent AI Assistant</div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-gray-200 text-sm">About</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Humbl AI is an advanced conversational assistant designed to help you research, analyze images, and get precise answers in real time. It combines internet search, voice input, and safe educational filtering to deliver concise, helpful responses.
                    </p>
                  </div>
                </div>

                {/* Right column: Features + Developer */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-gray-200 text-sm mb-2">Features</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
                      <li>Voice input and text-to-speech</li>
                      <li>Image analysis capabilities</li>
                      <li>Internet search integration</li>
                      <li>Educational content filtering</li>
                      <li>Real-time conversation</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-gray-200 text-sm">Developer</h3>
                    <div className="text-gray-300 text-sm">EH</div>
                    <div className="text-gray-300 text-sm">Emmanuel Humbling</div>
                    <div className="text-gray-300 text-sm">AI Developer</div>
                    <div className="text-gray-300 text-sm">Built by AIDEL - Artificial Intelligence Development Experimental Labs</div>
                    <div className="pt-2">
                      <a
                        href="https://www.linkedin.com/in/edhumbling"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ backgroundColor: '#1a1a19', color: '#e5e7eb' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a2a29')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1a1a19')}
                      >
                        Connect on LinkedIn
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

          {/* Desktop Title */}
          <div className="w-full text-center mb-3 hidden md:block">
            <h2 className="text-gray-300 text-sm sm:text-base font-normal">What's on your mind today?</h2>
          </div>

          {/* Search Bar */}
          <div ref={initialSearchRef} className="w-full max-w-xl lg:max-w-3xl mx-auto mb-6 sm:mb-8">
            <div className="relative">
              <div className="relative overflow-visible flex items-start rounded-2xl px-3 pt-3 pb-12 sm:px-6 sm:pt-4 sm:pb-14 shadow-lg" style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c', paddingTop: attachedImages.length > 0 ? 20 : undefined }}>
                {/* Full-bar waveform background */}
                {isRecording && (
                  <canvas
                    ref={waveCanvasRef}
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
                  />
                )}
                {/* Input Field */}
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => { if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  placeholder=""
                  className="humbl-textarea flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-base sm:text-lg resize-none min-h-[1.5rem] max-h-32 overflow-y-auto"
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

                {/* Suggestions dropdown (desktop top bar) */}
                {!conversationStarted && showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-3 right-3 top-full mt-0 rounded-b-2xl bg-[#1f1f1f]/95 backdrop-blur-sm z-20 max-h-64 overflow-auto humbl-suggest">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className={"w-full text-left px-3 py-2 text-sm border-t border-gray-800/60 " + (i === activeSuggestionIndex ? 'bg-[#2a2a29] text-white' : 'text-gray-300 hover:bg-[#2a2a29]')}
                        onMouseDown={(e) => { e.preventDefault(); setSearchQuery(s); setShowSuggestions(false); setActiveSuggestionIndex(-1); }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Attached images preview */}
                {attachedImages.length > 0 && (
                  <div className="absolute left-12 right-4 top-0 -translate-y-1/2 z-10">
                    <div className="flex items-center overflow-x-auto pr-2">
                      {attachedImages.map((src, idx) => (
                        <div key={idx} className={"relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-md bg-black flex-shrink-0 " + (idx > 0 ? "-ml-2" : "") }>
                          <img src={src} alt={`attachment-${idx+1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeAttachedImage(idx)}
                            className="absolute -top-1 -right-1 bg-black/80 rounded-full p-0.5"
                            title="Remove"
                          >
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcribing indicator */}
                {(!isRecording && isTranscribing) && (
                  <div className="absolute left-0 right-0 -bottom-3 translate-y-full px-2">
                    <p className="text-xs text-gray-400 animate-pulse">Transcribing…</p>
                  </div>
                )}

                {/* Bottom controls row */}
                <div className="absolute left-3 right-3 bottom-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={handleImagePickClick}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-gray-800/60"
                      title="Attach images"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImagesSelected} className="hidden" />

                    {/* Mode buttons */}
                    <div className="ml-2 hidden sm:flex items-center gap-2">
                      <button
                        onClick={() => setMode(prev => (prev === 'search' ? 'default' : 'search'))}
                        className={"w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors " + (mode === 'search' ? '' : 'hover:bg-opacity-80')}
                        style={{ backgroundColor: mode === 'search' ? '#f1d08c' : '#2a2a29', color: mode === 'search' ? '#000000' : '#ffffff' }}
                        title="Search the web"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {/* Mobile icons only */}
                    <div className="ml-2 flex sm:hidden items-center gap-2">
                      <button onClick={() => setMode(prev => (prev === 'search' ? 'default' : 'search'))} className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " + (mode==='search' ? '' : 'hover:bg-opacity-80')} style={{ backgroundColor: mode==='search' ? '#f1d08c' : '#2a2a29', color: mode==='search' ? '#000000' : '#ffffff' }} title="Search the web">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                      className="mr-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80"
                      style={{ backgroundColor: '#2a2a29' }}
                      title={isRecording ? 'Stop dictation' : 'Dictate'}
                    >
                      <Mic size={20} className={isRecording ? 'text-red-500 animate-pulse' : 'text-white'} />
                    </button>
                    <div className="relative inline-block">
                      {isLoading && (
                        <span className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#f1d08c] animate-spin" />
                      )}
                      <button
                        onClick={handleSearch}
                        disabled={isLoading || (!searchQuery.trim() && attachedImages.length === 0)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: (isLoading || canSend) ? '#f1d08c' : '#1a1a19' }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isLoading || canSend) ? '#e8c377' : '#2a2a29'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isLoading || canSend) ? '#f1d08c' : '#1a1a19'}
                      >
                        {isLoading ? (
                          <Square size={18} className="text-black" />
                        ) : (
                          <ArrowUp size={18} className={(isLoading || canSend) ? 'text-black' : 'text-white'} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area - Only show when conversation has started */}
      {conversationStarted && (
        <div ref={conversationScrollRef} className="flex-1 relative overflow-y-auto py-4">
          <div className="w-full px-4">
            <div className="max-w-xl lg:max-w-3xl mx-auto space-y-6 pb-32">
              {/* Conversation History */}
              {conversationHistory.map((message, index) => (
                <div key={index} className="w-full">
                  {message.type === 'user' ? (
                    <div className="flex flex-col items-end">
                      {message.images && message.images.length > 0 && (
                        <div className="mb-2 flex items-center">
                          {message.images.map((src, idx) => (
                            <div key={idx} className={"relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-1 ring-white/20 shadow bg-black " + (idx > 0 ? "-ml-2" : "")}>
                              <img src={src} alt={`user-attachment-${idx+1}`} className="w-full h-full object-cover" />
                              <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white">{idx+1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="max-w-[80%] rounded-2xl px-4 py-3" style={{ backgroundColor: '#1f1f1f' }}>
                        <p className="text-gray-300 text-sm sm:text-base whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <ResponseRenderer content={message.content} />
                      {/* Action buttons for AI responses */}
                      <div className="flex items-center space-x-2 mt-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(message.content)}
                        className="p-2 rounded hover:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        <CopyIcon size={18} className="text-gray-400" />
                      </button>
                      <button
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                        title="Upvote"
                      >
                        <ThumbsUp size={18} className="text-gray-400" />
                      </button>
                      <button
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                        title="Downvote"
                      >
                        <ThumbsDown size={18} className="text-gray-400" />
                      </button>
                      </div>
                      {/* Sources footer */}
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-3 border-t border-gray-800/60 pt-2">
                          <details>
                            <summary className="text-xs text-gray-400 cursor-pointer">Sources</summary>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.citations.map((c:any, i:number) => (
                                <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500">
                                  {c.title || c.url}
                                </a>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking Animation - Show when loading but no streaming response yet */}
              {isLoading && !streamingResponse && (
                <div className="w-full">
                  <div className="flex items-center space-x-3 text-gray-300">
                    <PendulumDots />
                    <span className="text-sm sm:text-base animate-pulse">{thinkingText}</span>
                  </div>
                </div>
              )}

              {/* Streaming Response */}
              {streamingResponse && (
                <div className="w-full">
                  <div ref={responseStartRef} />
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
                      <CopyIcon size={18} className="text-gray-400" />
                    </button>
                    <button
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                      title="Upvote"
                    >
                      <ThumbsUp size={18} className="text-gray-400" />
                    </button>
                    <button
                      className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                      title="Downvote"
            >
                      <ThumbsDown size={18} className="text-gray-400" />
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="w-full">
                  <p className="text-red-400 text-sm sm:text-base">{error}</p>
                </div>
              )}
            </div>
          </div>
          {/* Bottom fade to simulate scrolling under the bar */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#151514] via-[#151514]/90 to-transparent z-10" />
        </div>
      )}

      {/* Search Bar - Only show when conversation has started */}
      {conversationStarted && (
        <div className="w-full px-4 py-4">
          <div className="max-w-xl lg:max-w-3xl mx-auto">
            <div className="relative">
              <div className="relative overflow-visible flex items-start rounded-2xl px-4 pt-4 pb-12 shadow-lg" style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c', paddingTop: attachedImages.length > 0 ? 20 : undefined }}>
                {/* Full-bar waveform background */}
                {isRecording && (
                  <canvas
                    ref={waveCanvasRef}
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
                  />
                )}
                {/* Input Field */}
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => { if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  placeholder="Continue the conversation..."
                  className="humbl-textarea flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-base sm:text-lg resize-none min-h-[1.5rem] max-h-32 overflow-y-auto"
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

                {/* Suggestions dropdown (conversation bar) */}
                {/* No autocomplete during conversation */}

                {/* Attached images preview */}
                {attachedImages.length > 0 && (
                  <div className="absolute left-12 right-4 top-0 -translate-y-1/2 z-10">
                    <div className="flex items-center overflow-x-auto pr-2">
                      {attachedImages.map((src, idx) => (
                        <div key={idx} className={"relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-md bg-black flex-shrink-0 " + (idx > 0 ? "-ml-2" : "") }>
                          <img src={src} alt={`attachment-${idx+1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeAttachedImage(idx)}
                            className="absolute -top-1 -right-1 bg-black/80 rounded-full p-0.5"
                            title="Remove"
                          >
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcribing indicator */}
                {(!isRecording && isTranscribing) && (
                  <div className="absolute left-0 right-0 -bottom-2 translate-y-full px-2">
                    <p className="text-xs text-gray-400 animate-pulse">Transcribing…</p>
                  </div>
                )}

                {/* Bottom controls row */}
                <div className="absolute left-4 right-4 bottom-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={handleImagePickClickLower}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-gray-800/60"
                      title="Attach images"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                    <input ref={fileInputRef2} type="file" accept="image/*" multiple onChange={handleImagesSelected} className="hidden" />

                    {/* Mode buttons in conversation bar */}
                    <div className="ml-2 hidden sm:flex items-center gap-2">
                      <button
                        onClick={() => setMode(prev => (prev === 'search' ? 'default' : 'search'))}
                        className={"w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors " + (mode === 'search' ? '' : 'hover:bg-opacity-80')}
                        style={{ backgroundColor: mode === 'search' ? '#f1d08c' : '#2a2a29', color: mode === 'search' ? '#000000' : '#ffffff' }}
                        title="Search the web"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {/* Mobile icons only */}
                    <div className="ml-2 flex sm:hidden items-center gap-2">
                      <button onClick={() => setMode(prev => (prev === 'search' ? 'default' : 'search'))} className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " + (mode==='search' ? '' : 'hover:bg-opacity-80')} style={{ backgroundColor: mode==='search' ? '#f1d08c' : '#2a2a29', color: mode==='search' ? '#000000' : '#ffffff' }} title="Search the web">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                      className="mr-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80"
                      style={{ backgroundColor: '#2a2a29' }}
                      title={isRecording ? 'Stop dictation' : 'Dictate'}
                    >
                      <Mic size={20} className={isRecording ? 'text-red-500 animate-pulse' : 'text-white'} />
                    </button>
                    <div className="relative inline-block">
                      {isLoading && (
                        <span className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#f1d08c] animate-spin" />
                      )}
                      <button
                        onClick={handleSearch}
                        disabled={isLoading || (!searchQuery.trim() && attachedImages.length === 0)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: (isLoading || canSend) ? '#f1d08c' : '#1a1a19' }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isLoading || canSend) ? '#e8c377' : '#2a2a29'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = (isLoading || canSend) ? '#f1d08c' : '#1a1a19'}
                      >
                        {isLoading ? (
                          <Square size={18} className="text-black" />
                        ) : (
                          <ArrowUp size={18} className={(isLoading || canSend) ? 'text-black' : 'text-white'} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .humbl-textarea::-webkit-scrollbar { width: 8px; }
        .humbl-textarea::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 8px; }
        .humbl-textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 8px; }
        .humbl-textarea::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
        .humbl-textarea { scrollbar-color: rgba(255,255,255,0.25) rgba(0,0,0,0.2); scrollbar-width: thin; }
        /* Suggestions list: hide scrollbar but keep scroll */
        .humbl-suggest { -ms-overflow-style: none; scrollbar-width: none; }
        .humbl-suggest::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}