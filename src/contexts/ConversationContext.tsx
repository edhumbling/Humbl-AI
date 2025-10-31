'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface ConversationMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  images?: string[];
  citations?: Array<{ title: string; url: string }>;
  originalQuery?: string;
  originalImages?: string[];
  originalMode?: 'default' | 'search' | 'study' | 'image';
}

interface ConversationContextType {
  conversationHistory: ConversationMessage[];
  conversationStarted: boolean;
  addMessage: (message: ConversationMessage) => void;
  addUserMessage: (content: string, images?: string[]) => void;
  addAIMessage: (
    content: string,
    images?: string[],
    citations?: Array<{ title: string; url: string }>,
    originalQuery?: string,
    originalImages?: string[],
    originalMode?: 'default' | 'search' | 'study' | 'image'
  ) => void;
  updateLastAIMessage: (content: string, images?: string[]) => void;
  updateMessageAt: (index: number, updates: Partial<ConversationMessage>) => void;
  removeMessage: (index: number) => void;
  clearConversation: () => void;
  startConversation: () => void;
  endConversation: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// Maximum number of messages to keep in memory (for memory optimization)
const MAX_MESSAGES = 100;

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const historyRef = useRef<ConversationMessage[]>([]);

  // Sync ref with state
  useEffect(() => {
    historyRef.current = conversationHistory;
  }, [conversationHistory]);

  // Add any message type
  const addMessage = useCallback((message: ConversationMessage) => {
    setConversationHistory(prev => {
      const newHistory = [...prev, message];
      // Keep only the last MAX_MESSAGES messages to save memory
      return newHistory.slice(-MAX_MESSAGES);
    });
  }, []);

  // Add user message (convenience method)
  const addUserMessage = useCallback((content: string, images?: string[]) => {
    addMessage({
      type: 'user',
      content,
      images: images?.slice(0, 3), // Limit to 3 images
      timestamp: new Date().toISOString(),
    });
  }, [addMessage]);

  // Add AI message (convenience method)
  const addAIMessage = useCallback((
    content: string,
    images?: string[],
    citations?: Array<{ title: string; url: string }>,
    originalQuery?: string,
    originalImages?: string[],
    originalMode?: 'default' | 'search' | 'study' | 'image'
  ) => {
    addMessage({
      type: 'ai',
      content,
      images,
      citations,
      originalQuery,
      originalImages,
      originalMode,
      timestamp: new Date().toISOString(),
    });
  }, [addMessage]);

  // Update the last AI message (useful for streaming responses)
  const updateLastAIMessage = useCallback((content: string, images?: string[]) => {
    setConversationHistory(prev => {
      if (prev.length === 0) {
        // If no messages, create a new AI message
        return [{
          type: 'ai' as const,
          content,
          images,
          timestamp: new Date().toISOString(),
        }];
      }

      const lastMessage = prev[prev.length - 1];
      if (lastMessage.type === 'ai') {
        // Update existing AI message
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastMessage,
          content,
          images: images ?? lastMessage.images,
        };
        return updated.slice(-MAX_MESSAGES);
      } else {
        // Add new AI message if last message is from user
        return [...prev, {
          type: 'ai' as const,
          content,
          images,
          timestamp: new Date().toISOString(),
        }].slice(-MAX_MESSAGES);
      }
    });
  }, []);

  // Update a message at a specific index
  const updateMessageAt = useCallback((index: number, updates: Partial<ConversationMessage>) => {
    setConversationHistory(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  // Remove a specific message by index
  const removeMessage = useCallback((index: number) => {
    setConversationHistory(prev => {
      const newHistory = prev.filter((_, i) => i !== index);
      return newHistory.slice(-MAX_MESSAGES);
    });
  }, []);

  // Clear all conversation history
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    historyRef.current = [];
  }, []);

  // Start conversation
  const startConversation = useCallback(() => {
    setConversationStarted(true);
  }, []);

  // End conversation (but keep history)
  const endConversation = useCallback(() => {
    setConversationStarted(false);
  }, []);

  const value: ConversationContextType = {
    conversationHistory,
    conversationStarted,
    addMessage,
    addUserMessage,
    addAIMessage,
    updateLastAIMessage,
    updateMessageAt,
    removeMessage,
    clearConversation,
    startConversation,
    endConversation,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

// Hook to use conversation context
export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}

