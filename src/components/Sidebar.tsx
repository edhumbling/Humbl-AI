'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, MoreVertical, Pencil, Trash2, LogOut, LogIn, UserPlus, User, Settings, Search } from 'lucide-react';
import Image from 'next/image';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  user: any; // Stack Auth user object
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  theme,
  user,
  onNewConversation,
  onSelectConversation,
  currentConversationId,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Fetch conversations when sidebar opens and user is logged in
  useEffect(() => {
    if (isOpen && user) {
      fetchConversations();
    }
  }, [isOpen, user]);

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

  const fetchConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        setFilteredConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
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

  const handleLogout = async () => {
    try {
      // @ts-ignore - signOut method exists on user object
      await user?.signOut({ redirectUrl: '/' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
  }, [isOpen, onClose]);

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
    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
      'Earlier': []
    };

    convs.forEach(conv => {
      const date = new Date(conv.updated_at);
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      const diffInDays = diffInHours / 24;
      const diffInWeeks = diffInDays / 7;
      const diffInMonths = diffInDays / 30;

      if (diffInHours < 24) {
        groups['Today'].push(conv);
      } else if (diffInHours < 48) {
        groups['Yesterday'].push(conv);
      } else if (diffInDays < 7) {
        groups['This Week'].push(conv);
      } else if (diffInMonths < 1) {
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
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
        }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? '#151514' : '#ffffff',
        }}
      >
        {/* Top bar with New Conversation and Close */}
        {user && (
          <div className="flex items-center justify-between px-5 py-3">
            <button
              onClick={() => {
                onNewConversation();
                onClose();
              }}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-[1.02]"
              style={{
                backgroundColor: '#f1d08c',
                color: '#000000',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
            >
              <Pencil size={16} />
              <span className="text-sm font-medium">New Conversation</span>
            </button>
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
        )}
        
        {!user && (
          <div className="flex justify-end px-5 py-3">
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
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {user ? (
            isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#f1d08c' }} />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div
                className="text-center py-8 text-sm"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
              >
                {searchQuery.trim() ? 'No conversations found' : 'No conversations yet. Start a new one!'}
              </div>
            ) : (
              (() => {
                const grouped = groupConversationsByTime(filteredConversations);
                const timePeriods = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
                
                return timePeriods.map((period) => {
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
                              className="w-full text-left py-2 transition-opacity duration-200 hover:opacity-70"
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
                });
              })()
            )
          ) : (
            /* Not logged in - show login/signup buttons */
            <div className="space-y-3 pt-4">
              <button
                onClick={() => {
                  window.location.href = '/handler/login';
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
                <LogIn size={20} style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151' }} />
                <span
                  className="text-base transition-colors duration-300"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                >
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

        {/* User Profile Section (Bottom) */}
        {user && (
          <div
            className="border-t p-4 transition-colors duration-300"
            style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <button
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
                </button>

                {/* User menu dropdown */}
                {showUserMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-2 rounded-lg shadow-lg overflow-hidden w-full"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                    }}
                  >
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-red-500 transition-colors duration-200"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          theme === 'dark' ? '#2a2a29' : '#f3f4f6')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Settings button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSearchMenu(!showSearchMenu);
                    setShowUserMenu(false);
                  }}
                  className="p-3 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#f3f4f6',
                  }}
                  title="More options"
                >
                  <Settings size={20} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }} />
                </button>

                {/* Search menu dropdown */}
                {showSearchMenu && (
                  <div
                    className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg overflow-hidden min-w-[180px]"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                    }}
                  >
                    <button
                      onClick={handleLogout}
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
                      <span>Logout</span>
                    </button>
                    <button
                      onClick={() => {
                        const phoneNumber = '233208705290';
                        const message = encodeURIComponent('Feedback from Humbl AI: ');
                        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                        window.open(whatsappUrl, '_blank');
                        setShowSearchMenu(false);
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
                      <MessageSquare size={16} />
                      <span>Send feedback</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
