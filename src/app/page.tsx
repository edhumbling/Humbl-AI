'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Send, Copy as CopyIcon, ThumbsUp, ThumbsDown, Plus, Info, X, ArrowUp, Square, RefreshCw, Check, Volume2, VolumeX, ChevronDown, Image as ImageIcon, Download, Edit2, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import ResponseRenderer from '../components/ResponseRenderer';
import { useConversation } from '@/contexts/ConversationContext';

interface SearchResult {
  query: string;
  response: string;
  timestamp: string;
}

export default function Home() {
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

    endConversation();
    clearConversation();
    setSearchQuery('');
    setSearchResult(null);
    setStreamingResponse('');
    setError(null);
    setThinkingText('');
  };

  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState<'default' | 'search' | 'study' | 'image'>('default');
  const [webSearchMode, setWebSearchMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [imageGenerationMode, setImageGenerationMode] = useState(false);
  const [showWebSearchDropdown, setShowWebSearchDropdown] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);
  const canSend = (!!searchQuery.trim() || attachedImages.length > 0) && !isLoading;
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [remixingImageIndex, setRemixingImageIndex] = useState<number | null>(null);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [isRemixingImage, setIsRemixingImage] = useState(false);
  const [imageMenuOpen, setImageMenuOpen] = useState<number | null>(null);
  const [imageIconDropdownOpen, setImageIconDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const suggestTimeoutRef = useRef<number | null>(null);
  const initialSearchRef = useRef<HTMLDivElement | null>(null);
  const conversationBarRef = useRef<HTMLDivElement | null>(null);

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
    const queryToUse = retryQuery ?? searchQuery;
    const imagesToUse = retryImages ?? attachedImages;
    if (!queryToUse.trim() && imagesToUse.length === 0) return;

    // Start conversation
    startConversation();

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

    const modeToUse = retryMode ?? (imageGenerationMode ? 'image' : mode);
    
    // Handle image generation mode
    if (modeToUse === 'image') {
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: queryToUse }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to generate image' }));
          throw new Error(errorData.error || 'Failed to generate image');
        }

        const imageData = await response.json();
        
        if (imageData.imageUrl) {
          // Add generated image to conversation
          addAIMessage(
            'Image generated successfully!',
            [imageData.imageUrl],
            undefined,
            queryToUse,
            imagesToUse.slice(0, 3),
            modeToUse
          );
          setSearchQuery('');
          setAttachedImages([]);
          setIsLoading(false);
          setThinkingText('');
          clearInterval((window as any).thinkingInterval);
          setImageGenerationMode(false); // Reset mode after generation
          return;
        }
      } catch (err: any) {
        console.error('Failed to generate image:', err);
        setError(err.message || 'Failed to generate image');
        setIsLoading(false);
        setThinkingText('');
        clearInterval((window as any).thinkingInterval);
        return;
      }
    }

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

      // Add user message to conversation history for UI (after building API history)
      // This ensures historyForAPI has all previous messages before the current one
      if (!isRetry) {
        addUserMessage(queryToUse, imagesToUse.slice(0, 3));
      }

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
      let aiMessageInitialized = false;

      // Initialize AI message placeholder for streaming
      updateLastAIMessage('', undefined);

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
                      // Finalize AI response - update with metadata if streaming happened, or add new if not
                      if (aiMessageInitialized && fullResponse) {
                        // Update the existing streaming message with final metadata
                        // The content is already set via updateLastAIMessage
                        const lastIndex = conversationHistory.length - 1;
                        if (lastIndex >= 0) {
                          updateMessageAt(lastIndex, {
                            citations: data.citations || finalCitations,
                            originalQuery: queryToUse,
                            originalImages: imagesToUse.slice(0, 3),
                            originalMode: modeToUse,
                          });
                        }
                      } else {
                        // No streaming happened, add new message
                        addAIMessage(
                          fullResponse,
                          undefined,
                          data.citations || finalCitations,
                          queryToUse,
                          imagesToUse.slice(0, 3),
                          modeToUse
                        );
                      }
                      
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
                // Update last AI message for streaming
                updateLastAIMessage(fullResponse);
                aiMessageInitialized = true;
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

  const handleRetry = (message: any, messageIndex: number) => {
    if (message.originalQuery !== undefined || message.originalImages?.length) {
      // Remove the old AI response from conversation history
      removeMessage(messageIndex);
      // Then generate new response
      handleSearch(message.originalQuery || '', message.originalImages || [], message.originalMode || 'default', true);
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
    setEditingImageIndex(index);
    setEditInstruction('');
    setImageMenuOpen(null);
  };

  const handleStartRemixImage = (index: number) => {
    setRemixingImageIndex(index);
    setRemixPrompt('');
    setImageMenuOpen(null);
  };

  const handleCancelEditImage = () => {
    setEditingImageIndex(null);
    setEditInstruction('');
  };

  const handleCancelRemixImage = () => {
    setRemixingImageIndex(null);
    setRemixPrompt('');
  };

  const handleEditImage = async () => {
    if (editingImageIndex === null || !editInstruction.trim()) return;

    setIsEditingImage(true);
    setError(null);

    try {
      const imageToEdit = attachedImages[editingImageIndex];
      if (!imageToEdit) {
        throw new Error('Image not found');
      }

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editInstruction: editInstruction.trim(),
          referenceImage: imageToEdit,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit image');
      }

      const data = await response.json();
      
      // Replace the original image with the edited one
      setAttachedImages(prev => {
        const newImages = [...prev];
        newImages[editingImageIndex] = data.imageUrl;
        return newImages;
      });

      // Reset editing state
      setEditingImageIndex(null);
      setEditInstruction('');
    } catch (err: any) {
      console.error('Failed to edit image:', err);
      setError(err.message || 'Failed to edit image');
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleRemixImage = async () => {
    if (remixingImageIndex === null || !remixPrompt.trim()) return;

    setIsRemixingImage(true);
    setError(null);

    try {
      const imageToRemix = attachedImages[remixingImageIndex];
      if (!imageToRemix) {
        throw new Error('Image not found');
      }

      const response = await fetch('/api/remix-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: remixPrompt.trim(),
          referenceImages: [imageToRemix],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remix image');
      }

      const data = await response.json();
      
      // Add the remixed image to the attached images
      setAttachedImages(prev => [...prev, data.imageUrl]);

      // Reset remixing state
      setRemixingImageIndex(null);
      setRemixPrompt('');
    } catch (err: any) {
      console.error('Failed to remix image:', err);
      setError(err.message || 'Failed to remix image');
    } finally {
      setIsRemixingImage(false);
    }
  };

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

  // Detect mobile viewport for placeholder tone
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const placeholderText = isMobile ? 'Ask anything… everything ✨' : 'Ask Anything, I mean everything...';

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
        window.scrollTo({ top: window.scrollY + rect.top - 16 });
      }
    };
    // small delay to allow keyboard animation to begin
    setTimeout(doScroll, 50);
    const vv: any = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
      const once = () => { doScroll(); vv.removeEventListener('resize', once); };
      vv.addEventListener('resize', once);
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
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#151514' }}>
      {/* Header Bar with New Conversation button */}
      <div className="w-full border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="grid grid-cols-3 items-center">
            {/* Left: New conversation */}
            <div className="flex items-center space-x-2 justify-start">
              <button
                onClick={startNewConversation}
                className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#f1d08c' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
                title="New conversation"
              >
                <Plus size={18} className="text-black" />
              </button>
              <span className="text-sm text-gray-400 hidden sm:inline">New</span>
            </div>

            {/* Center: Logo when conversation is active */}
            <div className="flex items-center justify-center">
              {conversationStarted && (
                <button onClick={startNewConversation} className="cursor-pointer hover:opacity-80 transition-opacity" title="New conversation">
                  <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-6 w-auto opacity-90" />
                </button>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex items-center justify-end">
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
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowInfo(false)}
          />
          <div className="relative h-full w-full flex items-center justify-center px-4">
            <div 
              className="w-[90%] sm:w-full max-w-sm sm:max-w-3xl rounded-2xl shadow-xl" 
              style={{ backgroundColor: '#1f1f1f' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-4 border-b border-gray-800/60">
                <div className="flex items-center space-x-2">
                  <Info size={18} className="text-gray-200" />
                  <span className="text-xs sm:text-sm text-gray-200">About this app</span>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
                  title="Close"
                >
                  <X size={16} className="text-gray-300" />
                </button>
              </div>

              <div className="px-4 py-4 sm:px-5 sm:py-5 lg:grid lg:grid-cols-2 lg:gap-10 space-y-4 sm:space-y-6 lg:space-y-0">
                {/* About - Left */}
                <div className="space-y-3">
                  <h3 className="text-gray-200 text-xs sm:text-sm">About Humbl AI</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                      <Image src="/applogo.png" alt="Humbl AI" width={48} height={48} />
                    </div>
                    <div>
                      <div className="text-gray-200 text-sm sm:text-base">Humbl AI</div>
                      <div className="text-gray-400 text-xs sm:text-sm">Your Intelligent AI Assistant</div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-gray-200 text-xs sm:text-sm">About</h4>
                    <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                      Humbl AI is an advanced conversational assistant designed to help you research, analyze images, and get precise answers in real time. It combines internet search, voice input, and safe educational filtering to deliver concise, helpful responses.
                    </p>
                  </div>
                </div>

                {/* Right column: Features + Developer */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-gray-200 text-xs sm:text-sm mb-2">Features</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300 text-xs sm:text-sm">
                      <li>Voice input and text-to-speech</li>
                      <li>Image analysis capabilities</li>
                      <li>Internet search integration</li>
                      <li>Educational content filtering</li>
                      <li>Real-time conversation</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-gray-200 text-xs sm:text-sm">Developer</h3>
                    <div className="text-gray-300 text-xs sm:text-sm">EH — Emmanuel Humbling</div>
                    <div className="text-gray-300 text-xs sm:text-sm">AI Developer, AIDEL</div>
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

      {/* Edit Image Modal */}
      {editingImageIndex !== null && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={handleCancelEditImage}
          />
          <div className="relative h-full w-full flex items-center justify-center px-4">
            <div 
              className="w-full max-w-md rounded-2xl shadow-xl p-6" 
              style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-white text-lg font-semibold mb-2">Edit Image</h3>
                {attachedImages[editingImageIndex] && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={attachedImages[editingImageIndex]} 
                      alt="Preview" 
                      className="w-full max-h-48 object-contain bg-black rounded-lg"
                    />
                  </div>
                )}
                <label className="block text-gray-300 text-sm mb-2">
                  Edit Instruction
                </label>
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Describe how to edit the image (e.g., 'Remove all people from the background')"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 outline-none resize-none"
                  rows={4}
                  style={{ border: '1px solid #3a3a39' }}
                  autoFocus
                  maxLength={2560}
                />
                <p className="text-gray-400 text-xs mt-1">
                  {editInstruction.length}/2560 characters
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelEditImage}
                  disabled={isEditingImage}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#2a2a29', color: '#ffffff' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditImage}
                  disabled={isEditingImage || !editInstruction.trim()}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ 
                    backgroundColor: isEditingImage || !editInstruction.trim() ? '#2a2a29' : '#f1d08c', 
                    color: isEditingImage || !editInstruction.trim() ? '#ffffff' : '#000000' 
                  }}
                >
                  {isEditingImage ? 'Editing...' : 'Apply Edit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remix Image Modal */}
      {remixingImageIndex !== null && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={handleCancelRemixImage}
          />
          <div className="relative h-full w-full flex items-center justify-center px-4">
            <div 
              className="w-full max-w-md rounded-2xl shadow-xl p-6" 
              style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-white text-lg font-semibold mb-2">Remix Image</h3>
                {attachedImages[remixingImageIndex] && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={attachedImages[remixingImageIndex]} 
                      alt="Preview" 
                      className="w-full max-h-48 object-contain bg-black rounded-lg"
                    />
                  </div>
                )}
                <label className="block text-gray-300 text-sm mb-2">
                  Remix Prompt
                </label>
                <textarea
                  value={remixPrompt}
                  onChange={(e) => setRemixPrompt(e.target.value)}
                  placeholder="Describe how to remix the image (e.g., 'Create a fantasy version with magical elements')"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 outline-none resize-none"
                  rows={4}
                  style={{ border: '1px solid #3a3a39' }}
                  autoFocus
                  maxLength={2560}
                />
                <p className="text-gray-400 text-xs mt-1">
                  {remixPrompt.length}/2560 characters
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelRemixImage}
                  disabled={isRemixingImage}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#2a2a29', color: '#ffffff' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemixImage}
                  disabled={isRemixingImage || !remixPrompt.trim()}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ 
                    backgroundColor: isRemixingImage || !remixPrompt.trim() ? '#2a2a29' : '#f1d08c', 
                    color: isRemixingImage || !remixPrompt.trim() ? '#ffffff' : '#000000' 
                  }}
                >
                  {isRemixingImage ? 'Remixing...' : 'Create Remix'}
                </button>
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

          {/* Desktop Title removed per request */}

          {/* Search Bar */}
          <div ref={initialSearchRef} className="w-full max-w-xl lg:max-w-3xl mx-auto mb-6 sm:mb-8">
            <div className="relative">
              <div className="relative overflow-visible flex flex-col rounded-2xl px-3 pt-3 pb-12 sm:px-6 sm:pt-4 sm:pb-14 shadow-lg" style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c' }}>
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
                    onFocus={() => { if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); scrollBarAboveKeyboard(initialSearchRef.current); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                    placeholder={placeholderText}
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
                </div>

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
                        onClick={() => handleSearch()}
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
            {/* Disclaimer */}
            <p className="text-center mt-2 text-xs text-gray-500/60">
              Disclaimer: AI can make mistakes, kindly fact check if possible.
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
                      <div className="max-w-[80%] rounded-2xl px-4 py-3" style={{ backgroundColor: '#1f1f1f' }}>
                        <p className="text-gray-300 text-sm sm:text-base whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
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
                      {message.content && <ResponseRenderer content={message.content} />}
                      {/* Action buttons for AI responses */}
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
                  <ResponseRenderer content={streamingResponse} isLoading={isLoading} />
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

      {/* Scroll to bottom button - Only show when conversation has started */}
      {conversationStarted && showScrollToBottom && (
        <div className="w-full px-4 pb-2 flex justify-center">
          <button
            onClick={scrollToBottom}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all opacity-100 border-2 bg-transparent hover:bg-[#f1d08c]/10 hover:scale-110"
            style={{ borderColor: '#f1d08c' }}
            title="Scroll to bottom"
          >
            <ChevronDown size={20} className="text-[#f1d08c]" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Search Bar - Only show when conversation has started */}
      {conversationStarted && (
        <div className="w-full px-4 py-4" ref={conversationBarRef}>
          <div className="max-w-xl lg:max-w-3xl mx-auto">
            <div className="relative">
              <div className="relative overflow-visible flex flex-col rounded-2xl px-4 pt-4 pb-12 shadow-lg" style={{ backgroundColor: '#1f1f1f', border: '1px solid #f1d08c' }}>
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
                    onFocus={() => { if (!conversationStarted && suggestions.length > 0) setShowSuggestions(true); scrollBarAboveKeyboard(conversationBarRef.current as HTMLElement); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                    placeholder={placeholderText}
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
                        onClick={() => handleSearch()}
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
            {/* Disclaimer */}
            <p className="text-center mt-2 text-xs text-gray-500/60">
              Disclaimer: AI can make mistakes, kindly fact check if possible.
            </p>
          </div>
        </div>
      )}

      {/* Copied notification */}
      {showCopied && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200 opacity-100">
          <div className="px-4 py-2 rounded-lg shadow-lg border-2 flex items-center gap-2" style={{ backgroundColor: '#f1d08c', borderColor: '#f1d08c' }}>
            <CopyIcon size={16} className="text-black" />
            <span className="text-sm font-medium text-black">Copied!</span>
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
        /* Conversation scroll: dark, faded scrollbar */
        .humbl-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.6) transparent; }
        .humbl-scroll::-webkit-scrollbar { width: 10px; }
        .humbl-scroll::-webkit-scrollbar-track { background: linear-gradient(to bottom, rgba(0,0,0,0.0), rgba(0,0,0,0.45)); border-radius: 8px; }
        .humbl-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.6); border-radius: 8px; border: 2px solid rgba(0,0,0,0.2); }
        .humbl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.7); }
        /* Recording waveform */
        .sound-wave .bar { width: 2px; margin: 0 1px; height: 10px; background: #f1d08c; animation-name: wave-lg; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
        .sound-wave .bar:nth-child(-n + 7), .sound-wave .bar:nth-last-child(-n + 7) { animation-name: wave-md; }
        .sound-wave .bar:nth-child(-n + 3), .sound-wave .bar:nth-last-child(-n + 3) { animation-name: wave-sm; }
        @keyframes wave-sm { 0% { opacity: 0.35; height: 10px; } 100% { opacity: 1; height: 18px; } }
        @keyframes wave-md { 0% { opacity: 0.35; height: 14px; } 100% { opacity: 1; height: 34px; } }
        @keyframes wave-lg { 0% { opacity: 0.35; height: 16px; } 100% { opacity: 1; height: 44px; } }
      `}</style>
    </div>
  );
}