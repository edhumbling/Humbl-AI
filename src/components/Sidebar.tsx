'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, MoreVertical, Pencil, Trash2, LogOut, LogIn, UserPlus, User, Settings, Search, Folder, ChevronDown, ChevronRight, FolderPlus, Check, Sun, Moon, Info, Archive, Hexagon, RefreshCw, HelpCircle } from 'lucide-react';
import Image from 'next/image';
import FolderList from './FolderList';

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
  const sidebarRef = useRef<HTMLDivElement>(null);
  
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

  // Handle click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close sidebar if any modal is open
      if (showCreateFolderModal || showMoveToProjectModal || showDeleteProjectModal || showAddChatsToFolderModal || showFeedbackModal || showFeedbackConfirmation) {
        return;
      }
      
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Add a small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, showCreateFolderModal, showMoveToProjectModal, showDeleteProjectModal, showAddChatsToFolderModal]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen && !showCreateFolderModal && !showMoveToProjectModal && !showDeleteProjectModal && !showAddChatsToFolderModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
        }}
        onClick={() => {
          // Don't close sidebar if any modal is open
          if (!showCreateFolderModal && !showMoveToProjectModal && !showDeleteProjectModal && !showAddChatsToFolderModal) {
            onClose();
          }
        }}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-2/3 sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? '#151514' : '#ffffff',
        }}
      >
        {/* Logo with Close Button */}
        <div className="flex items-center justify-between py-4 px-5 transition-colors duration-300">
          <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-8 w-auto opacity-90" />
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
        </div>

        {/* Top bar with New Conversation */}
        {user && (
          <div className="px-5 py-3">
            <button
              onClick={() => {
                onNewConversation();
                onClose();
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
              <span className="text-sm font-medium">Start New Conversation</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        {user && (
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
                className="w-full pl-10 pr-3 py-2 rounded-lg border-none outline-none transition-colors duration-300 text-sm"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.4)' : 'rgba(229, 231, 235, 0.8)',
                  color: theme === 'dark' ? '#e5e7eb' : '#111827',
                }}
              />
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
          {user ? (
            filteredConversations.length === 0 ? (
              <div
                className="text-center py-8 text-sm"
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
                          <span className="text-xs font-semibold uppercase transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
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
                    <div key={period} className="mt-4">
                      <h3
                        className="text-xs font-semibold mb-2 px-2 uppercase tracking-wide"
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
                              className="w-full text-left py-2 pr-8 transition-opacity duration-200 hover:opacity-70"
                            >
                              <p
                                className={`text-sm sm:text-base font-medium truncate transition-colors duration-300 ${
                                  currentConversationId === conversation.id 
                                    ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'
                                    : theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                                }`}
                              >
                                {conversation.title}
                              </p>
                              <p
                                className="text-xs transition-colors duration-300"
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
            <div className="space-y-4 pt-8 px-4">
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
          )}
        </div>

        {/* Archive Section */}
        {user && archivedConversations.length > 0 && !searchQuery.trim() && (
          <div className="px-4 pb-2 border-t transition-colors duration-300"
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
                <span className="text-xs font-semibold uppercase transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
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
                    className="w-full text-left py-2 pr-8 transition-opacity duration-200 hover:opacity-70"
                  >
                    <p
                      className={`text-sm sm:text-base font-medium truncate transition-colors duration-300 ${
                        currentConversationId === conversation.id 
                          ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      {conversation.title}
                    </p>
                    <p
                      className="text-xs transition-colors duration-300"
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

        {/* User Profile Section (Bottom) */}
        {user && (
          <div
            className="border-t p-4 transition-colors duration-300"
            style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
          >
            <div className="relative">
                <button
                  data-menu-trigger="settings"
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowSearchMenu(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                  }}
                >
                  {user.profileImageUrl ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={user.displayName || user.primaryEmail || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#f1d08c' }}
                    >
                      <User size={20} className="text-black" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-sm font-medium truncate transition-colors duration-300"
                      style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                    >
                      {user.displayName || 'User'}
                    </p>
                    <p
                      className="text-xs truncate transition-colors duration-300"
                      style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                    >
                      {user.primaryEmail}
                    </p>
                  </div>
                  <Settings size={18} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }} />
                </button>

                {/* Account menu dropdown */}
                {showUserMenu && (
                  <div
                    data-menu-dropdown
                    className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg overflow-hidden min-w-[220px] z-50"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                    }}
                  >
                    {/* Account Email */}
                    <div className="w-full flex items-center space-x-2 px-4 py-3 text-sm"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                      <User size={16} />
                      <span className="truncate">{user.primaryEmail}</span>
                    </div>

                    {/* Upgrade plan */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // TODO: Add upgrade plan functionality
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
                      <div className="relative">
                        <Hexagon size={16} fill="currentColor" />
                        <Plus size={10} className="absolute inset-0 m-auto" style={{ strokeWidth: 2.5 }} />
                      </div>
                      <span>Upgrade plan</span>
                    </button>

                    {/* Personalization */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // TODO: Add personalization functionality
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
                      <RefreshCw size={16} />
                      <span>Personalization</span>
                    </button>

                    {/* Settings */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // TODO: Add settings functionality
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
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>

                    {/* Separator */}
                    <div
                      className="w-full h-px my-1"
                      style={{ backgroundColor: theme === 'dark' ? '#3a3a39' : '#e5e7eb' }}
                    />

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
                            className="hidden sm:block absolute left-full top-0 ml-2 rounded-lg overflow-hidden shadow-lg z-[60] min-w-[180px]"
                            style={{
                              backgroundColor: theme === 'dark' ? '#2a2a29' : '#f9fafb',
                              border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                            }}
                          >
                            <button
                              onClick={() => {
                                onShowInfo();
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
                              <Info size={14} />
                              <span>Developer Info</span>
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
                              <MessageSquare size={14} />
                              <span>Send feedback</span>
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
                                onShowInfo();
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
                              <Info size={14} />
                              <span>Developer Info</span>
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
                              <MessageSquare size={14} />
                              <span>Send feedback</span>
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
    </>
  );
}
