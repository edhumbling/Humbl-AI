'use client';

import React from 'react';
import { Folder, ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2, FolderPlus } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
  folder_id?: string;
}

interface FolderListProps {
  folders: Folder[];
  conversations: Conversation[];
  expandedFolders: Set<string>;
  editingId: string | null;
  editTitle: string;
  folderMenuOpenId: string | null;
  theme: 'dark' | 'light';
  currentConversationId?: string;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onStartEditFolder: (folder: Folder) => void;
  onSetEditTitle: (title: string) => void;
  onSetEditingId: (id: string | null) => void;
  onSetFolderMenuOpen: (id: string | null) => void;
  onSelectConversation: (id: string) => void;
  onCreateNewProject: () => void;
  formatDate: (date: string) => string;
}

export default function FolderList({
  folders,
  conversations,
  expandedFolders,
  editingId,
  editTitle,
  folderMenuOpenId,
  theme,
  currentConversationId,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onStartEditFolder,
  onSetEditTitle,
  onSetEditingId,
  onSetFolderMenuOpen,
  onSelectConversation,
  onCreateNewProject,
  formatDate,
}: FolderListProps) {
  const [projectsExpanded, setProjectsExpanded] = React.useState(true);

  return (
    <div className="mb-4">
      {/* Projects Header */}
      <button
        onClick={() => setProjectsExpanded(!projectsExpanded)}
        className="w-full flex items-center justify-between px-2 py-2 transition-colors duration-300"
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = 'transparent')
        }
      >
        <span className="text-xs font-semibold uppercase transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
          Projects
        </span>
        {projectsExpanded ? (
          <ChevronDown size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
        ) : (
          <ChevronRight size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
        )}
      </button>

      {/* New Project Button */}
      {projectsExpanded && (
        <button
          onClick={onCreateNewProject}
          className="w-full flex items-center px-2 py-1.5 transition-colors duration-300"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'transparent')
          }
        >
          <FolderPlus size={14} style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
          <span className="ml-2 text-sm transition-colors duration-300" style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
            New project
          </span>
        </button>
      )}

      {/* Projects List */}
      {projectsExpanded && folders.length > 0 && (
        <div className="space-y-0.5">
          {folders.map((folder) => {
            const folderConversations = conversations.filter(conv => conv.folder_id === folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const isEditing = editingId === folder.id;

            return (
              <div key={folder.id} className="group">
                {isEditing ? (
                  <div className="px-2 py-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => onSetEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameFolder(folder.id, editTitle);
                        } else if (e.key === 'Escape') {
                          onSetEditingId(null);
                          onSetEditTitle('');
                        }
                      }}
                      onBlur={() => onRenameFolder(folder.id, editTitle)}
                      className="w-full px-2 py-1.5 text-sm border-none outline-none bg-transparent transition-colors duration-300"
                      style={{
                        color: theme === 'dark' ? '#e5e7eb' : '#111827',
                        borderBottom: `2px solid ${theme === 'dark' ? '#f1d08c' : '#e8c377'}`,
                      }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => onToggleFolder(folder.id)}
                      className="w-full flex items-center px-2 py-1.5 transition-colors duration-300 group-hover:bg-opacity-50"
                      style={{
                        backgroundColor: currentConversationId && folderConversations.some(c => c.id === currentConversationId)
                          ? (theme === 'dark' ? 'rgba(75, 85, 99, 0.4)' : 'rgba(209, 213, 219, 0.6)')
                          : 'transparent',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          currentConversationId && folderConversations.some(c => c.id === currentConversationId)
                            ? (theme === 'dark' ? 'rgba(75, 85, 99, 0.4)' : 'rgba(209, 213, 219, 0.6)')
                            : 'transparent')
                      }
                    >
                      <Folder size={14} style={{ color: theme === 'dark' ? '#f1d08c' : '#e8c377' }} />
                      <span
                        className="ml-2 text-sm truncate"
                        style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
                      >
                        {folder.name}
                      </span>
                    </button>

                    {/* Folder menu */}
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        data-menu-trigger="folder-menu"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetFolderMenuOpen(folderMenuOpenId === folder.id ? null : folder.id);
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
                        <MoreVertical size={14} />
                      </button>

                      {folderMenuOpenId === folder.id && (
                        <div
                          data-menu-dropdown
                          className="absolute right-0 mt-1 w-32 rounded-lg shadow-lg z-10 overflow-hidden"
                          style={{
                            backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
                            border: `1px solid ${theme === 'dark' ? '#3a3a39' : '#e5e7eb'}`,
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEditFolder(folder);
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
                            <Pencil size={12} />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFolder(folder.id);
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
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conversations in project */}
                {isExpanded && folderConversations.length > 0 && (
                  <div className="ml-4">
                    {folderConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => onSelectConversation(conversation.id)}
                        className="w-full text-left py-1 px-2 transition-opacity duration-200 hover:opacity-70"
                      >
                        <p
                          className={`text-xs font-medium truncate transition-colors duration-300 ${
                            currentConversationId === conversation.id
                              ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'
                              : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          {conversation.title}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
