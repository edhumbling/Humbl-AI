'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, MoreVertical, Pencil, Trash2, LogOut, LogIn, UserPlus, User, Settings, Search, Folder, ChevronDown, ChevronRight, FolderPlus, Check, Sun, Moon, Info, Archive, Hexagon, RefreshCw, HelpCircle, FileText, ExternalLink, Flag, Download, Zap, ChevronLeft, Menu, Shield } from 'lucide-react';
import Image from 'next/image';
import FolderList from './FolderList';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
  folder_id?: string;
}

interface FolderType {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onShowInfo: () => void;
  user: any; // Stack Auth user object
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  theme,
  setTheme,
  onShowInfo,
  user,
  onNewConversation,
  onSelectConversation,
  currentConversationId,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showMoveToProjectModal, setShowMoveToProjectModal] = useState(false);
  const [conversationToMove, setConversationToMove] = useState<string | null>(null);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [folderConversationMenuOpenId, setFolderConversationMenuOpenId] = useState<string | null>(null);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [showAddChatsToFolderModal, setShowAddChatsToFolderModal] = useState(false);
  const [targetFolderForAdd, setTargetFolderForAdd] = useState<string | null>(null);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showFeedbackConfirmation, setShowFeedbackConfirmation] = useState(false);
  const [showHelpSubmenu, setShowHelpSubmenu] = useState(false);
  const [showKeyboardShortcutsModal, setShowKeyboardShortcutsModal] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Persistent state refs (survive sidebar open/close)
  const conversationsCacheRef = useRef<Conversation[]>([]);
  const archivedConversationsCacheRef = useRef<Conversation[]>([]);
  const foldersCacheRef = useRef<FolderType[]>([]);
  const lastFetchTimeRef = useRef<number>(0);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const REFRESH_INTERVAL = 30000; // 30 seconds
  const STALE_TIME = 60000; // 1 minute - data is stale after this

  // Initialize from cache if available
  useEffect(() => {
    if (conversationsCacheRef.current.length > 0) {
      setConversations(conversationsCacheRef.current);
      setFilteredConversations(conversationsCacheRef.current);
    }
    if (foldersCacheRef.current.length > 0) {
      setFolders(foldersCacheRef.current);
    }
  }, []);

  // Fetch conversations and folders - always fetch when user is available, not just when sidebar is open
  useEffect(() => {
    if (user) {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      const hasCachedData = conversationsCacheRef.current.length > 0 || foldersCacheRef.current.length > 0;
      const isStale = timeSinceLastFetch > STALE_TIME;

      // Never show loading spinner - always use cache if available
      // Fetch in background if no cache or stale
      if (!hasCachedData || isStale) {
        fetchConversations(true); // always background fetch
        fetchArchivedConversations(true);
        fetchFolders(true);
      }

      // Set up background refresh interval
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
      fetchIntervalRef.current = setInterval(() => {
        if (user) {
          fetchConversations(true); // background refresh
          fetchArchivedConversations(true);
          fetchFolders(true);
        }
      }, REFRESH_INTERVAL);

      return () => {
        if (fetchIntervalRef.current) {
          clearInterval(fetchIntervalRef.current);
          fetchIntervalRef.current = null;
        }
      };
    }
  }, [user]); // Changed from [isOpen, user] to just [user]

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations]);

  // Get conversations without folders (for Chats section)
  const conversationsWithoutFolder = React.useMemo(() => {
    return filteredConversations.filter(conv => !conv.folder_id || conv.folder_id === null);
  }, [filteredConversations]);

  const fetchConversations = async (background = false) => {
    if (!user) return;
    
    // Never set loading state - always fetch in background
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        const conversations = data.conversations || [];
        // Ensure folder_id is properly set (handle null/undefined)
        const normalizedConversations = conversations.map((conv: Conversation) => ({
          ...conv,
          folder_id: conv.folder_id || null
        }));
        
        // Update cache
        conversationsCacheRef.current = normalizedConversations;
        lastFetchTimeRef.current = Date.now();
        
        // Update state silently
        setConversations(normalizedConversations);
        setFilteredConversations(normalizedConversations);
        return normalizedConversations;
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchArchivedConversations = async (background = false) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/conversations/archived');
      if (response.ok) {
        const data = await response.json();
        const archived = data.conversations || [];
        
        // Update cache
        archivedConversationsCacheRef.current = archived;
        
        // Update state
        setArchivedConversations(archived);
      }
    } catch (error) {
      console.error('Failed to fetch archived conversations:', error);
    }
  };

  const fetchFolders = async (background = false) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/folders');
      if (response.ok) {
        const data = await response.json();
        const folders = data.folders || [];
        
        // Update cache
        foldersCacheRef.current = folders;
        if (!background) {
          lastFetchTimeRef.current = Date.now();
        }
        
        // Update state
        setFolders(folders);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        setFilteredConversations(prev => prev.filter(conv => conv.id !== conversationId));
        setMenuOpenId(null);
        
        // If deleting current conversation, start a new one
        if (conversationId === currentConversationId) {
          onNewConversation();
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleRenameConversation = async (conversationId: string) => {
    if (!editTitle.trim()) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });

      if (response.ok) {
        setConversations(prev =>
          prev.map(conv =>
            conv.id === conversationId ? { ...conv, title: editTitle } : conv
          )
        );
        setEditingId(null);
        setEditTitle('');
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const startEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
    setMenuOpenId(null);
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setShowCreateFolderModal(false);
      setNewFolderName('');
      return;
    }

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (response.ok) {
        fetchFolders();
        setShowCreateFolderModal(false);
        setNewFolderName('');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setProjectToDelete(folderId);
    setShowDeleteProjectModal(true);
    setFolderMenuOpenId(null);
  };

  const confirmDeleteFolder = async () => {
    if (!projectToDelete) return;

    try {
      const response = await fetch(`/api/folders/${projectToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFolders();
        setShowDeleteProjectModal(false);
        setProjectToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) return;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        fetchFolders();
        setEditingId(null);
        setEditTitle('');
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
    }
  };

  const startEditingFolder = (folder: FolderType) => {
    setEditingId(folder.id);
    setEditTitle(folder.name);
    setFolderMenuOpenId(null);
  };

  const handleMoveToProject = (conversationId: string) => {
    setConversationToMove(conversationId);
    setShowMoveToProjectModal(true);
    setMenuOpenId(null);
  };

  const moveConversationToFolder = async (folderId: string | null) => {
    if (!conversationToMove) return;

    try {
      const response = await fetch(`/api/conversations/${conversationToMove}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });

      if (response.ok) {
        const updatedConversation = await response.json();
        // Update local state immediately for better UX
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationToMove 
              ? { ...conv, folder_id: updatedConversation.conversation?.folder_id ?? null }
              : conv
          )
        );
        setFilteredConversations(prev => 
          prev.map(conv => 
            conv.id === conversationToMove 
              ? { ...conv, folder_id: updatedConversation.conversation?.folder_id ?? null }
              : conv
          )
        );

        // If moving to a folder, expand that folder so user can see the conversation
        if (folderId) {
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderId);
            return newSet;
          });
        }
        
        // Refresh both conversations and folders to get updated data from server
        await Promise.all([fetchConversations(), fetchFolders()]);
        
        setShowMoveToProjectModal(false);
        setConversationToMove(null);
        setFolderConversationMenuOpenId(null);
      }
    } catch (error) {
      console.error('Failed to move conversation:', error);
    }
  };

  const moveFolderConversationToUnorganized = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: null }),
      });

      if (response.ok) {
        // Update local state immediately
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, folder_id: undefined }
              : conv
          )
        );
        setFilteredConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, folder_id: undefined }
              : conv
          )
        );
        // Refresh conversations to get updated data
        await fetchConversations();
        setFolderConversationMenuOpenId(null);
      }
    } catch (error) {
      console.error('Failed to move conversation to unorganized:', error);
    }
  };

  const handleBatchMoveToFolder = async () => {
    if (!targetFolderForAdd || selectedConversations.size === 0) return;

    try {
      // Move all selected conversations
      const movePromises = Array.from(selectedConversations).map(conversationId =>
        fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_id: targetFolderForAdd }),
        })
      );

      const results = await Promise.all(movePromises);
      const allSucceeded = results.every(r => r.ok);

      if (allSucceeded) {
        // Update local state immediately for all moved conversations
        // Refresh from server to get accurate data
        const updatedConversations = await fetchConversations();
        // The fetchConversations will update the state, but we also update locally for instant feedback
        setConversations(prev => 
          prev.map(conv => 
            selectedConversations.has(conv.id)
              ? { ...conv, folder_id: targetFolderForAdd }
              : conv
          )
        );
        setFilteredConversations(prev => 
          prev.map(conv => 
            selectedConversations.has(conv.id)
              ? { ...conv, folder_id: targetFolderForAdd }
              : conv
          )
        );

        // Expand the target folder
        setExpandedFolders(prev => {
          const newSet = new Set(prev);
          newSet.add(targetFolderForAdd);
          return newSet;
        });

        // Refresh data
        await Promise.all([fetchConversations(), fetchFolders()]);

        // Close modal and reset
        setShowAddChatsToFolderModal(false);
        setSelectedConversations(new Set());
        setTargetFolderForAdd(null);
      }
    } catch (error) {
      console.error('Failed to move conversations:', error);
    }
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = conversationsWithoutFolder.map(conv => conv.id);
    setSelectedConversations(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedConversations(new Set());
  };

  const handleLogout = async () => {
    try {
      // @ts-ignore - signOut method exists on user object
      await user?.signOut({ redirectUrl: '/' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    const trimmedContent = feedbackContent.trim();
    
    if (trimmedContent.length < 10) {
      alert('Feedback must be at least 10 characters long');
      return;
    }

    if (trimmedContent.length > 3500) {
      alert('Feedback must be no more than 3500 characters long');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmedContent }),
      });

      if (response.ok) {
        setShowFeedbackModal(false);
        setFeedbackContent('');
        setShowFeedbackConfirmation(true);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Handle click outside to close sidebar - ONLY on mobile
  // On desktop, sidebar should stay open and only be controlled by collapse/expand button
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close on mobile - desktop sidebar should stay open
      if (!isMobile) {
        return;
      }
      
      // Don't close sidebar if any modal is open
      if (showCreateFolderModal || showMoveToProjectModal || showDeleteProjectModal || showAddChatsToFolderModal || showFeedbackModal || showFeedbackConfirmation) {
        return;
      }
      
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen && isMobile) {
      // Add a small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile, onClose, showCreateFolderModal, showMoveToProjectModal, showDeleteProjectModal, showAddChatsToFolderModal]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Always close menus if clicking outside the sidebar
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        setShowUserMenu(false);
        setShowSearchMenu(false);
        setMenuOpenId(null);
        setFolderMenuOpenId(null);
        setFolderConversationMenuOpenId(null);
        return;
      }
      
      // If inside sidebar, check if click is on a menu trigger or inside a menu
      if (showSearchMenu || showUserMenu || menuOpenId || folderMenuOpenId || folderConversationMenuOpenId) {
        // Check if click is on the settings button (account bar button)
        const isSettingsButton = target.closest('[data-menu-trigger="settings"]');
        // Check if click is on a three-dot button
        const isThreeDotsButton = target.closest('[data-menu-trigger="three-dots"]');
        // Check if click is on a folder menu button
        const isFolderMenuButton = target.closest('[data-menu-trigger="folder-menu"]');
        // Check if click is on a folder conversation menu button
        const isFolderConversationMenuButton = target.closest('[data-menu-trigger="folder-conversation-menu"]');
        // Check if click is inside a menu dropdown
        const isMenuDropdown = target.closest('[data-menu-dropdown]');
        
        // Close menus if not clicking on trigger or inside dropdown
        if (!isSettingsButton && !isThreeDotsButton && !isFolderMenuButton && !isFolderConversationMenuButton && !isMenuDropdown) {
          setShowUserMenu(false);
          setShowSearchMenu(false);
          setMenuOpenId(null);
          setFolderMenuOpenId(null);
          setFolderConversationMenuOpenId(null);
        }
      }
    };

    if (showUserMenu || showSearchMenu || menuOpenId || folderMenuOpenId || folderConversationMenuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, showSearchMenu, menuOpenId, folderMenuOpenId, folderConversationMenuOpenId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts from firing when a modal is open or when typing in inputs
      if (
        showFeedbackModal ||
        showFeedbackConfirmation ||
        showKeyboardShortcutsModal ||
        showUserMenu ||
        showSearchMenu ||
        showCreateFolderModal ||
        showMoveToProjectModal ||
        showDeleteProjectModal ||
        showAddChatsToFolderModal
      ) {
        return;
      }

      // Check if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Shift + Esc to focus chat input even when typing
        if (event.shiftKey && event.key === 'Escape') {
          event.preventDefault();
          // Focus chat input
          const chatInput = document.querySelector('textarea.humbl-textarea') as HTMLTextAreaElement;
          if (chatInput) {
            chatInput.focus();
            chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        // Allow Ctrl + U for file upload even when typing
        if (event.ctrlKey && event.key === 'u') {
          event.preventDefault();
          // Trigger file input
          const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
          return;
        }
        // Don't trigger other shortcuts when typing
        return;
      }

      // Search chats: Ctrl + K
      if (event.ctrlKey && event.key === 'k' && !event.shiftKey) {
        event.preventDefault();
        setShowSearchMenu(true);
        // Focus search input after a short delay
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }

      // Open new chat: Ctrl + Shift + O
      if (event.ctrlKey && event.shiftKey && event.key === 'O') {
        event.preventDefault();
        onNewConversation();
        if (isOpen) {
          onClose();
        }
      }

      // Toggle sidebar: Ctrl + Shift + S
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open sidebar - we need to trigger this from parent
          // For now, we'll dispatch a custom event that the parent can listen to
          window.dispatchEvent(new CustomEvent('openSidebar'));
        }
      }

      // Delete chat: Ctrl + Shift + Backspace
      if (event.ctrlKey && event.shiftKey && event.key === 'Backspace') {
        event.preventDefault();
        if (currentConversationId && user) {
          // Confirm before deleting
          if (window.confirm('Are you sure you want to delete this conversation?')) {
            handleDeleteConversation(currentConversationId);
          }
        }
      }

      // Focus chat input: Shift + Esc
      if (event.shiftKey && event.key === 'Escape') {
        event.preventDefault();
        const chatInput = document.querySelector('textarea.humbl-textarea') as HTMLTextAreaElement;
        if (chatInput) {
          chatInput.focus();
          chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      // Add photos & files: Ctrl + U
      if (event.ctrlKey && event.key === 'u' && !event.shiftKey) {
        event.preventDefault();
        const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    showFeedbackModal,
    showFeedbackConfirmation,
    showKeyboardShortcutsModal,
    showUserMenu,
    showSearchMenu,
    showCreateFolderModal,
    showMoveToProjectModal,
    showDeleteProjectModal,
    showAddChatsToFolderModal,
    isOpen,
    onClose,
    onNewConversation,
    currentConversationId,
    user,
    handleDeleteConversation,
  ]);

  // Format date for display - simplified format like "Oct 23", "Oct 19", etc.
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  };

  // Group conversations by time period
  const groupConversationsByTime = (convs: Conversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
      'Earlier': []
    };

    convs.forEach(conv => {
      const date = new Date(conv.updated_at);
      const convDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      // Check if same calendar day
      if (convDate.getTime() === today.getTime()) {
        groups['Today'].push(conv);
      } else if (convDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(conv);
      } else if (date >= thisWeekStart) {
        groups['This Week'].push(conv);
      } else if (date >= thisMonthStart) {
        groups['This Month'].push(conv);
      } else {
        groups['Earlier'].push(conv);
      }
    });

    return groups;
  };

  const sidebarWidth = isCollapsed ? '64px' : '256px';
  const isDesktopVisible = !isMobile && isOpen;
  const showBackdrop = isMobile && isOpen && !showCreateFolderModal && !showMoveToProjectModal && !showDeleteProjectModal && !showAddChatsToFolderModal;

  return (
    <>
      {/* Backdrop - Only on mobile */}
      {showBackdrop && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300 opacity-100"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
          }}
          onClick={() => {
            if (!showCreateFolderModal && !showMoveToProjectModal && !showDeleteProjectModal && !showAddChatsToFolderModal) {
              onClose();
            }
          }}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        data-tour={!isMobile ? 'sidebar' : undefined}
        className={`${
          isMobile 
            ? `fixed top-0 left-0 h-full w-2/3 sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ease-out ${
                isDesktopVisible ? 'translate-x-0' : '-translate-x-full'
              }`
        }`}
        style={{
          backgroundColor: theme === 'dark' ? '#151514' : '#ffffff',
          width: isMobile ? undefined : sidebarWidth,
          borderRight: !isMobile ? (theme === 'dark' ? '1px solid rgba(55, 65, 81, 0.6)' : '1px solid rgba(229, 231, 235, 0.6)') : 'none',
        }}
      >
        {/* Logo with Close/Collapse Button */}
        <div className={`flex items-center justify-between py-4 transition-colors duration-300 ${isCollapsed ? 'px-3 justify-center' : 'px-5'}`}>
          {!isCollapsed && (
            <>
              <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-8 w-auto opacity-90" />
              {!isMobile && onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-lg transition-colors duration-300"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)')
                  }
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
                </button>
              )}
            </>
          )}
          {isCollapsed && !isMobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="group relative p-1.5 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Expand sidebar"
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                {/* Favicon - fades out on hover */}
                <Image 
                  src="/small favicon.png" 
                  alt="Humbl AI" 
                  width={32} 
                  height={32} 
                  className="w-8 h-8 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90 absolute"
                />
                {/* Expand icon - fades in on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-100 scale-90">
                  <div className="w-7 h-7 rounded-md border flex items-center justify-center transition-all duration-300 group-hover:border-opacity-100"
                    style={{
                      borderColor: theme === 'dark' ? 'rgba(241, 208, 140, 0.8)' : 'rgba(241, 208, 140, 0.9)',
                      backgroundColor: theme === 'dark' ? 'rgba(241, 208, 140, 0.15)' : 'rgba(241, 208, 140, 0.2)',
                    }}
                  >
                    <ChevronRight 
                      size={16} 
                      className="transition-transform duration-300"
                      style={{ 
                        color: theme === 'dark' ? '#f1d08c' : '#e8c377',
                      }} 
                    />
                  </div>
                </div>
              </div>
            </button>
          )}
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)')
              }
            >
              <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
            </button>
          )}
        </div>

        {/* Top bar with New Conversation */}
        {user && !isCollapsed && (
          <div className="px-5 py-3">
            <button
              onClick={() => {
                onNewConversation();
                if (isMobile) onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-[1.02]"
              style={{
                backgroundColor: '#f1d08c',
                color: '#000000',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
            >
              <Pencil size={16} />
              <span className="text-xs font-medium">Start New Conversation</span>
            </button>
          </div>
        )}
        {user && isCollapsed && (
          <div className="px-2 py-3 flex justify-center">
            <button
              onClick={() => {
                onNewConversation();
              }}
              className="p-2 rounded-lg transition-all duration-200 hover:scale-[1.05]"
              style={{
                backgroundColor: '#f1d08c',
                color: '#000000',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
              title="New Conversation"
            >
              <Pencil size={18} />
            </button>
          </div>
        )}

        {/* Search Bar */}
        {user && !isCollapsed && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search 
                size={16} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2" 
                style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
              />
              <input
                type="text"
                placeholder="Search Humbl History"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-1.5 rounded-lg border-none outline-none transition-colors duration-300 text-xs"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#111827',
                }}
              />
            </div>
          </div>
        )}
        {user && isCollapsed && (
          <div className="px-2 pb-3 flex justify-center">
            <button
              onClick={() => {
                // Could open search modal or expand sidebar
                if (onToggleCollapse) onToggleCollapse();
              }}
              className="p-2 rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.8)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)')
              }
              title="Search"
            >
              <Search size={18} />
            </button>
          </div>
        )}

        {/* Conversations List */}
        {!isCollapsed && (
          <>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 custom-scrollbar min-h-0">
          {user ? (
            filteredConversations.length === 0 ? (
              <div
                className="text-center py-8 text-xs"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
              >
                {searchQuery.trim() ? 'No conversations found' : 'No conversations yet. Start a new one!'}
              </div>
            ) : (
              (() => {
                // Filter out conversations that are in folders
                const conversationsWithoutFolder = filteredConversations.filter(conv => !conv.folder_id);
                const grouped = groupConversationsByTime(conversationsWithoutFolder);
                const timePeriods = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
                
                return (
                  <>
                    {/* Folders List */}
                    {!searchQuery.trim() && (
                      <FolderList
                        folders={folders}
                        conversations={filteredConversations}
                        expandedFolders={expandedFolders}
                        editingId={editingId}
                        editTitle={editTitle}
                        folderMenuOpenId={folderMenuOpenId}
                        folderConversationMenuOpenId={folderConversationMenuOpenId}
                        theme={theme}
                        currentConversationId={currentConversationId}
                        onToggleFolder={toggleFolderExpanded}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                        onStartEditFolder={startEditingFolder}
                        onSetEditTitle={setEditTitle}
                        onSetEditingId={setEditingId}
                        onSetFolderMenuOpen={setFolderMenuOpenId}
                        onSetFolderConversationMenuOpen={setFolderConversationMenuOpenId}
                        onSelectConversation={(id) => {
                          onSelectConversation(id);
                          onClose();
                        }}
                        onMoveToUnorganized={moveFolderConversationToUnorganized}
                        onCreateNewProject={() => setShowCreateFolderModal(true)}
                        onAddChatsToFolder={(folderId) => {
                          setTargetFolderForAdd(folderId);
                          setShowAddChatsToFolderModal(true);
                        }}
                        formatDate={formatDate}
                      />
                    )}
                    
                    {/* Chats Section */}
                    {conversationsWithoutFolder.length > 0 && !searchQuery.trim() && (
                      <div className="mt-6">
                        <button
                          onClick={() => setChatsExpanded(!chatsExpanded)}
                          className="w-full flex items-center justify-between px-2 py-2 transition-colors duration-300"
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                            Chats
                          </span>
                          {chatsExpanded ? (
                            <ChevronDown size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                          ) : (
                            <ChevronRight size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Unorganized Conversations by Time */}
                    {chatsExpanded && timePeriods.map((period) => {
                  const periodConversations = grouped[period];
                  if (periodConversations.length === 0) return null;
                  
                  return (
                    <div key={period} className="mt-3">
                      <h3
                        className="text-[10px] font-semibold mb-1 px-2 uppercase tracking-wider"
                        style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                      >
                        {period}
                      </h3>
                      {periodConversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="group relative"
                        >
                          {editingId === conversation.id ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameConversation(conversation.id);
                                } else if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditTitle('');
                                }
                              }}
                              onBlur={() => handleRenameConversation(conversation.id)}
                              className="w-full px-0 py-2 text-base sm:text-lg border-none outline-none bg-transparent transition-colors duration-300"
                              style={{
                                color: theme === 'dark' ? '#e5e7eb' : '#111827',
                                borderBottom: `2px solid ${theme === 'dark' ? '#f1d08c' : '#e8c377'}`,
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => {
                                onSelectConversation(conversation.id);
                                onClose();
                              }}
                              className="w-full text-left py-1.5 pr-8 transition-opacity duration-200 hover:opacity-70"
                            >
                              <p
                                className={`text-[11px] font-medium truncate transition-colors duration-300 leading-tight ${
                                  currentConversationId === conversation.id 
                                    ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'
                                    : theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                                }`}
                              >
                                {conversation.title}
                              </p>
                              <p
                                className="text-[10px] transition-colors duration-300 leading-tight"
                                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                              >
                                {formatDate(conversation.updated_at)}
                              </p>
                            </button>
                          )}

                          {/* Three-dot menu */}
                          {editingId !== conversation.id && (
                            <div className="absolute top-2 right-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                data-menu-trigger="three-dots"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(menuOpenId === conversation.id ? null : conversation.id);
                                }}
                                className="p-1 transition-colors duration-200"
                                style={{
                                  color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.color = theme === 'dark' ? '#e5e7eb' : '#374151')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.color = theme === 'dark' ? '#9ca3af' : '#6b7280')
                                }
                              >
                                <MoreVertical size={16} />
                              </button>

                              {menuOpenId === conversation.id && (
                                <div
                                  data-menu-dropdown
                                  className="absolute right-0 mt-1 w-40 rounded-lg shadow-lg z-10 overflow-hidden"
                                  style={{
                                    backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                                    border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing(conversation);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors duration-200"
                                    style={{
                                      color: theme === 'dark' ? '#e5e7eb' : '#111827',
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor = 'transparent')
                                    }
                                  >
                                    <Pencil size={14} />
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveToProject(conversation.id);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors duration-200"
                                    style={{
                                      color: theme === 'dark' ? '#e5e7eb' : '#111827',
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor = 'transparent')
                                    }
                                  >
                                    <Folder size={14} />
                                    <span>Move to project</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteConversation(conversation.id);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-500 transition-colors duration-200"
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor = 'transparent')
                                    }
                                  >
                                    <Trash2 size={14} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                  </>
                );
              })()
            )
          ) : (
            /* Not logged in - show welcome message and login/signup buttons */
            <div className="flex flex-col h-full">
              <div className="space-y-4 pt-8 px-4 flex-1">
                {/* Welcome message */}
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold mb-3 transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                    Welcome back
                  </h2>
                  <p className="text-sm transition-colors duration-300 leading-relaxed" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                    Log in or sign up to get smarter responses, upload files and images, and more.
                  </p>
                </div>

                <button
                  onClick={() => {
                    window.location.href = '/handler/login';
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    backgroundColor: '#f1d08c',
                    color: '#000000',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
                >
                  <Shield 
                    size={20} 
                    style={{ fill: '#333', color: '#333' }} 
                    className="opacity-70 flex-shrink-0"
                    title="Temporary conversation mode - conversations are not saved"
                  />
                  <LogIn size={20} className="text-black" />
                  <span className="text-base font-medium text-black">
                    Login
                  </span>
                </button>

                <button
                  onClick={() => {
                    window.location.href = '/handler/signup';
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? '#2a2a29' : '#e5e7eb')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? '#1a1a19' : '#f3f4f6')
                  }
                >
                  <UserPlus size={20} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
                  <span
                    className="text-base transition-colors duration-300"
                    style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                  >
                    Sign Up
                  </span>
                </button>
              </div>

              {/* Terms and Privacy - For non-logged users at bottom */}
              <div className="border-t px-4 py-3 transition-colors duration-300"
                style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
                <button
                  onClick={() => {
                    window.location.href = '/terms';
                    onClose();
                  }}
                  className="w-full text-center text-xs transition-colors duration-300 hover:underline"
                  style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                >
                  Terms & Privacy Policy
                </button>
              </div>
              </div>
            )}
            
            {/* Archive Section */}
            {user && archivedConversations.length > 0 && !searchQuery.trim() && (
              <div className="px-4 pb-2 border-t transition-colors duration-300 mt-4"
                style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
                <button
                  onClick={() => setArchiveExpanded(!archiveExpanded)}
                  className="w-full flex items-center justify-between px-2 py-2 transition-colors duration-300"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <div className="flex items-center space-x-2">
                    <Archive size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                      Archive
                    </span>
                  </div>
                  {archiveExpanded ? (
                    <ChevronDown size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                  ) : (
                    <ChevronRight size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                  )}
                </button>
                
                {archiveExpanded && (
                  <div className="mt-2 space-y-1">
                    {archivedConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          onSelectConversation(conversation.id);
                          onClose();
                        }}
                              className="w-full text-left py-1.5 pr-8 transition-opacity duration-200 hover:opacity-70"
                      >
                        <p
                          className={`text-[11px] font-medium truncate transition-colors duration-300 leading-tight ${
                            currentConversationId === conversation.id 
                              ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'
                              : theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}
                        >
                          {conversation.title}
                        </p>
                        <p
                          className="text-[10px] transition-colors duration-300 leading-tight"
                          style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                        >
                          {formatDate(conversation.updated_at)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}

        {/* User Profile Section (Bottom) - Desktop only */}
        {!isMobile && user && !isCollapsed && (
          <div
            className="border-t p-2 transition-colors duration-300 mt-auto"
            style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
          >
            <div className="relative">
                <button
                  data-menu-trigger="settings"
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowSearchMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 p-1.5 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                  }}
                >
                  {user.profileImageUrl ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={user.displayName || user.primaryEmail || 'User'}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#f1d08c' }}
                    >
                      <User size={14} className="text-black" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-[11px] font-medium truncate transition-colors duration-300 leading-tight"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                    >
                      {user.displayName || 'User'}
                    </p>
                    <p
                      className="text-[10px] truncate transition-colors duration-300 leading-tight"
                      style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                    >
                      {user.primaryEmail}
                    </p>
                  </div>
                  <Settings size={14} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }} />
                </button>

                {/* Account menu dropdown */}
                {showUserMenu && (
                  <div
                    data-menu-dropdown
                    className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg min-w-[220px] z-50"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                      overflow: 'visible',
                    }}
                  >
                    {/* Account Email */}
                    <div className="w-full flex items-center space-x-2 px-4 py-3 text-sm"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                      <User size={16} />
                      <span className="truncate">{user.primaryEmail}</span>
                    </div>

                    {/* Upgrade plan - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <div className="relative">
                        <Hexagon size={16} fill="currentColor" />
                        <Plus size={10} className="absolute inset-0 m-auto" style={{ strokeWidth: 2.5 }} />
                      </div>
                      <span>Upgrade plan</span>
                    </button>

                    {/* Personalization - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <RefreshCw size={16} />
                      <span>Personalization</span>
                    </button>

                    {/* Settings - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>

                    {/* Separator */}
                    <div
                      className="w-full h-px my-1"
                      style={{ backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}
                    />

                    {/* Switch Theme */}
                    <button
                      onClick={() => {
                        setTheme(theme === 'dark' ? 'light' : 'dark');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun size={16} />
                          <span>Switch to light mode</span>
                        </>
                      ) : (
                        <>
                          <Moon size={16} />
                          <span>Switch to dark mode</span>
                        </>
                      )}
                    </button>

                    {/* Help with submenu */}
                    <div className="relative">
                    <button
                        onClick={() => {
                          setShowHelpSubmenu(!showHelpSubmenu);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors duration-200"
                        style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <HelpCircle size={16} />
                          <span>Help</span>
                        </div>
                        {/* Desktop: Right arrow, Mobile: Down arrow */}
                        <ChevronRight 
                          size={16} 
                          className={`hidden sm:block transition-transform duration-200 ${showHelpSubmenu ? 'rotate-90' : ''}`}
                        />
                        <ChevronDown 
                          size={16} 
                          className={`sm:hidden transition-transform duration-200 ${showHelpSubmenu ? 'rotate-180' : ''}`}
                        />
                      </button>
                      
                      {/* Help Submenu - Desktop: to the right, Mobile: below */}
                      {showHelpSubmenu && (
                        <>
                          {/* Desktop: Submenu to the right */}
                          <div
                            className="hidden sm:block absolute left-full bottom-0 ml-1 rounded-lg overflow-hidden shadow-lg z-[70] min-w-[200px]"
                            style={{
                              backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            <button
                              onClick={() => {
                                window.location.href = '/terms';
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <FileText size={14} />
                              <span>Terms & policies</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowFeedbackModal(true);
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <Flag size={14} />
                              <span>Report Feedback/Bug</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                                setShowKeyboardShortcutsModal(true);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <Zap size={14} />
                              <span>Keyboard shortcuts</span>
                            </button>
                          </div>
                          
                          {/* Mobile: Submenu below */}
                          <div
                            className="sm:hidden mt-1 rounded-lg overflow-hidden"
                            style={{
                              backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            <button
                              onClick={() => {
                                window.location.href = '/terms';
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <FileText size={14} />
                              <span>Terms & policies</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowFeedbackModal(true);
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <Flag size={14} />
                              <span>Report Feedback/Bug</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowHelpSubmenu(false);
                                setShowKeyboardShortcutsModal(true);
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                              style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <Zap size={14} />
                              <span>Keyboard shortcuts</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Log out */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <LogOut size={16} />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}
        
        {/* Collapsed User Menu - Desktop only */}
        {!isMobile && user && isCollapsed && (
          <div className="border-t p-2 transition-colors duration-300 mt-auto" style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
            <div className="relative flex justify-center">
              <button
                data-menu-trigger="settings"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowSearchMenu(false);
                }}
                className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                style={{
                  backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                }}
                title={user.displayName || user.primaryEmail || 'User'}
              >
                {user.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt={user.displayName || user.primaryEmail || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#f1d08c' }}
                  >
                    <User size={16} className="text-black" />
                  </div>
                )}
              </button>
              
              {/* Account menu dropdown - opens upwards outside sidebar when collapsed */}
              {showUserMenu && (
                <div
                  data-menu-dropdown
                  className="absolute left-full bottom-full mb-2 ml-2 rounded-lg shadow-xl min-w-[220px] z-[60]"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                    border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                    overflow: 'visible',
                  }}
                >
                  {/* Account Email */}
                  <div className="w-full flex items-center space-x-2 px-4 py-3 text-sm"
                    style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                    <User size={16} />
                    <span className="truncate">{user.primaryEmail}</span>
                  </div>

                  {/* Upgrade plan - Faded/Disabled */}
                  <button
                    onClick={() => {
                      // Disabled for now
                    }}
                    disabled
                    className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                    style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                  >
                    <div className="relative">
                      <Hexagon size={16} fill="currentColor" />
                      <Plus size={10} className="absolute inset-0 m-auto" style={{ strokeWidth: 2.5 }} />
                    </div>
                    <span>Upgrade plan</span>
                  </button>

                  {/* Personalization - Faded/Disabled */}
                  <button
                    onClick={() => {
                      // Disabled for now
                    }}
                    disabled
                    className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                    style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                  >
                    <RefreshCw size={16} />
                    <span>Personalization</span>
                  </button>

                  {/* Settings - Faded/Disabled */}
                  <button
                    onClick={() => {
                      // Disabled for now
                    }}
                    disabled
                    className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                    style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>

                  {/* Separator */}
                  <div
                    className="w-full h-px my-1"
                    style={{ backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}
                  />

                  {/* Switch Theme */}
                  <button
                    onClick={() => {
                      setTheme(theme === 'dark' ? 'light' : 'dark');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                    style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun size={16} />
                        <span>Switch to light mode</span>
                      </>
                    ) : (
                      <>
                        <Moon size={16} />
                        <span>Switch to dark mode</span>
                      </>
                    )}
                  </button>

                  {/* Help with submenu */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowHelpSubmenu(!showHelpSubmenu);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors duration-200"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <HelpCircle size={16} />
                        <span>Help</span>
                      </div>
                      <ChevronRight 
                        size={16} 
                        className={`transition-transform duration-200 ${showHelpSubmenu ? 'rotate-90' : ''}`}
                      />
                    </button>
                    
                    {/* Help Submenu - Desktop: to the right */}
                    {showHelpSubmenu && (
                      <div
                        className="absolute left-full bottom-0 ml-1 rounded-lg overflow-hidden shadow-lg z-[70] min-w-[200px]"
                        style={{
                          backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb',
                          border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                        }}
                      >
                        <button
                          onClick={() => {
                            window.location.href = '/terms';
                            setShowUserMenu(false);
                            setShowHelpSubmenu(false);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <FileText size={14} />
                          <span>Terms & policies</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowFeedbackModal(true);
                            setShowUserMenu(false);
                            setShowHelpSubmenu(false);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <Flag size={14} />
                          <span>Report Feedback/Bug</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowHelpSubmenu(false);
                            setShowKeyboardShortcutsModal(true);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors duration-200"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                        >
                          <Zap size={14} />
                          <span>Keyboard shortcuts</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Log out */}
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                    style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <LogOut size={16} />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Mobile User Profile Section - Maintains old mobile behavior */}
        {isMobile && user && (
          <div
            className="border-t p-2 transition-colors duration-300"
            style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
          >
            <div className="relative">
                <button
                  data-menu-trigger="settings"
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowSearchMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 p-1.5 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                  }}
                >
                  {user.profileImageUrl ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={user.displayName || user.primaryEmail || 'User'}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#f1d08c' }}
                    >
                      <User size={14} className="text-black" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-[11px] font-medium truncate transition-colors duration-300 leading-tight"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                    >
                      {user.displayName || 'User'}
                    </p>
                    <p
                      className="text-[10px] truncate transition-colors duration-300 leading-tight"
                      style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                    >
                      {user.primaryEmail}
                    </p>
                  </div>
                  <Settings size={14} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }} />
                </button>

                {/* Account menu dropdown - Same as desktop expanded version */}
                {showUserMenu && (
                  <div
                    data-menu-dropdown
                    className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg min-w-[220px] z-50"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                      overflow: 'visible',
                    }}
                  >
                    {/* Account Email */}
                    <div className="w-full flex items-center space-x-2 px-4 py-3 text-sm"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                      <User size={16} />
                      <span className="truncate">{user.primaryEmail}</span>
                    </div>

                    {/* Upgrade plan - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <div className="relative">
                        <Hexagon size={16} fill="currentColor" />
                        <Plus size={10} className="absolute inset-0 m-auto" style={{ strokeWidth: 2.5 }} />
                      </div>
                      <span>Upgrade plan</span>
                    </button>

                    {/* Personalization - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <RefreshCw size={16} />
                      <span>Personalization</span>
                    </button>

                    {/* Settings - Faded/Disabled */}
                    <button
                      onClick={() => {
                        // Disabled for now
                      }}
                      disabled
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200 opacity-40 cursor-not-allowed"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>

                    {/* Separator */}
                    <div
                      className="w-full h-px my-1"
                      style={{ backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}
                    />

                    {/* Switch Theme */}
                    <button
                      onClick={() => {
                        setTheme(theme === 'dark' ? 'light' : 'dark');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun size={16} />
                          <span>Switch to light mode</span>
                        </>
                      ) : (
                        <>
                          <Moon size={16} />
                          <span>Switch to dark mode</span>
                        </>
                      )}
                    </button>

                    {/* Help with submenu */}
                    <div className="relative">
                    <button
                        onClick={() => {
                          setShowHelpSubmenu(!showHelpSubmenu);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors duration-200"
                        style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <HelpCircle size={16} />
                          <span>Help</span>
                        </div>
                        <ChevronDown 
                          size={16} 
                          className={`transition-transform duration-200 ${showHelpSubmenu ? 'rotate-180' : ''}`}
                        />
                      </button>
                      
                      {/* Mobile: Submenu below */}
                      {showHelpSubmenu && (
                        <div
                          className="mt-1 rounded-lg overflow-hidden"
                          style={{
                            backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb',
                            border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                          }}
                        >
                          <button
                            onClick={() => {
                              window.location.href = '/terms';
                              setShowUserMenu(false);
                              setShowHelpSubmenu(false);
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <FileText size={14} />
                            <span>Terms & policies</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowFeedbackModal(true);
                              setShowUserMenu(false);
                              setShowHelpSubmenu(false);
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <Flag size={14} />
                            <span>Report Feedback/Bug</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowHelpSubmenu(false);
                              setShowKeyboardShortcutsModal(true);
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2.5 pl-8 text-sm transition-colors duration-200"
                            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                theme === 'dark' ? '#1f1f1f' : '#f3f4f6')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <Zap size={14} />
                            <span>Keyboard shortcuts</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Log out */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm transition-colors duration-200"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <LogOut size={16} />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setShowCreateFolderModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b transition-colors duration-300 flex items-center justify-between"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <h3 className="text-lg font-semibold transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Create New Project
              </h3>
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setNewFolderName('');
                }}
                className="p-1 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                }}
              >
                <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
              </button>
            </div>
            <div className="px-6 py-4">
              <input
                type="text"
                placeholder="Project name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  } else if (e.key === 'Escape') {
                    setShowCreateFolderModal(false);
                    setNewFolderName('');
                  }
                }}
                className="w-full px-4 py-3 rounded-lg border-none outline-none transition-colors duration-300 text-sm"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#111827',
                }}
                autoFocus
              />
            </div>
            <div className="px-6 py-4 flex gap-3 border-t transition-colors duration-300"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: '#f1d08c',
                  color: '#000000',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Project Modal */}
      {showMoveToProjectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setShowMoveToProjectModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b transition-colors duration-300 flex items-center justify-between"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <h3 className="text-lg font-semibold transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Move to Project
              </h3>
              <button
                onClick={() => setShowMoveToProjectModal(false)}
                className="p-1 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                }}
              >
                <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
              </button>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto custom-scrollbar">
              {folders.length === 0 ? (
                <p className="text-sm text-center py-4 transition-colors duration-300"
                  style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  No projects yet. Create one first!
                </p>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={() => moveConversationToFolder(null)}
                    className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 text-left"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                      color: theme === 'dark' ? '#e5e7eb' : '#111827',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.9)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)')
                    }
                  >
                    <span className="text-sm">Unorganized</span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => moveConversationToFolder(folder.id)}
                      className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 text-left"
                      style={{
                        backgroundColor: theme === 'dark' ? '#f1d08c' : '#e8c377',
                        color: theme === 'dark' ? '#111827' : '#111827',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#e8c377' : '#d9af5a')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#f1d08c' : '#e8c377')
                      }
                    >
                      <Folder size={14} style={{ color: theme === 'dark' ? '#111827' : '#111827' }} />
                      <span className="text-sm">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t transition-colors duration-300"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <button
                onClick={() => setShowMoveToProjectModal(false)}
                className="w-full px-4 py-2 rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteProjectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setShowDeleteProjectModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b transition-colors duration-300 flex items-center justify-between"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <h3 className="text-lg font-semibold transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Delete Project
              </h3>
              <button
                onClick={() => {
                  setShowDeleteProjectModal(false);
                  setProjectToDelete(null);
                }}
                className="p-1 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                }}
              >
                <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Are you sure you want to delete this project? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t transition-colors duration-300"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <button
                onClick={() => {
                  setShowDeleteProjectModal(false);
                  setProjectToDelete(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFolder}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02] text-white"
                style={{
                  backgroundColor: '#ef4444',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Chats to Folder Modal */}
      {showAddChatsToFolderModal && targetFolderForAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => {
              setShowAddChatsToFolderModal(false);
              setSelectedConversations(new Set());
              setTargetFolderForAdd(null);
            }}
          />
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 flex flex-col"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b transition-colors duration-300 flex items-center justify-between flex-shrink-0"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <div>
                <h3 className="text-lg font-semibold transition-colors duration-300"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  Add Chats to Project
                </h3>
                <p className="text-xs mt-1 transition-colors duration-300"
                  style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  {folders.find(f => f.id === targetFolderForAdd)?.name || 'Project'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddChatsToFolderModal(false);
                  setSelectedConversations(new Set());
                  setTargetFolderForAdd(null);
                }}
                className="p-1 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                }}
              >
                <X size={16} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
              </button>
            </div>

            {/* Selection Controls */}
            <div className="px-6 py-3 border-b transition-colors duration-300 flex items-center justify-between flex-shrink-0"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.9)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)')
                  }
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                    color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.9)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)')
                  }
                >
                  Deselect All
                </button>
              </div>
              <span className="text-sm transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                {selectedConversations.size} selected
              </span>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              {conversationsWithoutFolder.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm transition-colors duration-300"
                    style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                    No chats in history to add
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversationsWithoutFolder.map((conversation) => {
                    const isSelected = selectedConversations.has(conversation.id);
                    return (
                      <button
                        key={conversation.id}
                        onClick={() => toggleConversationSelection(conversation.id)}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-left"
                        style={{
                          backgroundColor: isSelected
                            ? (theme === 'dark' ? 'rgba(241, 208, 140, 0.2)' : 'rgba(241, 208, 140, 0.3)')
                            : (theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)'),
                          border: isSelected
                            ? `1px solid ${theme === 'dark' ? '#f1d08c' : '#e8c377'}`
                            : '1px solid transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.4)' : 'rgba(209, 213, 219, 0.7)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)';
                          }
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200"
                          style={{
                            borderColor: isSelected
                              ? (theme === 'dark' ? '#f1d08c' : '#e8c377')
                              : (theme === 'dark' ? '#6b7280' : '#9ca3af'),
                            backgroundColor: isSelected
                              ? (theme === 'dark' ? '#f1d08c' : '#e8c377')
                              : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <Check size={14} style={{ color: theme === 'dark' ? '#111827' : '#111827' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate transition-colors duration-300"
                            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                          >
                            {conversation.title}
                          </p>
                          <p
                            className="text-xs transition-colors duration-300"
                            style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                          >
                            {formatDate(conversation.updated_at)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t transition-colors duration-300 flex gap-3 flex-shrink-0"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <button
                onClick={() => {
                  setShowAddChatsToFolderModal(false);
                  setSelectedConversations(new Set());
                  setTargetFolderForAdd(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBatchMoveToFolder}
                disabled={selectedConversations.size === 0}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: selectedConversations.size > 0 ? '#f1d08c' : (theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)'),
                  color: selectedConversations.size > 0 ? '#000000' : (theme === 'dark' ? '#9ca3af' : '#6b7280'),
                }}
                onMouseEnter={(e) => {
                  if (selectedConversations.size > 0) {
                    e.currentTarget.style.backgroundColor = '#e8c377';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversations.size > 0) {
                    e.currentTarget.style.backgroundColor = '#f1d08c';
                  }
                }}
              >
                Add {selectedConversations.size > 0 ? `${selectedConversations.size} ` : ''}Chat{selectedConversations.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => {
              if (!isSubmittingFeedback) {
                setShowFeedbackModal(false);
                setFeedbackContent('');
              }
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b transition-colors duration-300 flex items-center justify-between"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <h3 className="text-lg sm:text-xl font-semibold transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Send Feedback
              </h3>
              <button
                onClick={() => {
                  if (!isSubmittingFeedback) {
                    setShowFeedbackModal(false);
                    setFeedbackContent('');
                  }
                }}
                className="p-1.5 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                }}
                disabled={isSubmittingFeedback}
              >
                <X size={18} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4">
              <p className="text-sm mb-4 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                We'd love to hear your thoughts! Please share your feedback (10-3500 characters).
              </p>
              <textarea
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder="Enter your feedback here..."
                className="w-full px-4 py-3 rounded-lg border-none outline-none transition-colors duration-300 text-sm resize-none feedback-textarea-scrollbar"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#111827',
                  minHeight: '120px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
                rows={6}
                maxLength={3500}
                disabled={isSubmittingFeedback}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs transition-colors duration-300"
                  style={{ 
                    color: feedbackContent.length < 10 || feedbackContent.length > 3500 
                      ? '#ef4444' 
                      : theme === 'dark' ? '#9ca3af' : '#6b7280' 
                  }}>
                  {feedbackContent.length < 10 
                    ? `Minimum 10 characters (${feedbackContent.length}/10)`
                    : `${feedbackContent.length}/3500 characters`
                  }
                </p>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 flex gap-3 border-t transition-colors duration-300"
              style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
              <button
                onClick={() => {
                  if (!isSubmittingFeedback) {
                    setShowFeedbackModal(false);
                    setFeedbackContent('');
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                }}
                disabled={isSubmittingFeedback}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback || feedbackContent.trim().length < 10 || feedbackContent.length > 3500}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: '#f1d08c',
                  color: '#000000',
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#e8c377';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#f1d08c';
                  }
                }}
              >
                {isSubmittingFeedback ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Confirmation Modal */}
      {showFeedbackConfirmation && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
            onClick={() => setShowFeedbackConfirmation(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)' }}>
                <Check size={32} style={{ color: '#22c55e' }} />
              </div>
              <h3 className="text-xl font-semibold mb-2 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Thank You! 🎉
              </h3>
              <p className="text-sm mb-6 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Your feedback has been submitted successfully. We appreciate your input!
              </p>
              <button
                onClick={() => setShowFeedbackConfirmation(false)}
                className="w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: '#f1d08c',
                  color: '#000000',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Feedback textarea scrollbar - faded dark */
        .feedback-textarea-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
        }
        
        .feedback-textarea-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .feedback-textarea-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 4px;
        }
        
        .feedback-textarea-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
          transition: background 0.2s ease;
        }
        
        .feedback-textarea-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.5);
        }
        
        /* Dark theme - slightly lighter for visibility */
        [data-theme="dark"] .feedback-textarea-scrollbar,
        body[data-theme="dark"] .feedback-textarea-scrollbar {
          scrollbar-color: rgba(75, 85, 99, 0.4) transparent;
        }
        
        [data-theme="dark"] .feedback-textarea-scrollbar::-webkit-scrollbar-thumb,
        body[data-theme="dark"] .feedback-textarea-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.4);
        }
        
        [data-theme="dark"] .feedback-textarea-scrollbar::-webkit-scrollbar-thumb:hover,
        body[data-theme="dark"] .feedback-textarea-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.6);
        }
      `}</style>
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcutsModal}
        onClose={() => setShowKeyboardShortcutsModal(false)}
        theme={theme}
      />
    </>
  );
}
