'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, ArrowUp, Square, Plus, X, Image as ImageIcon, ChevronDown, Check, Edit2, MoreVertical, Download, Copy as CopyIcon, Info, ThumbsUp, ThumbsDown, RefreshCw, Volume2, VolumeX, Share2, ChevronLeft, ChevronRight, Maximize2, Minimize2, Globe, Lightbulb } from 'lucide-react';
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
    updateLastAIMessage,
    updateMessageAt,
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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [retryDropdownOpen, setRetryDropdownOpen] = useState<number | null>(null);
  const [retryCustomPrompt, setRetryCustomPrompt] = useState('');
  
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
  const retryStateRef = useRef<{ messageIndex: number } | null>(null);
  const retryDropdownRef = useRef<HTMLDivElement | null>(null);

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

  const handleSearch = async (query?: string, images?: string[], mode?: 'default' | 'search' | 'image', isRetry?: boolean) => {
    // Handle image edit/remix mode
    if (imageEditRemixMode && selectedImageIndex !== null) {
      const instruction = query || searchQuery;
      if (instruction.trim()) {
        await handleImageEditRemix(instruction);
        return;
      }
      return;
    }

    const queryToUse = query || searchQuery.trim();
    const imagesToUse = images || attachedImages;
    const modeToUse = mode || (imageGenerationMode ? 'image' : mode === 'search' ? 'search' : webSearchMode === 'on' ? 'search' : webSearchMode === 'auto' ? 'auto' : 'default');
    
    if (!queryToUse && imagesToUse.length === 0) return;
    if (isStreaming) return;

    // Add user message to conversation history for UI (before processing)
    // This ensures the user's query is displayed normally
    if (!isRetry) {
      setSearchQuery('');
      addUserMessage(queryToUse, imagesToUse);
      setAttachedImages([]);
      setImageGenerationMode(false);
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingResponse('');

    // Handle image generation mode
    if (modeToUse === 'image') {
      // Set generating state and progress
      setIsGeneratingImage(true);
      setImageGenerationProgress(0);
      
      // Add a placeholder AI message for the generation status (only if not retrying)
      if (!isRetry) {
        addAIMessage('', [], undefined, queryToUse, [], modeToUse);
      }
      
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
          setTimeout(() => {
            updateLastAIMessage('Image generated successfully!', [imageData.imageUrl]);
            setIsGeneratingImage(false);
            setImageGenerationProgress(0);
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
          }, 300);
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
          setIsStreaming(false);
          return;
        }
        console.error('Failed to generate image:', err);
        setError(err.message || 'Failed to generate image');
        setIsGeneratingImage(false);
        setImageGenerationProgress(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        // Remove the placeholder AI message on error
        removeMessage(conversationHistory.length - 1);
      }
      setIsStreaming(false);
      return;
    }

    try {
      // Build conversation history for API context
      let historyToUse = getConversationHistory();
      
      if (isRetry && retryStateRef.current) {
        // For retry, exclude the last AI message we're retrying
        historyToUse = historyToUse.filter((msg, idx) => {
          return !(idx === retryStateRef.current!.messageIndex && msg.type === 'ai');
        });
      }
      
      const historyForAPI = historyToUse
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
                        originalMode: retryMessage.originalMode || (modeToUse === 'auto' ? 'default' : modeToUse),
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
                            originalMode: modeToUse === 'auto' ? 'default' : modeToUse,
                          });
                        }
                      } else {
                        addAIMessage(
                          String(fullResponse),
                          undefined,
                          data.citations || finalCitations,
                          queryToUse,
                          imagesToUse.slice(0, 3),
                          modeToUse === 'auto' ? 'default' : modeToUse
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
                        originalMode: modeToUse === 'auto' ? 'default' : modeToUse,
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
                      modeToUse === 'auto' ? 'default' : modeToUse
                    );
                  }
                  
                  // Ensure fullResponse is a string before finalizing
                  const finalResponse = String(fullResponse || '');
                  break;
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
                content: String(fullResponse),
                citations: finalCitations,
                originalQuery: queryToUse,
                originalImages: imagesToUse.slice(0, 3),
                originalMode: modeToUse === 'auto' ? 'default' : modeToUse,
              });
            } else {
              addAIMessage(
                String(fullResponse),
                undefined,
                finalCitations,
                queryToUse,
                imagesToUse.slice(0, 3),
                modeToUse === 'auto' ? 'default' : modeToUse
              );
            }
          }
          setStreamingResponse('');
          setIsStreaming(false);
          return;
        }
        throw err;
      }

      // Ensure fullResponse is a string before adding to conversation (only for non-retry)
      if (!retryStateRef.current && fullResponse) {
        const finalResponse = String(fullResponse || '');
        // Message already added above in data.done block
        setStreamingResponse('');
        
        // Save continuation if user is logged in
        if (user && !isRetry) {
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
                    images: imagesToUse,
                    mode: modeToUse === 'auto' ? 'default' : modeToUse
                  }),
                });
                
                await fetch(`/api/conversations/${conversationId}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    role: 'assistant',
                    content: finalResponse,
                    images: [],
                    citations: finalCitations || [],
                    mode: modeToUse === 'auto' ? 'default' : modeToUse
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
                  images: imagesToUse,
                  mode: modeToUse === 'auto' ? 'default' : modeToUse
                }),
              });
              
              await fetch(`/api/conversations/${newConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  role: 'assistant',
                  content: finalResponse,
                  images: [],
                  citations: finalCitations || [],
                  mode: modeToUse === 'auto' ? 'default' : modeToUse
                }),
              });
            }
          }
        } else if (!user && !isRetry) {
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
              images: imagesToUse,
              mode: modeToUse === 'auto' ? 'default' : modeToUse,
              timestamp: Date.now()
            },
            {
              role: 'assistant',
              content: finalResponse,
              images: [],
              citations: finalCitations || [],
              mode: modeToUse === 'auto' ? 'default' : modeToUse,
              timestamp: Date.now()
            }
          ];
          
          // Save to localStorage
          localStorage.setItem(continuationMessagesKey, JSON.stringify(newMessages));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (!retryStateRef.current) {
        addAIMessage('Sorry, I encountered an error. Please try again.');
      }
      setError('Failed to search. Please try again.');
    } finally {
      setIsStreaming(false);
      // Clean up refs
      streamReaderRef.current = null;
    }
  };

  const onShareButtonClick = (messageIndex: number) => {
    if (user) {
      handleMessageShare(messageIndex);
    } else {
      router.push('/handler/login');
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
    setIsStreaming(true);
    setStreamingResponse('');
    setError(null);
    
    try {
      // Generate new response - pass isRetry=true to prevent adding user message
      await handleSearch(modifiedQuery, images, modifiedMode, true);
    } catch (err) {
      setError('Failed to retry. Please try again.');
      setIsStreaming(false);
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

  const handleImageEditRemix = async (instruction: string) => {
    if (!imageEditRemixMode || selectedImageIndex === null || !instruction.trim()) return;

    const imageToProcess = attachedImages[selectedImageIndex];
    if (!imageToProcess) {
      setError('Image not found');
      return;
    }

    // Start conversation to ensure UI is visible
    startConversation();

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

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
          clearInterval(progressInterval);
          progressIntervalRef.current = null;
          
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
      // Check if aborted
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setIsGeneratingImage(false);
        setImageGenerationProgress(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        removeMessage(conversationHistory.length - 1);
        return;
      }
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
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [retryDropdownOpen]);

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
                      {/* Show streaming response during retry, otherwise show regular content */}
                      {streamingResponse && retryStateRef.current && retryStateRef.current.messageIndex === index ? (
                        <>
                          <ResponseRenderer content={streamingResponse} isLoading={isStreaming} theme={theme} />
                        </>
                      ) : (
                        message.content && <ResponseRenderer key={`${index}-${message.currentRetryIndex ?? 0}`} content={getDisplayedContent(message)} theme={theme} />
                      )}
                    </div>
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
                      {message.type === 'ai' && (
                        <button
                          onClick={() => onShareButtonClick(index)}
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
              ))}

              {/* Streaming Response - Only show for NEW messages (not retries) */}
              {streamingResponse && !retryStateRef.current && (
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
                        onClick={() => onShareButtonClick(conversationHistory.length - 1)}
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
        @keyframes spin-segment {
          0% { opacity: 0.1; }
          50% { opacity: 1; }
          100% { opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}

