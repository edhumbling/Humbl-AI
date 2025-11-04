'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, ArrowUp, Square, Plus, X, Image as ImageIcon, ChevronDown, Check, Edit2, MoreVertical, Download, Copy as CopyIcon, Info, ThumbsUp, ThumbsDown, RefreshCw, Volume2, VolumeX, Share2 } from 'lucide-react';
import Image from 'next/image';
import ResponseRenderer from '@/components/ResponseRenderer';
import Sidebar from '@/components/Sidebar';
import { useConversation } from '@/contexts/ConversationContext';
import { useUser } from '@stackframe/stack';

export default function MessageSharePage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.id as string; // This will be t_...
  const user = useUser();
  const { 
    conversationHistory, 
    conversationStarted,
    getConversationHistory,
    addUserMessage, 
    addAIMessage, 
    clearConversation,
    startConversation,
    removeMessage
  } = useConversation();
  
  const [conversation, setConversation] = useState<any>(null);
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
  const [imageEditRemixMode, setImageEditRemixMode] = useState<'edit' | 'remix' | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [originalMessageCount, setOriginalMessageCount] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [showMessageShareModal, setShowMessageShareModal] = useState(false);
  const [messageShareId, setMessageShareId] = useState<string | null>(null);
  const [sharedMessageIndex, setSharedMessageIndex] = useState<number | null>(null);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [isGeneratingMessageShareLink, setIsGeneratingMessageShareLink] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const conversationBarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamReaderRef = useRef<ReadableStreamDefaultReader | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('humblai-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Fetch message share and load into context
  useEffect(() => {
    const fetchMessageShare = async () => {
      try {
        const response = await fetch(`/api/message-shares/${shareId}/public`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Message share not found');
          } else {
            setError('Failed to load message share');
          }
          return;
        }

        const data = await response.json();
        setConversation(data.conversation);
        
        // Check if current user owns this conversation (from API response)
        const ownerStatus = data.isOwner || false;
        setIsOwner(ownerStatus);
        
        // If user owns the conversation, use the original conversation ID
        if (ownerStatus) {
          // Find the conversation ID from the share
          const conversationId = data.conversation.id;
          setContinuationConversationId(conversationId);
          // Update URL to use the original conversation
          window.history.replaceState({}, '', `/c/${conversationId}`);
        }
        
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
        
        // Store the original message count (before user continues)
        setOriginalMessageCount(messages.length);
        
        // Mark conversation as started
        startConversation();
        
        // Check for continuation conversation (works for both logged in and anonymous users)
        const continuationKey = `continuation_${shareId}`;
        const continuationMessagesKey = `continuation_messages_${shareId}`;
        const existingContinuationId = localStorage.getItem(continuationKey);
        
        // Check for localStorage continuation messages (for anonymous users)
        const localStorageMessages = localStorage.getItem(continuationMessagesKey);
        if (localStorageMessages && !ownerStatus) {
          try {
            const continuationMessages = JSON.parse(localStorageMessages);
            // Add continuation messages to the conversation
            continuationMessages.forEach((msg: any) => {
              if (msg.role === 'user') {
                addUserMessage(msg.content || '', msg.images || []);
              } else {
                addAIMessage(msg.content || '', msg.images || [], msg.citations || []);
              }
            });
          } catch (err) {
            console.error('Error loading localStorage continuation:', err);
            localStorage.removeItem(continuationMessagesKey);
          }
        }
        
        // Check for database continuation (for logged-in users)
        if (existingContinuationId && !ownerStatus) {
          // Fetch continuation conversation messages
          try {
            const continuationResponse = await fetch(`/api/conversations/${existingContinuationId}/public`);
            if (continuationResponse.ok) {
              const continuationData = await continuationResponse.json();
              const continuationMessages = continuationData.conversation?.messages || [];
              
              // Find where original messages end and continuation starts
              const continuationStartIndex = messages.length;
              
              // Add continuation messages (skip the original messages that were already saved)
              for (let i = continuationStartIndex; i < continuationMessages.length; i++) {
                const msg = continuationMessages[i];
                if (msg.role === 'user') {
                  addUserMessage(msg.content || '', msg.images || []);
                } else {
                  addAIMessage(msg.content || '', msg.images || [], msg.citations || []);
                }
              }
              
              setContinuationConversationId(existingContinuationId);
            }
          } catch (err) {
            console.error('Error fetching continuation:', err);
            // If continuation fetch fails, clear it from localStorage
            localStorage.removeItem(continuationKey);
          }
        }
        
        // If user is logged in and owns the conversation, use the original conversation ID
        if (ownerStatus) {
          const conversationId = data.conversation.id;
          setContinuationConversationId(conversationId);
          // Update URL to use the original conversation
          window.history.replaceState({}, '', `/c/${conversationId}`);
        } else if (user && existingContinuationId) {
          // If user is logged in and has a continuation, set it
          setContinuationConversationId(existingContinuationId);
        }
        
      } catch (err) {
        console.error('Error fetching message share:', err);
        setError('Failed to load message share');
      }
    };

    if (shareId) {
      fetchMessageShare();
    }
  }, [shareId, clearConversation, addUserMessage, addAIMessage, startConversation, user]);

  // Migrate continuations when user logs in
  useEffect(() => {
    if (user && shareId && !isOwner) {
      const continuationKey = `continuation_${shareId}`;
      const continuationMessagesKey = `continuation_messages_${shareId}`;
      
      // Check if there are localStorage continuation messages to migrate
      const localStorageMessages = localStorage.getItem(continuationMessagesKey);
      if (localStorageMessages) {
        const migrateContinuation = async () => {
          try {
            const messages = JSON.parse(localStorageMessages);
            
            // Create a new conversation in the database
            const response = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                title: `Continuation: ${conversation?.title || 'Shared Message'}` 
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              const newConversationId = data.conversation.id;
              
              if (newConversationId) {
                // Save conversation ID to localStorage
                localStorage.setItem(continuationKey, newConversationId);
                setContinuationConversationId(newConversationId);
                
                // Save all original messages first
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
                
                // Save continuation messages to database
                for (const msg of messages) {
                  await fetch(`/api/conversations/${newConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      role: msg.role,
                      content: msg.content,
                      images: msg.images || [],
                      citations: msg.citations || [],
                      mode: msg.mode || 'default'
                    }),
                  });
                }
                
                // Clear localStorage continuation messages
                localStorage.removeItem(continuationMessagesKey);
              }
            }
          } catch (err) {
            console.error('Error migrating continuation:', err);
          }
        };
        
        migrateContinuation();
      }
    }
  }, [user, shareId, isOwner, conversation]);

  const handleSearch = async () => {
    if (!searchQuery.trim() && attachedImages.length === 0) return;
    if (isStreaming) return;

    const queryToUse = searchQuery.trim();
    const imagesToUse = attachedImages;
    setSearchQuery('');
    addUserMessage(queryToUse, imagesToUse);
    setAttachedImages([]);
    setImageGenerationMode(false);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingResponse('');

    const modeToUse = mode === 'search' ? 'search' : webSearchMode === 'on' ? 'search' : webSearchMode === 'auto' ? 'auto' : 'default';

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
          images: imagesToUse.slice(0, 3), 
          mode: modeToUse,
          conversationHistory: historyForAPI,
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) throw new Error('Search failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      // Store reader reference for cancellation
      streamReaderRef.current = reader;

      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  setError(data.error);
                  setIsStreaming(false);
                  setStreamingResponse('');
                  return;
                }
                
                if (data.content !== undefined && data.content !== null) {
                  // Convert content to string to handle numeric values
                  const contentStr = String(data.content);
                  fullResponse += contentStr;
                  setStreamingResponse(fullResponse);
                }
                
                if (data.done) {
                  // Ensure fullResponse is a string before finalizing
                  const finalResponse = String(fullResponse || '');
                  break;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } catch (err: any) {
        // Check if aborted
        if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
          // User cancelled, finalize with current response
          if (fullResponse) {
            const finalResponse = String(fullResponse || '');
            addAIMessage(finalResponse);
          }
          setStreamingResponse('');
          setIsStreaming(false);
          return;
        }
        throw err;
      }

      // Ensure fullResponse is a string before adding to conversation
      const finalResponse = String(fullResponse || '');
      addAIMessage(finalResponse);
      setStreamingResponse('');
      
      // Save continuation if user is logged in
      if (user) {
        // If user owns the conversation, save directly to original conversation
        if (isOwner) {
          const conversationId = conversation?.id;
          if (conversationId) {
            try {
              await fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  role: 'user',
                  content: queryToUse,
                  images: attachedImages,
                  mode: 'default'
                }),
              });
              
              await fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  role: 'assistant',
                  content: finalResponse,
                  images: [],
                  citations: [],
                  mode: 'default'
                }),
              });
            } catch (err) {
              console.error('Failed to save message:', err);
            }
          }
        } else {
          // User doesn't own it, create continuation
          const continuationKey = `continuation_${shareId}`;
          let newConversationId = localStorage.getItem(continuationKey);
          
          try {
            if (!newConversationId) {
              const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: `Continuation: ${conversation?.title || 'Shared Message'}` 
                }),
              });
              
              if (response.ok) {
                const data = await response.json();
                newConversationId = data.conversation.id;
                if (newConversationId) {
                  localStorage.setItem(continuationKey, newConversationId);
                  setContinuationConversationId(newConversationId);
                  
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
              setContinuationConversationId(newConversationId);
            }
          } catch (err) {
            console.error('Failed to create continuation:', err);
          }
          
          // Save new messages to continuation
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
                content: finalResponse,
                images: [],
                citations: [],
                mode: 'default'
              }),
            });
          }
        }
      } else {
        // Anonymous user: store continuation messages in localStorage
        const continuationKey = `continuation_${shareId}`;
        const continuationMessagesKey = `continuation_messages_${shareId}`;
        
        // Get existing continuation messages from localStorage
        const existingMessages = JSON.parse(localStorage.getItem(continuationMessagesKey) || '[]');
        
        // Add new messages
        const newMessages = [
          ...existingMessages,
          {
            role: 'user',
            content: queryToUse,
            images: attachedImages,
            mode: 'default',
            timestamp: Date.now()
          },
          {
            role: 'assistant',
            content: finalResponse,
            images: [],
            citations: [],
            mode: 'default',
            timestamp: Date.now()
          }
        ];
        
        // Save to localStorage
        localStorage.setItem(continuationMessagesKey, JSON.stringify(newMessages));
      }
    } catch (error) {
      console.error('Error:', error);
      addAIMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsStreaming(false);
      // Clean up refs
      streamReaderRef.current = null;
    }
  };

  const stopStreaming = () => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Cancel the reader
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel().catch(() => {});
      streamReaderRef.current = null;
    }
    // Clear progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsStreaming(false);
    setStreamingResponse('');
  };

  const modeToUse = mode === 'search' ? 'search' : webSearchMode === 'on' ? 'search' : webSearchMode === 'auto' ? 'auto' : 'default';
  const canSend = searchQuery.trim().length > 0 || attachedImages.length > 0;
  const placeholderText = imageGenerationMode ? 'Describe the image you want to generate...' : 'Ask anything...';

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRetry = async (message: any, messageIndex: number) => {
    if (message.originalQuery !== undefined || message.originalImages?.length) {
      removeMessage(messageIndex);
      setSearchQuery(message.originalQuery || '');
      setAttachedImages(message.originalImages || []);
      setMode(message.originalMode || 'default');
      await handleSearch();
    }
  };

  const handleTTS = async (text: string, messageId: string) => {
    if (playingAudioId === messageId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingAudioId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        let errorMessage = 'Failed to generate audio';
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Failed to generate audio (${response.status})`;
          }
        } else {
          errorMessage = `Failed to generate audio (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      if (contentType && !contentType.startsWith('audio/')) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid response format');
        } catch (jsonError: any) {
          throw new Error(jsonError.message || 'Invalid response format');
        }
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      setPlayingAudioId(messageId);
      await audio.play();
    } catch (error: any) {
      console.error('TTS error:', error);
      setPlayingAudioId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

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
    
    setTimeout(doScroll, 50);
    const vv: any = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
      const handleViewportChange = () => {
        requestAnimationFrame(doScroll);
      };
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
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

  const handleStartEditImage = (index: number) => {
    setImageEditRemixMode('edit');
    setSelectedImageIndex(index);
    setImageIconDropdownOpen(false);
    // Focus search bar
    setTimeout(() => {
      const textarea = document.querySelector('.humbl-textarea') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    }, 100);
  };

  const handleStartRemixImage = (index: number) => {
    setImageEditRemixMode('remix');
    setSelectedImageIndex(index);
    setImageIconDropdownOpen(false);
    // Focus search bar
    setTimeout(() => {
      const textarea = document.querySelector('.humbl-textarea') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    }, 100);
  };

  const handleCancelImageEditRemix = () => {
    setImageEditRemixMode(null);
    setSelectedImageIndex(null);
    setSearchQuery('');
  };

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
    setIsRecording(false);
  };

  const handleMessageShare = async (messageIndex: number) => {
    if (!continuationConversationId && !shareId) return;
    const convIdToUse = continuationConversationId || shareId;
    if (!convIdToUse || !user) return;
    
    setIsGeneratingMessageShareLink(true);
    
    try {
      const response = await fetch('/api/message-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convIdToUse,
          messageIndex: messageIndex
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessageShareId(data.shareId);
        setSharedMessageIndex(messageIndex);
        setIsGeneratingMessageShareLink(false);
        setShowMessageShareModal(true);
      } else {
        console.error('Failed to create message share');
        setIsGeneratingMessageShareLink(false);
      }
    } catch (error) {
      console.error('Error creating message share:', error);
      setIsGeneratingMessageShareLink(false);
    }
  };

  const handleShare = async () => {
    const shareIdToUse = continuationConversationId || shareId;
    if (shareIdToUse) {
      setIsGeneratingShareLink(true);
      // Small delay for UX consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsGeneratingShareLink(false);
      setShowShareModal(true);
    }
  };

  const getShareUrl = () => {
    const shareIdToUse = continuationConversationId || shareId;
    return `${window.location.origin}/s/${shareIdToUse}`;
  };

  const startNewConversation = () => {
    router.push('/');
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" data-theme={theme} style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#f1d08c', color: '#000000' }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationScrollRef.current) {
      conversationScrollRef.current.scrollTop = conversationScrollRef.current.scrollHeight;
    }
  }, [conversationHistory, streamingResponse]);

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
                  <Image src="/small favicon.png" alt="Humbl AI" width={64} height={64} className="h-16 w-16 opacity-90" priority />
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
            {conversationStarted && (shareId || continuationConversationId) && (
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
                  {/* Action buttons for AI responses */}
                  {message.type === 'ai' && (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                      <button
                        onClick={() => handleCopy(message.content)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        <CopyIcon size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      {message.originalQuery !== undefined && (
                        <div className="relative flex flex-col items-center group">
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                            <div className="bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded-lg whitespace-nowrap relative">
                              Try again
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRetry(message, index)}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                            title="Try again"
                          >
                            <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                          </button>
                        </div>
                      )}
                      <button
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Upvote"
                      >
                        <ThumbsUp size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      <button
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Downvote"
                      >
                        <ThumbsDown size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleTTS(message.content, `msg-${index}`)}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title={playingAudioId === `msg-${index}` ? "Stop audio" : "Play audio"}
                      >
                        {playingAudioId === `msg-${index}` ? (
                          <VolumeX size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        ) : (
                          <Volume2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        )}
                      </button>
                      {message.type === 'ai' && (
                        <button
                          onClick={() => handleMessageShare(index)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                          title="Share this message"
                        >
                          <Share2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        </button>
                      )}
                    </div>
                  )}
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
              ))}

              {/* Streaming Response */}
              {streamingResponse && (
                <div className="w-full">
                  <ResponseRenderer content={streamingResponse} isLoading={isStreaming} theme={theme} />
                  {/* Action buttons for streaming response */}
                  {!isStreaming && (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                      <button
                        onClick={() => handleCopy(streamingResponse)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        <CopyIcon size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      <button
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Upvote"
                      >
                        <ThumbsUp size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      <button
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Downvote"
                      >
                        <ThumbsDown size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleTTS(streamingResponse, 'streaming')}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title={playingAudioId === 'streaming' ? "Stop audio" : "Play audio"}
                      >
                        {playingAudioId === 'streaming' ? (
                          <VolumeX size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        ) : (
                          <Volume2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleMessageShare(conversationHistory.length - 1)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Share this message"
                      >
                        <Share2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                    </div>
                  )}
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
                      {/* Create Image button with dropdown */}
                      <div className="ml-2 relative image-icon-dropdown-container">
                        <div className="flex items-center">
                          <button
                            onClick={handleToggleImageMode}
                            className={`h-8 flex items-center justify-center transition-colors hover:bg-opacity-80 ${imageGenerationMode && attachedImages.length > 0 ? 'rounded-l-full pl-3 pr-2' : 'rounded-full px-3'}`}
                            style={{ backgroundColor: imageGenerationMode ? '#f1d08c' : '#2a2a29', color: imageGenerationMode ? '#000000' : '#ffffff' }}
                            title="Create image"
                          >
                            <ImageIcon size={16} className="w-4 h-4" />
                          </button>
                          {imageGenerationMode && attachedImages.length > 0 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageIconDropdownOpen(!imageIconDropdownOpen);
                                }}
                                className="h-8 w-6 rounded-r-full flex items-center justify-center transition-colors hover:bg-opacity-80"
                                style={{ backgroundColor: '#f1d08c', color: '#000000' }}
                                title="Image actions"
                              >
                                <ChevronDown size={12} />
                              </button>
                              {imageIconDropdownOpen && (
                                <div className="absolute bottom-full right-0 mb-1 rounded-lg shadow-lg overflow-hidden z-30" style={{ backgroundColor: '#1f1f1f', border: '1px solid #3a3a39' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditImage(0);
                                      setImageIconDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                  >
                                    <Edit2 size={12} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRemixImage(0);
                                      setImageIconDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                  >
                                    <ImageIcon size={12} />
                                    Remix
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Mobile icons only */}
                    <div className="ml-2 flex sm:hidden items-center gap-2">
                      <button onClick={() => { setMode(prev => (prev === 'search' ? 'default' : 'search')); if (mode !== 'search') setImageGenerationMode(false); }} className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " + (mode==='search' ? '' : 'hover:bg-opacity-80')} style={{ backgroundColor: mode==='search' ? '#f1d08c' : '#2a2a29', color: mode==='search' ? '#000000' : '#ffffff' }} title="Search the web">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                      <div className="relative image-icon-dropdown-container">
                        <div className="flex items-center">
                          <button
                            onClick={handleToggleImageMode}
                            className={`h-8 flex items-center justify-center transition-colors hover:bg-opacity-80 ${imageGenerationMode && attachedImages.length > 0 ? 'rounded-l-full pl-3 pr-2' : 'rounded-full px-3'}`}
                            style={{ backgroundColor: imageGenerationMode ? '#f1d08c' : '#2a2a29', color: imageGenerationMode ? '#000000' : '#ffffff' }}
                            title="Create image"
                          >
                            <ImageIcon size={16} className="w-4 h-4" />
                          </button>
                          {imageGenerationMode && attachedImages.length > 0 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageIconDropdownOpen(!imageIconDropdownOpen);
                                }}
                                className="h-8 w-6 rounded-r-full flex items-center justify-center transition-colors hover:bg-opacity-80"
                                style={{ backgroundColor: '#f1d08c', color: '#000000' }}
                                title="Image actions"
                              >
                                <ChevronDown size={12} />
                              </button>
                              {imageIconDropdownOpen && (
                                <div className="absolute bottom-full right-0 mb-1 rounded-lg shadow-lg overflow-hidden z-30" style={{ backgroundColor: '#1f1f1f', border: '1px solid #3a3a39' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditImage(0);
                                      setImageIconDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                  >
                                    <Edit2 size={12} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRemixImage(0);
                                      setImageIconDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                  >
                                    <ImageIcon size={12} />
                                    Remix
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
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
                      {isStreaming && (
                        <span className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#f1d08c] animate-spin" />
                      )}
                      <button
                        onClick={() => isStreaming ? stopStreaming() : handleSearch()}
                      disabled={!isStreaming && (!searchQuery.trim() && attachedImages.length === 0)}
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

      {/* Generating Link Loading Overlay */}
      {(isGeneratingShareLink || isGeneratingMessageShareLink) && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backdropFilter: 'blur(8px)' }}>
          <div 
            className="rounded-2xl shadow-2xl p-8 flex flex-col items-center"
            style={{
              backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
            }}
          >
            {/* 12-segment spinner */}
            <div className="relative w-16 h-16 mb-4">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180);
                const radius = 20;
                const x = Math.sin(angle) * radius;
                const y = -Math.cos(angle) * radius;
                return (
                  <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: '3px',
                      height: '8px',
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: `rotate(${i * 30 + 90}deg)`,
                      transformOrigin: 'center',
                      backgroundColor: theme === 'dark' ? '#ffffff' : '#000000',
                      opacity: 0.2 + (i / 12) * 0.8,
                      animation: 'spin-segment 1.2s linear infinite',
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                );
              })}
            </div>
            <p className="text-lg font-medium" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
              Generating link...
            </p>
          </div>
        </div>
      )}

      {/* Share Modal and Message Share Modal - Copy from /c/[id]/page.tsx */}
      {/* I'll add these modals in the next section due to length */}
      
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
          router.push(`/c/${id}`);
        }}
        currentConversationId={continuationConversationId || shareId}
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
        @keyframes spin-segment {
          0% { opacity: 0.1; }
          50% { opacity: 1; }
          100% { opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}

