'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Send, Copy as CopyIcon, ThumbsUp, ThumbsDown, Plus, Info, X, ArrowUp, Square, RefreshCw, Check, Volume2, VolumeX, ChevronDown, Image as ImageIcon, Download, Edit2, MoreVertical, Sun, Moon, Menu, Share2, ChevronLeft, ChevronRight, Maximize2, Minimize2, Globe, Lightbulb, Folder, Archive, Flag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import ResponseRenderer from '../components/ResponseRenderer';
import Sidebar from '../components/Sidebar';
import Onboarding from '../components/Onboarding';
import { useConversation } from '@/contexts/ConversationContext';
import { useUser } from '@stackframe/stack';

interface SearchResult {
  query: string;
  response: string;
  timestamp: string;
}

export default function Home() {
  const router = useRouter();
  const user = useUser();
  const {
    conversationHistory,
    conversationStarted,
    getConversationHistory,
    addUserMessage,
    addAIMessage,
    updateLastAIMessage,
    updateMessageAt,
    removeMessage,
    clearConversation,
    startConversation,
    endConversation,
  } = useConversation();

  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const firstAIMessageRef = useRef<boolean>(false);

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
    
    // Clear conversation state and reset URL
    endConversation();
    clearConversation();
    setCurrentConversationId(undefined);
    firstAIMessageRef.current = false;
    setSearchQuery('');
    setSearchResult(null);
    setStreamingResponse('');
    setError(null);
    setThinkingText('');
    
    // Reset URL to home page
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  };

  // Load a conversation from database
  const handleSelectConversation = async (conversationId: string) => {
    try {
      // Stop any ongoing recording
      if (isRecording) {
        stopRecording();
      }
      if ((window as any).thinkingInterval) {
        clearInterval((window as any).thinkingInterval);
      }
    } catch {}

    setCurrentConversationId(conversationId);
    
    // Update URL to show conversation ID in address bar without page reload
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `/c/${conversationId}`);
    }
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      
      if (response.ok) {
        const data = await response.json();
        const conversation = data.conversation;
        
        // Clear current conversation and load the selected one
        clearConversation();
        
        // Load all messages from the database
        if (conversation.messages && conversation.messages.length > 0) {
          conversation.messages.forEach((msg: any) => {
            if (msg.role === 'user') {
              addUserMessage(msg.content, msg.images || []);
            } else if (msg.role === 'assistant') {
              addAIMessage(
                msg.content,
                msg.images || [],
                msg.citations || []
              );
            }
          });
        }
        
        // Start the conversation if there are messages
        if (conversation.messages && conversation.messages.length > 0) {
          startConversation();
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation');
    }
  };

  // Helper function to ensure conversation exists in database
  const ensureConversation = async () => {
    if (currentConversationId || !user) {
      return currentConversationId;
    }

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      if (response.ok) {
        const data = await response.json();
        const newConversationId = data.conversation.id;
        setCurrentConversationId(newConversationId);
        
        // Update URL to show conversation ID in address bar without page reload
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', `/c/${newConversationId}`);
        }
        
        return newConversationId;
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
    return null;
  };

  const [showInfo, setShowInfo] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMessageShareModal, setShowMessageShareModal] = useState(false);
  const [messageShareId, setMessageShareId] = useState<string | null>(null);
  const [sharedMessageIndex, setSharedMessageIndex] = useState<number | null>(null);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [isGeneratingMessageShareLink, setIsGeneratingMessageShareLink] = useState(false);
  const [mode, setMode] = useState<'default' | 'search' | 'study' | 'image'>('default');
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [imageGenerationMode, setImageGenerationMode] = useState(false);
  const [showWebSearchDropdown, setShowWebSearchDropdown] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);
  const [imageEditRemixMode, setImageEditRemixMode] = useState<'edit' | 'remix' | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const canSend = (!!searchQuery.trim() || attachedImages.length > 0 || (imageEditRemixMode && selectedImageIndex !== null)) && !isLoading;
  const [imageMenuOpen, setImageMenuOpen] = useState<number | null>(null);
  const [imageIconDropdownOpen, setImageIconDropdownOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [dailyPrompts, setDailyPrompts] = useState<string[]>([]);
  const [votesByIndex, setVotesByIndex] = useState<Record<number, 'up' | 'down' | null>>({});
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);

  const handleVote = async (messageIndex: number, vote: 'up' | 'down') => {
    setVotesByIndex(prev => {
      const current = prev[messageIndex] || null;
      const next = current === vote ? null : vote;
      return { ...prev, [messageIndex]: next };
    });
    try {
      if (currentConversationId != null && currentConversationId !== '' && messageIndex >= 0) {
        await fetch('/api/votes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: currentConversationId, messageIndex, vote }),
        });
      }
    } catch {}
  };

  // Fetch folders when user is available
  useEffect(() => {
    const fetchFolders = async () => {
      if (!user) return;
      try {
        const response = await fetch('/api/folders');
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      }
    };
    fetchFolders();
  }, [user]);

  const handleArchiveConversation = async () => {
    if (!currentConversationId || !user) return;
    try {
      const response = await fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      });
      if (response.ok) {
        setShowArchiveModal(false);
        setShowConversationMenu(false);
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!currentConversationId || !user) return;
    try {
      const response = await fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (response.ok) {
        setShowMoveToFolderModal(false);
        setShowConversationMenu(false);
      }
    } catch (error) {
      console.error('Failed to move conversation:', error);
    }
  };

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [retryDropdownOpen, setRetryDropdownOpen] = useState<number | null>(null);
  const [retryCustomPrompt, setRetryCustomPrompt] = useState('');
  const retryDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const suggestTimeoutRef = useRef<number | null>(null);
  const suggestionSelectedRef = useRef<boolean>(false);
  const initialSearchRef = useRef<HTMLDivElement | null>(null);
  const conversationBarRef = useRef<HTMLDivElement | null>(null);
  const retryStateRef = useRef<{ messageIndex: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamReaderRef = useRef<ReadableStreamDefaultReader | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleImagePickClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImagePickClickLower = () => {
    if (fileInputRef2.current) fileInputRef2.current.click();
  };

  const handleImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const maxAllowed = Math.max(0, 3 - attachedImages.length);
    const toRead = Array.from(files).slice(0, Math.max(0, maxAllowed));
    const readers = toRead.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }));
    try {
      const results = await Promise.all(readers);
      setAttachedImages(prev => [...prev, ...results].slice(0, 3));
    } catch {}
    // reset input so selecting the same file again triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = async (retryQuery?: string, retryImages?: string[], retryMode?: 'default' | 'search' | 'study' | 'image', isRetry?: boolean) => {
    // Handle image edit/remix mode
    if (imageEditRemixMode && selectedImageIndex !== null) {
      const instruction = retryQuery ?? searchQuery;
      if (instruction.trim()) {
        await handleImageEditRemix(instruction);
        return;
      }
      return;
    }

    const queryToUse = retryQuery ?? searchQuery;
    const imagesToUse = retryImages ?? attachedImages;
    if (!queryToUse.trim() && imagesToUse.length === 0) return;

    // Start conversation
    startConversation();

    // Ensure conversation exists in database
    const convId = await ensureConversation();

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setStreamingResponse('');
    
    const modeToUse = retryMode ?? (imageGenerationMode ? 'image' : mode);
    
    // Add user message to conversation history for UI (before processing)
    // This ensures the user's query is displayed normally
    if (!isRetry) {
      addUserMessage(queryToUse, imagesToUse.slice(0, 3));
      // Save user message to database if conversation exists
      if (convId && user) {
        try {
          await fetch(`/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'user',
              content: queryToUse,
              images: imagesToUse.slice(0, 3),
              mode: modeToUse
            })
          });
        } catch (err) {
          console.error('Failed to save user message:', err);
        }
      }
    }
    
    // Handle image generation mode
    if (modeToUse === 'image') {
      // Set generating state and progress
      setIsGeneratingImage(true);
      setImageGenerationProgress(0);
      
      // Add a placeholder AI message for the generation status
      addAIMessage('', [], undefined, queryToUse, imagesToUse.slice(0, 3), modeToUse);
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImageGenerationProgress(prev => {
          if (prev >= 90) return prev; // Stop at 90% until actual completion
          return prev + Math.random() * 15;
        });
      }, 500);
      progressIntervalRef.current = progressInterval;
      
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: queryToUse }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to generate image' }));
          throw new Error(errorData.error || 'Failed to generate image');
        }

        const imageData = await response.json();
        
        // Complete progress
        setImageGenerationProgress(100);
        
        if (imageData.imageUrl) {
          // Update the last AI message with the generated image
          setTimeout(async () => {
            updateLastAIMessage('Image generated successfully!', [imageData.imageUrl]);
            
            // Save AI message with image to database
            if (convId && user) {
              try {
                await fetch(`/api/conversations/${convId}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    role: 'assistant',
                    content: 'Image generated successfully!',
                    images: [imageData.imageUrl],
                    mode: modeToUse
                  })
                });
                // Generate conversation title for image generation
                if (!firstAIMessageRef.current) {
                  firstAIMessageRef.current = true; // Mark as processed
                  try {
                    const titleResponse = await fetch('/api/conversations/generate-title', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        query: queryToUse,
                        aiResponse: 'Image generated successfully!'
                      })
                    });
                    
                    if (titleResponse.ok) {
                      const titleData = await titleResponse.json();
                      const generatedTitle = titleData.title || queryToUse.substring(0, 50);
                      
                      await fetch(`/api/conversations/${convId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: generatedTitle })
                      });
                    } else {
                      // Fallback to query
                      await fetch(`/api/conversations/${convId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: queryToUse.substring(0, 50) })
                      });
                    }
                  } catch (titleErr) {
                    console.error('Failed to generate title:', titleErr);
                    await fetch(`/api/conversations/${convId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: queryToUse.substring(0, 50) })
                    });
                  }
                }
              } catch (err) {
                console.error('Failed to save image message:', err);
              }
            }
            
            setSearchQuery('');
            setAttachedImages([]);
            setIsLoading(false);
            setIsGeneratingImage(false);
            setImageGenerationProgress(0);
            if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
            progressIntervalRef.current = null;
            setImageGenerationMode(false); // Reset mode after generation
          }, 300);
          return;
        }
      } catch (err: any) {
        // Check if aborted
        if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
          setIsGeneratingImage(false);
          setImageGenerationProgress(0);
          if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
          removeMessage(conversationHistory.length - 1);
          setIsLoading(false);
          setImageGenerationMode(false);
          return;
        }
        console.error('Failed to generate image:', err);
        setError(err.message || 'Failed to generate image');
        setIsLoading(false);
        setIsGeneratingImage(false);
        setImageGenerationProgress(0);
        if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
        // Remove the placeholder AI message on error
        removeMessage(conversationHistory.length - 1);
        return;
      }
    }

    // Start thinking text rotation for non-image queries
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
      // Build conversation history for API context
      // Use getConversationHistory to get the latest state synchronously (via ref)
      // This ensures we get the most up-to-date history including any recent additions
      let historyToUse = getConversationHistory();
      
      if (isRetry) {
        // For retry, exclude the last AI message we're retrying
        historyToUse = historyToUse.filter((msg, idx) => {
          return !(idx === historyToUse.length - 1 && msg.type === 'ai');
        });
      }
      
      // Convert to API format - includes all previous conversation history
      // The current query will be added by the API, so we send all previous messages
      // Filter out empty messages to avoid sending placeholders
      const historyForAPI = historyToUse
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content || '',
          images: msg.images,
        }));

      // User message already added above for all modes
      // Skip duplicate addition for non-image modes

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: queryToUse, 
          images: imagesToUse.slice(0, 3), 
          mode: modeToUse,
          conversationHistory: historyForAPI,
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Store reader reference for cancellation
      streamReaderRef.current = reader;

      let fullResponse = '';
      let finalCitations: Array<{ title: string; url: string }> | undefined = undefined;
      let aiMessageInitialized = false;

      // Initialize AI message placeholder for streaming (only if not retrying)
      if (!retryStateRef.current) {
        updateLastAIMessage('', undefined);
      }

      try {
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
                  setThinkingText('');
                  clearInterval((window as any).thinkingInterval);
                  return;
                }
                
                if (data.done) {
                  // Check if this is a retry FIRST (before checking aiMessageInitialized)
                  if (retryStateRef.current && fullResponse) {
                    const retryMessageIndex = retryStateRef.current.messageIndex;
                    // Get fresh message from history using ref to avoid stale closure
                    const currentHistory = getConversationHistory();
                    const retryMessage = currentHistory[retryMessageIndex];
                    
                    if (retryMessage && retryMessage.type === 'ai') {
                      // Add as retry version instead of replacing
                      const newRetryVersions = [
                        ...(retryMessage.retryVersions || []),
                        {
                          content: String(fullResponse),
                          citations: data.citations || finalCitations,
                          timestamp: new Date().toISOString()
                        }
                      ];
                      
                      updateMessageAt(retryMessageIndex, {
                        retryVersions: newRetryVersions,
                        currentRetryIndex: newRetryVersions.length, // Show the new retry version
                        originalQuery: retryMessage.originalQuery || queryToUse,
                        originalImages: retryMessage.originalImages || imagesToUse.slice(0, 3),
                        originalMode: retryMessage.originalMode || modeToUse,
                      });
                      
                      // Remove any temporary streaming message that might have been created
                      const currentHistoryAfterUpdate = getConversationHistory();
                      const lastIndex = currentHistoryAfterUpdate.length - 1;
                      if (lastIndex >= 0 && lastIndex !== retryMessageIndex) {
                        // Check if last message is a temporary retry message (empty or duplicate)
                        const lastMsg = currentHistoryAfterUpdate[lastIndex];
                        if (lastMsg.type === 'ai' && (!lastMsg.content || lastMsg.content.trim() === '')) {
                          // Remove temporary message
                          removeMessage(lastIndex);
                        }
                      }
                      
                      retryStateRef.current = null; // Clear retry state
                      setStreamingResponse(''); // Clear streaming response
                    } else {
                      // Retry message not found, fall back to normal handling
                      retryStateRef.current = null;
                      if (aiMessageInitialized && fullResponse) {
                        const lastIndex = conversationHistory.length - 1;
                        if (lastIndex >= 0) {
                          updateMessageAt(lastIndex, {
                            content: String(fullResponse),
                            citations: data.citations || finalCitations,
                            originalQuery: queryToUse,
                            originalImages: imagesToUse.slice(0, 3),
                            originalMode: modeToUse,
                          });
                        }
                      } else {
                        addAIMessage(
                          String(fullResponse),
                          undefined,
                          data.citations || finalCitations,
                          queryToUse,
                          imagesToUse.slice(0, 3),
                          modeToUse
                        );
                      }
                    }
                  } else if (aiMessageInitialized && fullResponse) {
                    // Normal response - update the existing streaming message with final metadata
                    const lastIndex = conversationHistory.length - 1;
                    if (lastIndex >= 0) {
                      updateMessageAt(lastIndex, {
                        content: String(fullResponse),
                        citations: data.citations || finalCitations,
                        originalQuery: queryToUse,
                        originalImages: imagesToUse.slice(0, 3),
                        originalMode: modeToUse,
                      });
                    }
                  } else if (fullResponse) {
                    // No streaming happened, add new message
                    addAIMessage(
                      String(fullResponse),
                      undefined,
                      data.citations || finalCitations,
                      queryToUse,
                      imagesToUse.slice(0, 3),
                      modeToUse
                    );
                  }
                  
                  // Save AI message to database
                  if (convId && user && fullResponse) {
                    try {
                      await fetch(`/api/conversations/${convId}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          role: 'assistant',
                          content: fullResponse,
                          citations: data.citations || finalCitations,
                          mode: modeToUse
                        })
                      });
                      // Generate and update conversation title from first AI response
                      if (!firstAIMessageRef.current) { // Check if this is the first AI message
                        firstAIMessageRef.current = true; // Mark as processed
                        try {
                          const titleResponse = await fetch('/api/conversations/generate-title', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              query: queryToUse,
                              aiResponse: fullResponse
                            })
                          });
                          
                          if (titleResponse.ok) {
                            const titleData = await titleResponse.json();
                            const generatedTitle = titleData.title || queryToUse.substring(0, 50);
                            
                            await fetch(`/api/conversations/${convId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title: generatedTitle })
                            });
                          } else {
                            // Fallback to query if title generation fails
                            await fetch(`/api/conversations/${convId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title: queryToUse.substring(0, 50) })
                            });
                          }
                        } catch (titleErr) {
                          console.error('Failed to generate title:', titleErr);
                          // Fallback to query if title generation fails
                          try {
                            await fetch(`/api/conversations/${convId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title: queryToUse.substring(0, 50) })
                            });
                          } catch (fallbackErr) {
                            console.error('Failed to update conversation title:', fallbackErr);
                          }
                        }
                      }
                    } catch (err) {
                      console.error('Failed to save AI message:', err);
                    }
                  }
                  
                  // Clear streaming response and search query
                  setStreamingResponse('');
                  setSearchQuery('');
                  setIsLoading(false);
                  setThinkingText('');
                  clearInterval((window as any).thinkingInterval);
                  setAttachedImages([]);
                  break; // Break out of while loop instead of return
                }
                
                if (data.content !== undefined && data.content !== null) {
                  // Convert content to string to handle numeric values
                  const contentStr = String(data.content);
                  fullResponse += contentStr;
                  setStreamingResponse(fullResponse);
                  // Only update message if not retrying (retries will be added as versions when done)
                  if (!retryStateRef.current) {
                    // Update last AI message for streaming
                    updateLastAIMessage(fullResponse);
                    aiMessageInitialized = true;
                  }
                  // For retries, we just update streamingResponse state - no temporary message needed
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
      } catch (err: any) {
        // Check if aborted
        if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
          // User cancelled, finalize with current response
          if (fullResponse) {
            const lastIndex = conversationHistory.length - 1;
            if (lastIndex >= 0 && aiMessageInitialized) {
              updateMessageAt(lastIndex, {
                content: fullResponse,
                citations: finalCitations,
                originalQuery: queryToUse,
                originalImages: imagesToUse.slice(0, 3),
                originalMode: modeToUse,
              });
            } else {
              addAIMessage(
                fullResponse,
                undefined,
                finalCitations,
                queryToUse,
                imagesToUse.slice(0, 3),
                modeToUse
              );
            }
          }
          setStreamingResponse('');
          setIsLoading(false);
          setThinkingText('');
          clearInterval((window as any).thinkingInterval);
          return;
        }
        setError('Failed to search. Please try again.');
        console.error('Search error:', err);
        setIsLoading(false);
        setThinkingText('');
        clearInterval((window as any).thinkingInterval);
      } finally {
        // Clean up refs
        streamReaderRef.current = null;
      }
    } catch (outerErr: any) {
      // Handle errors from fetch or reader setup
      setError('Failed to search. Please try again.');
      console.error('Search error:', outerErr);
      setIsLoading(false);
      setThinkingText('');
      clearInterval((window as any).thinkingInterval);
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
    setIsLoading(false);
    setIsGeneratingImage(false);
    setImageGenerationProgress(0);
    setStreamingResponse('');
    setThinkingText('');
    clearInterval((window as any).thinkingInterval);
  };

  const handleRetry = async (message: any, messageIndex: number, retryType: 'try-again' | 'add-details' | 'more-concise' | 'search-web' | 'think-longer' | 'custom' = 'try-again', customPrompt?: string) => {
    setRetryDropdownOpen(null); // Close dropdown
    setRetryCustomPrompt(''); // Clear custom prompt
    
    // Get the original query from the message or find the previous user message
    let query = message.originalQuery || '';
    let images = message.originalImages || [];
    let mode = message.originalMode || 'default';
    
    // If no originalQuery, try to find the previous user message
    if (!query && !customPrompt) {
      // Look backwards from this message to find the user query
      for (let i = messageIndex - 1; i >= 0; i--) {
        const prevMessage = conversationHistory[i];
        if (prevMessage && prevMessage.type === 'user') {
          query = prevMessage.content;
          images = prevMessage.images || [];
          break;
        }
      }
    }
    
    // If still no query and no custom prompt, we can't retry
    if (!query && !customPrompt && images.length === 0) {
      console.warn('Cannot retry: No query found');
      return;
    }
    
    let modifiedQuery = query;
    let modifiedMode = mode;
    
    switch (retryType) {
      case 'try-again':
        // Just regenerate with same query
        break;
      case 'add-details':
        modifiedQuery = `${query}\n\nPlease provide more details and expand on this topic.`;
        break;
      case 'more-concise':
        modifiedQuery = `${query}\n\nPlease provide a more concise response.`;
        break;
      case 'search-web':
        modifiedMode = 'search';
        break;
      case 'think-longer':
        modifiedQuery = `${query}\n\nPlease think step by step and provide a thorough analysis.`;
        break;
      case 'custom':
        modifiedQuery = customPrompt || query;
        break;
    }

    // Set retry state BEFORE calling handleSearch
    retryStateRef.current = { messageIndex };
    
    // Set loading state
    setIsLoading(true);
    setStreamingResponse('');
    setError(null);
    
    try {
      // Generate new response - pass isRetry=true to prevent adding user message
      await handleSearch(modifiedQuery, images, modifiedMode, true);
    } catch (err) {
      setError('Failed to retry. Please try again.');
      setIsLoading(false);
      retryStateRef.current = null;
    }
  };

  // Handle retry version navigation
  const handleRetryVersionChange = (messageIndex: number, direction: 'prev' | 'next') => {
    const message = conversationHistory[messageIndex];
    if (!message || message.type !== 'ai' || !message.retryVersions || message.retryVersions.length === 0) return;
    
    const currentIndex = message.currentRetryIndex ?? 0;
    const totalVersions = message.retryVersions.length + 1; // +1 for original
    
    let newIndex = currentIndex;
    if (direction === 'prev') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(totalVersions - 1, currentIndex + 1);
    }
    
    updateMessageAt(messageIndex, { currentRetryIndex: newIndex });
  };

  // Get current displayed content for a message (handles retry versions)
  const getDisplayedContent = (message: any) => {
    if (message.type !== 'ai' || !message.retryVersions || message.retryVersions.length === 0) {
      return message.content;
    }
    
    const currentIndex = message.currentRetryIndex ?? 0;
    if (currentIndex === 0) {
      return message.content;
    }
    
    // Ensure currentIndex is valid
    if (currentIndex > 0 && currentIndex <= message.retryVersions.length) {
      const retryVersion = message.retryVersions[currentIndex - 1];
      return retryVersion?.content || message.content;
    }
    
    return message.content;
  };

  // Get current displayed citations for a message (handles retry versions)
  const getDisplayedCitations = (message: any) => {
    if (message.type !== 'ai' || !message.retryVersions || message.retryVersions.length === 0) {
      return message.citations;
    }
    
    const currentIndex = message.currentRetryIndex ?? 0;
    if (currentIndex === 0) {
      return message.citations;
    }
    
    const retryVersion = message.retryVersions[currentIndex - 1];
    return retryVersion?.citations || message.citations;
  };

  // Close retry dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (retryDropdownRef.current && !retryDropdownRef.current.contains(event.target as Node)) {
        setRetryDropdownOpen(null);
        setRetryCustomPrompt('');
      }
    };

    if (retryDropdownOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [retryDropdownOpen]);

  const handleMessageShare = async (messageIndex: number) => {
    if (!currentConversationId || !user) return;
    
    setIsGeneratingMessageShareLink(true);
    
    try {
      const response = await fetch('/api/message-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTTS = async (text: string, messageId: string) => {
    // If this audio is already playing, stop it
    if (playingAudioId === messageId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingAudioId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      // Generate TTS audio
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // Try to get error message from response
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

      // Verify response is actually audio
      if (contentType && !contentType.startsWith('audio/')) {
        // Response might be an error JSON even if status is ok
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid response format');
        } catch (jsonError) {
          throw new Error('Invalid response format: expected audio, got ' + contentType);
        }
      }

      // Create audio blob and play it
      const audioBlob = await response.blob();
      
      // Verify blob is not empty
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio file');
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingAudioId(messageId);

      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error: any) {
      console.error('Failed to play audio:', error);
      console.error('Error details:', error.message || error);
      setPlayingAudioId(null);
      // Optionally show error to user
      // setError(error.message || 'Failed to generate audio');
    }
  };

  const handleToggleImageMode = () => {
    if (imageGenerationMode) {
      // Turn off image mode
      setImageGenerationMode(false);
      setMode('default');
    } else {
      // Turn on image mode, turn off web search
      setImageGenerationMode(true);
      setMode('default');
      setWebSearchMode('off');
      setShowWebSearchDropdown(false);
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename?: string) => {
    try {
      // Generate unique filename with timestamp and random string
      const generateUniqueFilename = (prefix: string = 'image') => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${timestamp}-${randomStr}`;
      };

      // If it's a data URL, convert to blob
      if (imageUrl.startsWith('data:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const uniqueFilename = filename 
          ? (filename.includes('.') ? filename : `${generateUniqueFilename(filename)}.png`)
          : `${generateUniqueFilename()}.png`;
        a.download = uniqueFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // For regular URLs, fetch and download
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const urlParts = imageUrl.split('/');
        const originalFilename = urlParts[urlParts.length - 1].split('?')[0];
        // Use original filename if it exists and has extension, otherwise generate unique name
        const uniqueFilename = (originalFilename && originalFilename.includes('.'))
          ? originalFilename
          : (filename 
              ? `${generateUniqueFilename(filename)}.png`
              : `${generateUniqueFilename()}.png`);
        a.download = uniqueFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const handleStartEditImage = (index: number) => {
    setImageEditRemixMode('edit');
    setSelectedImageIndex(index);
    setImageMenuOpen(null);
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
    setImageMenuOpen(null);
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

  const handleImageEditRemix = async (instruction: string) => {
    if (!imageEditRemixMode || selectedImageIndex === null || !instruction.trim()) return;

    const imageToProcess = attachedImages[selectedImageIndex];
    if (!imageToProcess) {
      setError('Image not found');
      return;
    }

    // Start conversation to ensure UI is visible
    startConversation();

    // Capture index and mode before clearing state
    const imageIndex = selectedImageIndex;
    const mode = imageEditRemixMode;
    const trimmedInstruction = instruction.trim();

    // Add user message with instruction
    const userMessage = `${mode === 'edit' ? 'Edit' : 'Remix'} image: ${trimmedInstruction}`;
    addUserMessage(userMessage, [imageToProcess]);

    // Clear edit/remix mode
    setImageEditRemixMode(null);
    setSelectedImageIndex(null);
    setSearchQuery('');

    // Set generating state and progress
    setIsGeneratingImage(true);
    setImageGenerationProgress(0);

    // Add a placeholder AI message for the generation status
    addAIMessage('', [], undefined, userMessage, [imageToProcess], 'image');

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setImageGenerationProgress(prev => {
        if (prev >= 90) return prev; // Stop at 90% until actual completion
        return prev + Math.random() * 15;
      });
    }, 500);
    progressIntervalRef.current = progressInterval;

    try {
      const endpoint = mode === 'edit' ? '/api/edit-image' : '/api/remix-image';
      const body = mode === 'edit' 
        ? { editInstruction: trimmedInstruction, referenceImage: imageToProcess }
        : { prompt: trimmedInstruction, referenceImages: [imageToProcess] };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} image`);
      }

      const data = await response.json();
      
      // Complete progress
      setImageGenerationProgress(100);

      if (data.imageUrl) {
        // Update the last AI message with the generated image
        setTimeout(() => {
          updateLastAIMessage(`Image ${mode === 'edit' ? 'edited' : 'remixed'} successfully!`, [data.imageUrl]);
          setIsGeneratingImage(false);
          setImageGenerationProgress(0);
          if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
          
          // Remove the original image from attached images (only for edit)
          if (mode === 'edit') {
            setAttachedImages(prev => {
              const newImages = [...prev];
              newImages.splice(imageIndex, 1);
              return newImages;
            });
          }
        }, 300);
      }
    } catch (err: any) {
      console.error(`Failed to ${mode} image:`, err);
      setError(err.message || `Failed to ${mode} image`);
      setIsGeneratingImage(false);
      setImageGenerationProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Remove the placeholder AI message on error
      removeMessage(conversationHistory.length - 1);
    }
  };

  // Fetch daily prompts
  useEffect(() => {
    const fetchDailyPrompts = async () => {
      try {
        const response = await fetch('/api/daily-prompts');
        if (response.ok) {
          const data = await response.json();
          setDailyPrompts(data.prompts || []);
        }
      } catch (error) {
        console.error('Error fetching daily prompts:', error);
      }
    };
    fetchDailyPrompts();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (imageMenuOpen !== null) {
        if (!target.closest('.image-menu-container')) {
          setImageMenuOpen(null);
        }
      }
      
      if (imageIconDropdownOpen) {
        if (!target.closest('.image-icon-dropdown-container')) {
          setImageIconDropdownOpen(false);
        }
      }
    };

    if (imageMenuOpen !== null || imageIconDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [imageMenuOpen, imageIconDropdownOpen]);

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
        suggestionSelectedRef.current = true;
        setSearchQuery(chosen);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        setSuggestions([]); // Clear suggestions after selection
        // Reset flag after a short delay to allow new typing to fetch suggestions
        setTimeout(() => { suggestionSelectedRef.current = false; }, 300);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Detect mobile viewport for placeholder tone
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('humblai-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Apply theme changes and save to localStorage
  useEffect(() => {
    localStorage.setItem('humblai-theme', theme);
  }, [theme]);

  // Check if onboarding should be shown on first visit
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('humbl_onboarding_completed');
    if (!onboardingCompleted) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
    }
  }, []);

  const placeholderText = imageEditRemixMode === 'edit' 
    ? 'Describe how to edit the image (e.g., "Remove all people from the background")'
    : imageEditRemixMode === 'remix'
    ? 'Describe how to remix the image (e.g., "Create a fantasy version with magical elements")'
    : (isMobile ? 'Ask anything… everything ✨' : 'Ask Anything, I mean everything...');

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
    // small delay to allow keyboard animation to begin
    setTimeout(doScroll, 50);
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
    // Don't fetch if a suggestion was just selected
    if (suggestionSelectedRef.current) {
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

  // Smoothly scroll to beginning of response immediately after user sends query
  useEffect(() => {
    if (!conversationStarted || !isLoading) return;
    
    const container = conversationScrollRef.current;
    if (!container) return;

    // Wait for response start marker to appear, then scroll
    const scrollToResponseStart = () => {
      const target = responseStartRef.current;
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + container.scrollTop - 8;
        
        try {
          container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        } catch {
          container.scrollTop = Math.max(0, offset);
        }
        return true;
      }
      return false;
    };

    // Try immediately
    requestAnimationFrame(() => {
      if (!scrollToResponseStart()) {
        // If marker not ready, try again after a short delay
        setTimeout(() => {
          scrollToResponseStart();
        }, 150);
      }
    });
  }, [conversationHistory.length, isLoading, conversationStarted]);

  // Detect scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    if (!conversationStarted) return;
    const container = conversationScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => container.removeEventListener('scroll', handleScroll);
  }, [conversationStarted, conversationHistory, streamingResponse]);

  const scrollToBottom = () => {
    const container = conversationScrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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

  // SoundWave visualization for recording state
  const SoundWave = ({ bars = 80 }: { bars?: number }) => {
    const items = Array.from({ length: bars });
    return (
      <div className="sound-wave flex items-end justify-center h-6">
        {items.map((_, i) => (
          <div
            key={i}
            className="bar"
            style={{ animationDuration: `${(Math.random() * 0.5 + 0.2).toFixed(2)}s` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col transition-colors duration-300" data-theme={theme} style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
      {/* Header Bar with New Conversation button */}
      <div className="w-full transition-colors duration-300" style={{ borderBottom: 'none' }}>
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

            {/* Right: Share button (only when conversation is active and user is logged in) OR Login button (when not logged in) */}
            {conversationStarted && currentConversationId && user ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    if (currentConversationId) {
                      setIsGeneratingShareLink(true);
                      // Small delay for UX consistency
                      await new Promise(resolve => setTimeout(resolve, 500));
                      setIsGeneratingShareLink(false);
                      setShowShareModal(true);
                    }
                  }}
                  className="p-2 rounded-lg transition-colors duration-300"
                  style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)'}
                  title="Share conversation"
                >
                  <Image src="/share.png" alt="Share" width={18} height={18} style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' }} />
                </button>
                <span className={`text-sm hidden sm:inline transition-colors duration-300 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Share</span>
                
                {/* Three dots menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowConversationMenu(!showConversationMenu)}
                    className="p-2 rounded-lg transition-colors duration-300"
                    style={{ backgroundColor: '#f1d08c' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8c377'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1d08c'}
                    title="More options"
                  >
                    <MoreVertical size={18} className="text-black" />
                  </button>

                  {showConversationMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowConversationMenu(false)}
                      />
                      <div
                        className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden z-50"
                        style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}` }}
                      >
                        <button
                          onClick={() => {
                            setShowMoveToFolderModal(true);
                            setShowConversationMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left transition-colors duration-200 flex items-center gap-3"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Folder size={16} />
                          <span>Move to Project</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowArchiveModal(true);
                            setShowConversationMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left transition-colors duration-200 flex items-center gap-3"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Archive size={16} />
                          <span>Archive</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : !user ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/handler/login')}
                  className="px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105"
                  style={{ backgroundColor: '#f1d08c', color: '#000000' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8c377'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1d08c'}
                  title="Login to save conversations"
                >
                  Login
                </button>
              </div>
            ) : null}

          </div>
        </div>
      </div>

      {/* Info Modal */}
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
                        className="inline-flex items-center px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        style={{ backgroundColor: '#0A66C2', color: '#ffffff' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0956A3')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0A66C2')}
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

      {/* Share Modal */}
      {showShareModal && currentConversationId && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <div
              className="relative rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden hidden md:flex flex-col"
              style={{
                backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}>
                <h3 className="text-xl font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                  {conversationHistory.length > 0 && conversationHistory[0].originalQuery 
                    ? conversationHistory[0].originalQuery.length > 50 
                      ? conversationHistory[0].originalQuery.substring(0, 50) + '...'
                      : conversationHistory[0].originalQuery
                    : 'Share Conversation'}
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 rounded-lg transition-all hover:scale-110"
                  style={{
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Conversation Preview */}
              <div className="flex-1 overflow-y-auto share-modal-scroll px-6 py-4" style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb' }}>
                <div className="space-y-4 max-h-[400px]">
                  {conversationHistory.slice(0, 4).map((message, index) => (
                    <div key={index} className="flex flex-col">
                      {message.type === 'user' && (
                        <div className="flex justify-end mb-2">
                          <div 
                            className="max-w-[80%] rounded-2xl px-4 py-2.5"
                            style={{ 
                              backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb',
                              color: theme === 'dark' ? '#ffffff' : '#111827'
                            }}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.originalQuery || message.content}</p>
                          </div>
                        </div>
                      )}
                      {message.type === 'ai' && message.content && (
                        <div className="flex justify-start mb-2">
                          <div 
                            className="max-w-[80%] rounded-2xl px-4 py-2.5"
                            style={{ 
                              backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                              color: theme === 'dark' ? '#e5e7eb' : '#111827',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                              {message.content.length > 300 ? message.content.substring(0, 300) + '...' : message.content}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Watermark */}
                  <div className="relative mt-4">
                    <div className="absolute bottom-2 right-2 opacity-20">
                      <span className="text-xs font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>Humbl AI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sharing Options Footer */}
              <div className="px-6 py-5 border-t" style={{ borderColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}>
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  {/* Copy Link */}
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        const toast = document.createElement('div');
                        toast.textContent = 'Copied';
                        toast.style.cssText = `
                          position: fixed;
                          top: 20px;
                          left: 50%;
                          transform: translateX(-50%);
                          background: #22c55e;
                          color: #ffffff;
                          padding: 12px 24px;
                          border-radius: 8px;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                          z-index: 9999;
                          font-size: 14px;
                          font-weight: 500;
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
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Copy link"
                  >
                    <CopyIcon size={24} style={{ color: theme === 'dark' ? '#ffffff' : '#111827', marginBottom: '6px' }} />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Copy link</span>
                  </button>

                  {/* X (formerly Twitter) */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on X"
                  >
                    <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="X" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>X</span>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on Facebook"
                  >
                    <img src="https://www.facebook.com/images/fb_icon_325x325.png" alt="Facebook" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Facebook</span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on LinkedIn"
                  >
                    <img src="https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca" alt="LinkedIn" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>LinkedIn</span>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on WhatsApp"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6 mb-1.5" onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://commons.wikimedia.org/wiki/Special:FilePath/WhatsApp.svg';
                    }} />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>WhatsApp</span>
                  </button>

                  {/* Telegram */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
                      setShowShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on Telegram"
                  >
                    <img src="https://web.telegram.org/a/icon-192x192.png" alt="Telegram" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Telegram</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Share Modal - Keep original design */}
            <div
              className="relative rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto share-modal-scroll md:hidden"
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
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
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
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
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
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
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
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
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
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on WhatsApp"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-10 h-10 mb-1.5" onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://commons.wikimedia.org/wiki/Special:FilePath/WhatsApp.svg';
                  }} />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>WhatsApp</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
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
                    const shareUrl = `${window.location.origin}/c/${currentConversationId}`;
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

      {/* Message Share Modal */}
      {showMessageShareModal && messageShareId && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMessageShareModal(false)}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            {/* Desktop Message Share Modal */}
            <div
              className="relative rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden hidden md:flex flex-col"
              style={{
                backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}>
                <h3 className="text-xl font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                  {sharedMessageIndex !== null && conversationHistory[sharedMessageIndex]?.content
                    ? conversationHistory[sharedMessageIndex].content.substring(0, 50) + (conversationHistory[sharedMessageIndex].content.length > 50 ? '...' : '')
                    : 'Share Message'}
                </h3>
                <button
                  onClick={() => setShowMessageShareModal(false)}
                  className="p-2 rounded-lg transition-all hover:scale-110"
                  style={{
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Message Preview */}
              <div className="flex-1 overflow-y-auto share-modal-scroll px-6 py-4" style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb' }}>
                <div className="space-y-4 max-h-[400px]">
                  {sharedMessageIndex !== null && conversationHistory[sharedMessageIndex] && (
                    <div className="flex flex-col">
                      {conversationHistory[sharedMessageIndex].type === 'user' && conversationHistory[sharedMessageIndex - 1] && (
                        <div className="flex justify-end mb-2">
                          <div 
                            className="max-w-[80%] rounded-2xl px-4 py-2.5"
                            style={{ 
                              backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb',
                              color: theme === 'dark' ? '#ffffff' : '#111827'
                            }}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{conversationHistory[sharedMessageIndex - 1].originalQuery || conversationHistory[sharedMessageIndex - 1].content}</p>
                          </div>
                        </div>
                      )}
                      {conversationHistory[sharedMessageIndex].type === 'ai' && conversationHistory[sharedMessageIndex].content && (
                        <div className="flex justify-start mb-2">
                          <div 
                            className="max-w-[80%] rounded-2xl px-4 py-2.5"
                            style={{ 
                              backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                              color: theme === 'dark' ? '#e5e7eb' : '#111827',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                              {conversationHistory[sharedMessageIndex].content.length > 300 ? conversationHistory[sharedMessageIndex].content.substring(0, 300) + '...' : conversationHistory[sharedMessageIndex].content}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Watermark */}
                  <div className="relative mt-4">
                    <div className="absolute bottom-2 right-2 opacity-20">
                      <span className="text-xs font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>Humbl AI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sharing Options Footer */}
              <div className="px-6 py-5 border-t" style={{ borderColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}>
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  {/* Copy Link */}
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        const toast = document.createElement('div');
                        toast.textContent = 'Copied';
                        toast.style.cssText = `
                          position: fixed;
                          top: 20px;
                          left: 50%;
                          transform: translateX(-50%);
                          background: #22c55e;
                          color: #ffffff;
                          padding: 12px 24px;
                          border-radius: 8px;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                          z-index: 9999;
                          font-size: 14px;
                          font-weight: 500;
                        `;
                        document.body.appendChild(toast);
                        setTimeout(() => {
                          toast.style.opacity = '0';
                          toast.style.transition = 'opacity 0.3s';
                          setTimeout(() => document.body.removeChild(toast), 300);
                        }, 2000);
                        setShowMessageShareModal(false);
                      } catch (err) {
                        prompt('Copy this link:', shareUrl);
                      }
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Copy link"
                  >
                    <CopyIcon size={24} style={{ color: theme === 'dark' ? '#ffffff' : '#111827', marginBottom: '6px' }} />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Copy link</span>
                  </button>

                  {/* X (formerly Twitter) */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowMessageShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on X"
                  >
                    <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="X" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>X</span>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowMessageShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on Facebook"
                  >
                    <img src="https://www.facebook.com/images/fb_icon_325x325.png" alt="Facebook" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Facebook</span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowMessageShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on LinkedIn"
                  >
                    <img src="https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca" alt="LinkedIn" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>LinkedIn</span>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`, '_blank');
                      setShowMessageShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on WhatsApp"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6 mb-1.5" onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://commons.wikimedia.org/wiki/Special:FilePath/WhatsApp.svg';
                    }} />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>WhatsApp</span>
                  </button>

                  {/* Telegram */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                      const text = encodeURIComponent('Check out this conversation!');
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
                      setShowMessageShareModal(false);
                    }}
                    className="flex flex-col items-center justify-center transition-all hover:scale-105"
                    title="Share on Telegram"
                  >
                    <img src="https://web.telegram.org/a/icon-192x192.png" alt="Telegram" className="w-6 h-6 mb-1.5" />
                    <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Telegram</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Message Share Modal */}
            <div
              className="relative rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto share-modal-scroll md:hidden"
              style={{
                backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base sm:text-lg font-semibold" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  Share Message
                </h3>
                <button
                  onClick={() => setShowMessageShareModal(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 mb-4 share-modal-horizontal-scroll">
                {/* Copy Link */}
                <button
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
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
                      setShowMessageShareModal(false);
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

                {/* Social media buttons - same as desktop but in horizontal scroll */}
                {/* X, Facebook, LinkedIn, WhatsApp, Telegram */}
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowMessageShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on X"
                >
                  <img src="https://abs.twimg.com/favicons/twitter.3.ico" alt="X" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>X</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowMessageShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on Facebook"
                >
                  <img src="https://www.facebook.com/images/fb_icon_325x325.png" alt="Facebook" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>Facebook</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowMessageShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on LinkedIn"
                >
                  <img src="https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca" alt="LinkedIn" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>LinkedIn</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`, '_blank');
                    setShowMessageShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on WhatsApp"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-10 h-10 mb-1.5" onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://commons.wikimedia.org/wiki/Special:FilePath/WhatsApp.svg';
                  }} />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>WhatsApp</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${messageShareId}`;
                    const text = encodeURIComponent('Check out this conversation!');
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
                    setShowMessageShareModal(false);
                  }}
                  className="flex flex-col items-center justify-center min-w-[60px] transition-opacity hover:opacity-80"
                  title="Share on Telegram"
                >
                  <img src="https://web.telegram.org/a/icon-192x192.png" alt="Telegram" className="w-10 h-10 mb-1.5" />
                  <span className="text-xs" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>Telegram</span>
                </button>
              </div>
            </div>
          </div>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMessageShareModal(false)}
          />
        </>
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
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
      />

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding
          theme={theme}
          onClose={() => setShowOnboarding(false)}
        />
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

          {/* Prompt Suggestions */}
          {dailyPrompts.length > 0 && (
            <div className="w-full max-w-xl lg:max-w-3xl mx-auto mb-4 sm:mb-6 relative">
              {/* Fade gradients */}
              <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 z-10 pointer-events-none" style={{
                background: `linear-gradient(to right, ${theme === 'dark' ? '#151514' : '#ffffff'}, transparent)`
              }} />
              <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 z-10 pointer-events-none" style={{
                background: `linear-gradient(to left, ${theme === 'dark' ? '#151514' : '#ffffff'}, transparent)`
              }} />
              
              {/* Scrollable container */}
              <div className="overflow-x-auto scrollbar-hide" style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                maskImage: `linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)`,
                WebkitMaskImage: `linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)`
              }}>
                <div className="flex gap-2 sm:gap-3 px-4 animate-scroll" style={{
                  animation: 'scroll 30s linear infinite',
                  width: 'max-content'
                }}>
                  {/* Duplicate prompts for seamless loop */}
                  {[...dailyPrompts, ...dailyPrompts].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const cleanPrompt = prompt.replace(/[✨💡🎨🍕🌍🤖🎵📚🏃🧪🎬🍀🌈🐾🌊🎯🍯⚡🎭🌱🧠🎪🏔️🌙🦋]/g, '').trim();
                        setSearchQuery(cleanPrompt);
                        handleSearch();
                      }}
                      className="flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 whitespace-nowrap"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                        color: theme === 'dark' ? '#e5e7eb' : '#111827',
                        fontSize: '0.7rem',
                        boxShadow: theme === 'dark' 
                          ? '0 2px 8px rgba(0, 0, 0, 0.2)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' 
                          ? 'rgba(255, 255, 255, 0.12)' 
                          : 'rgba(0, 0, 0, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.04)';
                      }}
                    >
                      <span className="text-[0.65rem] sm:text-xs">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div ref={initialSearchRef} className="w-full max-w-xl lg:max-w-3xl mx-auto mb-6 sm:mb-8">
            <div className="relative">
              <div className="relative overflow-visible flex flex-col rounded-2xl px-3 pt-3 pb-12 sm:px-6 sm:pt-4 sm:pb-14 shadow-lg transition-colors duration-300" style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f9fafb', border: '1px solid #f1d08c' }}>
                {/* Full-bar waveform background */}
                {isRecording && (
                  <canvas
                    ref={waveCanvasRef}
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
                  />
                )}
                
                {/* Attached images preview - flows at top */}
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
                        {imageGenerationMode && (
                          <div className="absolute bottom-0 left-0 image-menu-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageMenuOpen(imageMenuOpen === idx ? null : idx);
                              }}
                              className="p-1 rounded-full transition-all z-10 opacity-0 group-hover:opacity-100"
                              style={{ backgroundColor: '#f1d08c' }}
                              title="Image options"
                            >
                              <MoreVertical size={10} className="text-black" />
                            </button>
                            {imageMenuOpen === idx && (
                              <div className="absolute bottom-full left-0 mb-1 rounded-lg shadow-lg overflow-hidden z-20" style={{ backgroundColor: '#1f1f1f', border: '1px solid #3a3a39' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditImage(idx);
                                  }}
                                  className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                  <Edit2 size={12} />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRemixImage(idx);
                                  }}
                                  className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                  <ImageIcon size={12} />
                                  Remix
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Field */}
                <div className="flex items-start gap-2">
                {/* Edit/Remix Mode Indicator */}
                {imageEditRemixMode && selectedImageIndex !== null && attachedImages[selectedImageIndex] && (
                  <div className="flex items-center gap-2 mr-2">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#f1d08c', color: '#000000' }}>
                      {imageEditRemixMode === 'edit' ? 'Edit' : 'Remix'} Image
                    </div>
                    <button
                      onClick={handleCancelImageEditRemix}
                      className="p-1.5 rounded-full hover:bg-gray-700/50 transition-colors"
                      title="Cancel"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                )}
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                    onFocus={() => { 
                    if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); 
                    scrollBarAboveKeyboard(initialSearchRef.current); 
                  }}
                    onBlur={(e) => {
                      setTimeout(() => setShowSuggestions(false), 120);
                      // Clean up viewport listeners when input loses focus
                      const el = initialSearchRef.current;
                      if (el && (el as any)._keyboardCleanup) {
                        (el as any)._keyboardCleanup();
                        (el as any)._keyboardCleanup = null;
                      }
                    }}
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

                {/* Suggestions dropdown (desktop top bar) */}
                {!conversationStarted && showSuggestions && suggestions.length > 0 && (
                  <div className={`absolute left-3 right-3 top-full mt-0 rounded-b-2xl backdrop-blur-sm z-20 max-h-64 overflow-auto humbl-suggest transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1f1f1f]/95' : 'bg-white/95'}`}>
                    {suggestions.map((s, i) => (
                          <button
                        key={i}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-300 ${theme === 'dark' ? 'border-t border-gray-800/60' : 'border-t border-gray-200/60'} ${i === activeSuggestionIndex ? (theme === 'dark' ? 'bg-[#2a2a29] text-white' : 'bg-gray-100 text-black') : (theme === 'dark' ? 'text-gray-300 hover:bg-[#2a2a29]' : 'text-black hover:bg-gray-100')}`}
                        onMouseDown={(e) => { 
                          e.preventDefault(); 
                          suggestionSelectedRef.current = true;
                          setSearchQuery(s); 
                          setShowSuggestions(false); 
                          setActiveSuggestionIndex(-1); 
                          setSuggestions([]);
                          // Reset flag after a short delay to allow new typing to fetch suggestions
                          setTimeout(() => { suggestionSelectedRef.current = false; }, 300);
                        }}
                      >
                        {s}
                          </button>
                      ))}
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
                      disabled={attachedImages.length >= 3}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#2a2a29' }}
                      title="Attach images"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImagesSelected} className="hidden" />

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
                  {/* Desktop/tablet: center absolute */}
                  {isRecording && (
                    <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-1 pointer-events-none">
                      <SoundWave bars={80} />
                    </div>
                  )}
                  {/* Mobile: place waveform between left and right groups */}
                  <div className="sm:hidden flex-1 flex justify-center pointer-events-none">
                    {isRecording && (
                      <div className="w-28">
                        <SoundWave bars={36} />
                      </div>
                    )}
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
                        onClick={() => isLoading ? stopStreaming() : handleSearch()}
                      disabled={!isLoading && (!searchQuery.trim() && attachedImages.length === 0)}
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
            {/* Disclaimer */}
            <p className="text-center mt-2 text-xs text-gray-500/60">
              AI can make mistakes, kindly fact check if possible.
            </p>
          </div>
        </div>
      )}

      {/* Conversation Area - Only show when conversation has started */}
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
                                  handleDownloadImage(src, 'attachment');
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
                      {/* Image Generation Status */}
                      {isGeneratingImage && index === conversationHistory.length - 1 && !message.content && message.images?.length === 0 ? (
                        <div className="max-w-[85%] rounded-2xl px-4 py-3"
                          style={{ backgroundColor: '#2a2a29', border: '1px solid #3a3a39' }}>
                          <div className="text-white mb-3">Generating an image please wait</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.max(2, Math.min(100, imageGenerationProgress))}%`, 
                                background: 'linear-gradient(90deg, #f1d08c, #d4b86a)' 
                              }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-gray-400">{Math.round(imageGenerationProgress)}% complete</div>
                        </div>
                      ) : (
                        <>
                          {/* Generated images for AI */}
                          {message.images && message.images.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-3">
                              {message.images.map((src, idx) => (
                                <div key={idx} className="relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-lg bg-black max-w-full group">
                                  <img src={src} alt={`generated-image-${idx+1}`} className="max-w-xs sm:max-w-md lg:max-w-lg h-auto object-contain" />
                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadImage(src, 'generated');
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
                          {/* Show streaming response during retry, otherwise show regular content */}
                          {streamingResponse && retryStateRef.current && retryStateRef.current.messageIndex === index ? (
                            <>
                              <ResponseRenderer content={streamingResponse} isLoading={isLoading} theme={theme} />
                              {isLoading && (
                                <div className="flex items-center space-x-2 mt-2 text-gray-300">
                                  <PendulumDots />
                                  <span className="text-sm animate-pulse">Generating...</span>
                                </div>
                              )}
                            </>
                          ) : (
                            message.content && <ResponseRenderer key={`${index}-${message.currentRetryIndex ?? 0}`} content={getDisplayedContent(message)} theme={theme} />
                          )}
                        </>
                      )}
                      {/* Action buttons for AI responses - Only show when not streaming a retry for this message */}
                      {message.type === 'ai' && !(streamingResponse && retryStateRef.current && retryStateRef.current.messageIndex === index) && (
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                      {/* Version Navigation - Show if retry versions exist */}
                      {message.retryVersions && message.retryVersions.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)' }}>
                          <button
                            onClick={() => handleRetryVersionChange(index, 'prev')}
                            disabled={(message.currentRetryIndex ?? 0) === 0}
                            className="p-0.5 rounded hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Previous version"
                          >
                            <ChevronLeft size={14} className="text-gray-400" />
                          </button>
                          <span className="text-xs text-gray-400 px-1">
                            {((message.currentRetryIndex ?? 0) + 1)}/{message.retryVersions.length + 1}
                          </span>
                          <button
                            onClick={() => handleRetryVersionChange(index, 'next')}
                            disabled={(message.currentRetryIndex ?? 0) >= message.retryVersions.length}
                            className="p-0.5 rounded hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Next version"
                          >
                            <ChevronRight size={14} className="text-gray-400" />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => handleCopy(getDisplayedContent(message))}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        <CopyIcon size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                      {/* Retry button with dropdown - Show for all AI messages */}
                      <div className="relative" ref={retryDropdownOpen === index ? retryDropdownRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRetryDropdownOpen(retryDropdownOpen === index ? null : index);
                          }}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                          title="Retry response"
                        >
                          <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        </button>
                        {/* Retry Dropdown Menu */}
                        {retryDropdownOpen === index && (
                          <div
                            className="absolute bottom-full left-0 mb-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden"
                            style={{
                              backgroundColor: theme === 'dark' ? '#2a2a29' : '#ffffff',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            {/* Custom prompt input */}
                            <div className="px-3 py-2 border-b" style={{ borderColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Ask to change response"
                                  value={retryCustomPrompt}
                                  onChange={(e) => setRetryCustomPrompt(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && retryCustomPrompt.trim()) {
                                      handleRetry(message, index, 'custom', retryCustomPrompt.trim());
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 pr-8 rounded-lg text-sm border-none outline-none"
                                  style={{
                                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (retryCustomPrompt.trim()) {
                                      handleRetry(message, index, 'custom', retryCustomPrompt.trim());
                                    }
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-700/50 transition-colors"
                                  disabled={!retryCustomPrompt.trim()}
                                >
                                  <ArrowUp size={14} className="text-gray-400" />
                                </button>
                              </div>
                            </div>
                            {/* Retry options */}
                            <div className="py-1">
                              <button
                                onClick={() => handleRetry(message, index, 'try-again')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors text-left"
                                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              >
                                <RefreshCw size={16} className="text-gray-400" />
                                <span>Try again</span>
                              </button>
                              <button
                                onClick={() => handleRetry(message, index, 'add-details')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors text-left"
                                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              >
                                <Maximize2 size={16} className="text-gray-400" />
                                <span>Add details</span>
                              </button>
                              <button
                                onClick={() => handleRetry(message, index, 'more-concise')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors text-left"
                                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              >
                                <Minimize2 size={16} className="text-gray-400" />
                                <span>More concise</span>
                              </button>
                              <button
                                onClick={() => handleRetry(message, index, 'search-web')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors text-left"
                                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              >
                                <Globe size={16} className="text-gray-400" />
                                <span>Search the web</span>
                              </button>
                              <button
                                onClick={() => handleRetry(message, index, 'think-longer')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors text-left"
                                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              >
                                <Lightbulb size={16} className="text-gray-400" />
                                <span>Think longer</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleVote(index, 'up')}
                        className={`p-1.5 sm:p-2 rounded-full transition-all active:scale-95 ${votesByIndex[index] === 'up' ? 'bg-emerald-500/15' : 'hover:bg-gray-700/50 active:bg-gray-700'}`}
                        title="Upvote"
                      >
                        <ThumbsUp size={16} className={`sm:w-[18px] sm:h-[18px] ${votesByIndex[index] === 'up' ? 'text-emerald-400' : 'text-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => handleVote(index, 'down')}
                        className={`p-1.5 sm:p-2 rounded-full transition-all active:scale-95 ${votesByIndex[index] === 'down' ? 'bg-rose-500/15' : 'hover:bg-gray-700/50 active:bg-gray-700'}`}
                        title="Downvote"
                      >
                        <ThumbsDown size={16} className={`sm:w-[18px] sm:h-[18px] ${votesByIndex[index] === 'down' ? 'text-rose-400' : 'text-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => handleTTS(getDisplayedContent(message), `msg-${index}`)}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title={playingAudioId === `msg-${index}` ? "Stop audio" : "Play audio"}
                      >
                        {playingAudioId === `msg-${index}` ? (
                          <VolumeX size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        ) : (
                          <Volume2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                        )}
                      </button>
                      {message.type === 'ai' && user && (
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
                      {getDisplayedCitations(message) && getDisplayedCitations(message)!.length > 0 && (
                        <div className="mt-3 border-t border-gray-800/60 pt-2">
                          <details>
                            <summary className="text-xs text-gray-400 cursor-pointer">Sources</summary>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {getDisplayedCitations(message)!.map((c:any, i:number) => (
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

              {/* Streaming Response - Only show for NEW messages (not retries) */}
              {streamingResponse && !retryStateRef.current && (
                <div className="w-full">
                  <div ref={responseStartRef} />
                  <ResponseRenderer content={streamingResponse} isLoading={isLoading} theme={theme} />
                  {isLoading && (
                    <div className="flex items-center space-x-2 mt-2 text-gray-300">
                      <PendulumDots />
                      <span className="text-sm animate-pulse">Generating...</span>
                    </div>
                  )}
                  {/* Action buttons for streaming response */}
                  {!isLoading && (
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                    <button
                      onClick={() => handleCopy(streamingResponse)}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                      title="Copy response"
                    >
                      <CopyIcon size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleVote(conversationHistory.length - 1, 'up')}
                      className={`p-1.5 sm:p-2 rounded-full transition-all active:scale-95 ${votesByIndex[conversationHistory.length - 1] === 'up' ? 'bg-emerald-500/15' : 'hover:bg-gray-700/50 active:bg-gray-700'}`}
                      title="Upvote"
                    >
                      <ThumbsUp size={16} className={`sm:w-[18px] sm:h-[18px] ${votesByIndex[conversationHistory.length - 1] === 'up' ? 'text-emerald-400' : 'text-gray-400'}`} />
                    </button>
                    <button
                      onClick={() => handleVote(conversationHistory.length - 1, 'down')}
                      className={`p-1.5 sm:p-2 rounded-full transition-all active:scale-95 ${votesByIndex[conversationHistory.length - 1] === 'down' ? 'bg-rose-500/15' : 'hover:bg-gray-700/50 active:bg-gray-700'}`}
                      title="Downvote"
                    >
                      <ThumbsDown size={16} className={`sm:w-[18px] sm:h-[18px] ${votesByIndex[conversationHistory.length - 1] === 'down' ? 'text-rose-400' : 'text-gray-400'}`} />
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
                    {user && (
                      <button
                        onClick={() => handleMessageShare(conversationHistory.length - 1)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-700/50 active:bg-gray-700 transition-colors"
                        title="Share this message"
                      >
                        <Share2 size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400" />
                      </button>
                    )}
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
        </div>
      )}

      {/* Search Bar - Only show when conversation has started */}
      {conversationStarted && (
        <div className="w-full px-4 pb-4" ref={conversationBarRef}>
          <div className="max-w-xl lg:max-w-3xl mx-auto">
            <div className="relative">
              {/* Scroll to bottom button */}
              {showScrollToBottom && (
                <button
                  onClick={scrollToBottom}
                  className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all opacity-100 border-2 bg-transparent hover:bg-[#f1d08c]/10 hover:scale-110 z-10"
                  style={{ borderColor: '#f1d08c', backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}
                  title="Scroll to bottom"
                >
                  <ChevronDown size={20} className="text-[#f1d08c]" strokeWidth={2} />
                </button>
              )}
              <div className="relative overflow-visible flex flex-col rounded-2xl px-4 pt-4 pb-12 shadow-lg transition-colors duration-300" style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f9fafb', border: '1px solid #f1d08c' }}>
                {/* Full-bar waveform background */}
                {isRecording && (
                  <canvas
                    ref={waveCanvasRef}
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
                  />
                )}
                
                {/* Attached images preview - flows at top */}
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
                        {imageGenerationMode && (
                          <div className="absolute bottom-0 left-0 image-menu-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageMenuOpen(imageMenuOpen === idx ? null : idx);
                              }}
                              className="p-1 rounded-full transition-all z-10 opacity-0 group-hover:opacity-100"
                              style={{ backgroundColor: '#f1d08c' }}
                              title="Image options"
                            >
                              <MoreVertical size={10} className="text-black" />
                            </button>
                            {imageMenuOpen === idx && (
                              <div className="absolute bottom-full left-0 mb-1 rounded-lg shadow-lg overflow-hidden z-20" style={{ backgroundColor: '#1f1f1f', border: '1px solid #3a3a39' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditImage(idx);
                                  }}
                                  className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                  <Edit2 size={12} />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRemixImage(idx);
                                  }}
                                  className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                  <ImageIcon size={12} />
                                  Remix
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
                    onFocus={() => { 
                      // Always scroll input bar above keyboard on mobile
                      scrollBarAboveKeyboard(conversationBarRef.current as HTMLElement);
                      // Show suggestions only if conversation hasn't started
                      if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); 
                    }}
                    onBlur={(e) => {
                      setTimeout(() => setShowSuggestions(false), 120);
                      // Clean up viewport listeners when input loses focus
                      const el = conversationBarRef.current as HTMLElement;
                      if (el && (el as any)._keyboardCleanup) {
                        (el as any)._keyboardCleanup();
                        (el as any)._keyboardCleanup = null;
                      }
                    }}
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

                {/* Suggestions dropdown (conversation bar) */}
                {/* No autocomplete during conversation */}

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
                      disabled={attachedImages.length >= 3}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#2a2a29' }}
                      title="Attach images"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                    <input ref={fileInputRef2} type="file" accept="image/*" multiple onChange={handleImagesSelected} className="hidden" />

                    {/* Mode buttons in conversation bar */}
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
                  {/* Desktop/tablet: center absolute */}
                  {isRecording && (
                    <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-1 pointer-events-none">
                      <SoundWave bars={80} />
                    </div>
                  )}
                  {/* Mobile: place waveform between left and right groups */}
                  <div className="sm:hidden flex-1 flex justify-center pointer-events-none">
                    {isRecording && (
                      <div className="w-28">
                        <SoundWave bars={36} />
                      </div>
                    )}
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
                        onClick={() => isLoading ? stopStreaming() : handleSearch()}
                      disabled={!isLoading && (!searchQuery.trim() && attachedImages.length === 0)}
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
            {/* Disclaimer */}
            <p className="text-center mt-2 text-xs text-gray-500/60">
              AI can make mistakes, kindly fact check if possible.
            </p>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowArchiveModal(false)}
          >
            <div
              className="relative rounded-2xl shadow-2xl max-w-md w-full p-6"
              style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <Archive size={24} style={{ color: '#f1d08c' }} />
                <h3 className="text-xl font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                  Archive Conversation
                </h3>
              </div>
              <p className="mb-6" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Are you sure you want to archive this conversation? You can find it in the Archive section later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f3f4f6', color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3a3a39' : '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchiveConversation}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: '#f1d08c', color: '#000000' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8c377'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1d08c'}
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Move to Folder Modal */}
      {showMoveToFolderModal && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowMoveToFolderModal(false)}
          >
            <div
              className="relative rounded-2xl shadow-2xl max-w-md w-full p-6"
              style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <Folder size={24} style={{ color: '#f1d08c' }} />
                <h3 className="text-xl font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                  Move to Project
                </h3>
              </div>
              <p className="mb-4 text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Select a project to organize this conversation
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {folders.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                    No projects yet. Create one from the sidebar!
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => handleMoveToFolder(null)}
                      className="w-full px-4 py-3 rounded-lg text-left transition-colors"
                      style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f3f4f6', color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3a3a39' : '#e5e7eb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6'}
                    >
                      Unorganized
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleMoveToFolder(folder.id)}
                        className="w-full px-4 py-3 rounded-lg text-left transition-colors flex items-center gap-2"
                        style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f3f4f6', color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3a3a39' : '#e5e7eb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6'}
                      >
                        <Folder size={16} />
                        {folder.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <button
                onClick={() => setShowMoveToFolderModal(false)}
                className="w-full px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: theme === 'dark' ? '#2a2a29' : '#f3f4f6', color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3a3a39' : '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6'}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Copied notification */}
      {showCopied && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200 opacity-100">
          <div className="px-4 py-2 rounded-lg shadow-lg flex items-center gap-2" style={{ backgroundColor: '#22c55e' }}>
            <CopyIcon size={16} className="text-white" />
            <span className="text-sm font-medium text-white">Copied</span>
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
        /* Conversation scroll: cream colored scrollbar */
        .humbl-scroll { scrollbar-width: thin; scrollbar-color: #f1d08c transparent; }
        .humbl-scroll::-webkit-scrollbar { width: 10px; }
        .humbl-scroll::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
        .humbl-scroll::-webkit-scrollbar-thumb { background: #f1d08c; border-radius: 8px; border: 2px solid transparent; }
        .humbl-scroll::-webkit-scrollbar-thumb:hover { background: #e8c377; }
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
        /* Recording waveform */
        .sound-wave .bar { width: 2px; margin: 0 1px; height: 10px; background: #f1d08c; animation-name: wave-lg; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
        .sound-wave .bar:nth-child(-n + 7), .sound-wave .bar:nth-last-child(-n + 7) { animation-name: wave-md; }
        .sound-wave .bar:nth-child(-n + 3), .sound-wave .bar:nth-last-child(-n + 3) { animation-name: wave-sm; }
        @keyframes wave-sm { 0% { opacity: 0.35; height: 10px; } 100% { opacity: 1; height: 18px; } }
        @keyframes wave-md { 0% { opacity: 0.35; height: 14px; } 100% { opacity: 1; height: 34px; } }
        @keyframes wave-lg { 0% { opacity: 0.35; height: 16px; } 100% { opacity: 1; height: 44px; } }
        @keyframes spin-segment {
          0% { opacity: 0.1; }
          50% { opacity: 1; }
          100% { opacity: 0.1; }
        }
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 640px) {
          .animate-scroll {
            animation-duration: 25s !important;
          }
        }
        /* Table row striping - dark mode default */
        table tbody tr:nth-child(even) { background-color: rgba(17, 24, 39, 0.3); }
        /* Light mode striping */
        html[data-theme="light"] table tbody tr:nth-child(even),
        div[data-theme="light"] table tbody tr:nth-child(even) { background-color: rgba(249, 250, 251, 0.5); }
      `}</style>
    </div>
  );
}