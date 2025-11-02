'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MessageSquare, MoreVertical, Pencil, Trash2, LogOut, LogIn, UserPlus, User } from 'lucide-react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Fetch conversations when sidebar opens and user is logged in
  useEffect(() => {
    if (isOpen && user) {
      fetchConversations();
    }
  }, [isOpen, user]);

  const fetchConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
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

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
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
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b transition-colors duration-300"
          style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
        >
          <h2
            className="text-lg font-semibold transition-colors duration-300"
            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
          >
            {user ? 'Conversations' : 'Menu'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors duration-300"
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
            <X size={20} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
          </button>
        </div>

        {/* New Conversation Button */}
        {user && (
          <div className="p-4">
            <button
              onClick={() => {
                onNewConversation();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{
                backgroundColor: '#f1d08c',
                color: '#000000',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8c377')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1d08c')}
            >
              <Plus size={20} />
              <span>New Conversation</span>
            </button>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {user ? (
            isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#f1d08c' }} />
              </div>
            ) : conversations.length === 0 ? (
              <div
                className="text-center py-8 text-sm"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
              >
                No conversations yet. Start a new one!
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative rounded-lg transition-all duration-200 ${
                    currentConversationId === conversation.id
                      ? 'ring-2'
                      : ''
                  }`}
                  style={{
                    backgroundColor:
                      currentConversationId === conversation.id
                        ? theme === 'dark'
                          ? '#1f1f1f'
                          : '#f3f4f6'
                        : theme === 'dark'
                        ? '#1a1a19'
                        : '#f9fafb',
                    '--tw-ring-color': currentConversationId === conversation.id ? '#f1d08c' : 'transparent',
                  } as React.CSSProperties}
                >
                  {editingId === conversation.id ? (
                    <div className="p-3">
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
                        className="w-full px-2 py-1 text-sm rounded border outline-none focus:ring-2 focus:ring-[#f1d08c] transition-colors duration-300"
                        style={{
                          backgroundColor: theme === 'dark' ? '#2a2a29' : '#ffffff',
                          borderColor: theme === 'dark' ? '#3a3a39' : '#d1d5db',
                          color: theme === 'dark' ? '#e5e7eb' : '#111827',
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectConversation(conversation.id);
                        onClose();
                      }}
                      className="w-full flex items-start space-x-3 p-3 text-left hover:bg-opacity-80 transition-all duration-200"
                    >
                      <MessageSquare
                        size={18}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate transition-colors duration-300"
                          style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                        >
                          {conversation.title}
                        </p>
                        <p
                          className="text-xs mt-1 transition-colors duration-300"
                          style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                        >
                          {formatDate(conversation.updated_at)} · {conversation.message_count} messages
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Three-dot menu */}
                  {editingId !== conversation.id && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === conversation.id ? null : conversation.id);
                        }}
                        className="p-1.5 rounded-lg transition-colors duration-200"
                        style={{
                          backgroundColor: theme === 'dark' ? '#2a2a29' : '#e5e7eb',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            theme === 'dark' ? '#3a3a39' : '#d1d5db')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            theme === 'dark' ? '#2a2a29' : '#e5e7eb')
                        }
                      >
                        <MoreVertical size={16} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
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
              ))
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
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
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
                  className="absolute bottom-full left-0 right-0 mb-2 rounded-lg shadow-lg overflow-hidden"
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
          </div>
        )}
      </div>
    </>
  );
}
