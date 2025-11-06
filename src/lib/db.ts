// Database connection utility for Neon PostgreSQL
import { Pool } from '@neondatabase/serverless';

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({ connectionString });
  }

  return pool;
}

// Helper function to execute queries
export async function query(text: string, params?: any[]) {
  const db = getDb();
  return db.query(text, params);
}

// Conversation database operations
export const conversationDb = {
  // Get all conversations for a user
  async getUserConversations(userId: string) {
    const result = await query(
      `SELECT c.* FROM conversation_summaries c
       WHERE c.user_id = $1 AND c.is_archived = FALSE 
       AND NOT EXISTS (
         SELECT 1 FROM message_shares ms WHERE ms.conversation_id = c.id
       )
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return result.rows;
  },

  // Get a single conversation with messages
  async getConversation(conversationId: string, userId: string) {
    const convResult = await query(
      `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convResult.rows.length === 0) {
      return null;
    }

    const messagesResult = await query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      ...convResult.rows[0],
      messages: messagesResult.rows,
    };
  },

  // Get a conversation publicly (no user check)
  async getConversationPublic(conversationId: string) {
    const convResult = await query(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return null;
    }

    const messagesResult = await query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      ...convResult.rows[0],
      messages: messagesResult.rows,
    };
  },

  // Create a new conversation
  async createConversation(userId: string, title: string = 'New Conversation') {
    const result = await query(
      `INSERT INTO conversations (user_id, title) 
       VALUES ($1, $2) 
       RETURNING *`,
      [userId, title]
    );
    return result.rows[0];
  },

  // Update conversation title
  async updateConversationTitle(conversationId: string, userId: string, title: string) {
    const result = await query(
      `UPDATE conversations 
       SET title = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [title, conversationId, userId]
    );
    return result.rows[0];
  },

  // Update conversation folder
  async updateConversationFolder(conversationId: string, userId: string, folderId: string | null) {
    const result = await query(
      `UPDATE conversations 
       SET folder_id = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [folderId, conversationId, userId]
    );
    return result.rows[0];
  },

  // Delete a conversation
  async deleteConversation(conversationId: string, userId: string) {
    await query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
  },

  // Archive a conversation
  async archiveConversation(conversationId: string, userId: string, isArchived: boolean = true) {
    const result = await query(
      `UPDATE conversations 
       SET is_archived = $3 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [conversationId, userId, isArchived]
    );
    return result.rows[0];
  },

  // Get archived conversations for a user
  async getArchivedConversations(userId: string) {
    const result = await query(
      `SELECT c.* FROM conversation_summaries c
       WHERE c.user_id = $1 AND c.is_archived = TRUE 
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return result.rows;
  },

  // Add a message to a conversation
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    images: string[] = [],
    citations: any[] = [],
    mode: string = 'default'
  ) {
    const result = await query(
      `INSERT INTO messages (conversation_id, role, content, images, citations, mode) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [conversationId, role, content, JSON.stringify(images), JSON.stringify(citations), mode]
    );

    // Update conversation's updated_at timestamp
    await query(
      `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );

    return result.rows[0];
  },

  // Auto-generate title from first message
  async generateTitleFromFirstMessage(conversationId: string, firstMessage: string) {
    const result = await query(
      `UPDATE conversations 
       SET title = generate_conversation_title($1) 
       WHERE id = $2 
       RETURNING *`,
      [firstMessage, conversationId]
    );
    return result.rows[0];
  },
};

// Folder database operations
export const folderDb = {
  // Get all folders for a user
  async getUserFolders(userId: string) {
    const result = await query(
      `SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  },

  // Get a single folder
  async getFolder(folderId: string, userId: string) {
    const result = await query(
      `SELECT * FROM folders WHERE id = $1 AND user_id = $2`,
      [folderId, userId]
    );
    return result.rows[0];
  },

  // Create a new folder
  async createFolder(userId: string, name: string) {
    const result = await query(
      `INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING *`,
      [userId, name]
    );
    return result.rows[0];
  },

  // Update folder name
  async updateFolderName(folderId: string, userId: string, name: string) {
    const result = await query(
      `UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name, folderId, userId]
    );
    return result.rows[0];
  },

  // Delete a folder
  async deleteFolder(folderId: string, userId: string) {
    await query(
      `DELETE FROM folders WHERE id = $1 AND user_id = $2`,
      [folderId, userId]
    );
  },
};

// User database operations
export const userDb = {
  // Create or update user from Stack Auth
  async upsertUser(stackUserId: string, email: string, displayName?: string, avatarUrl?: string) {
    const result = await query(
      `INSERT INTO users (stack_user_id, email, display_name, avatar_url, last_login)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (stack_user_id) 
       DO UPDATE SET 
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         avatar_url = EXCLUDED.avatar_url,
         last_login = CURRENT_TIMESTAMP
       RETURNING *`,
      [stackUserId, email, displayName || null, avatarUrl || null]
    );
    return result.rows[0];
  },

  // Get user by Stack Auth ID
  async getUserByStackId(stackUserId: string) {
    const result = await query(
      `SELECT * FROM users WHERE stack_user_id = $1`,
      [stackUserId]
    );
    return result.rows[0];
  },

  // Get user by internal ID
  async getUserById(userId: string) {
    const result = await query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0];
  },
};

// Message vote operations
export const voteDb = {
  // Upsert a user's vote for a message
  async upsertVote(userId: string, conversationId: string, messageId: string, vote: -1 | 1) {
    const result = await query(
      `INSERT INTO message_votes (user_id, conversation_id, message_id, vote)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, message_id)
       DO UPDATE SET vote = EXCLUDED.vote, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, conversationId, messageId, vote]
    );
    return result.rows[0];
  },

  // Get aggregate counts for a message
  async getMessageVoteCounts(messageId: string) {
    const result = await query(
      `SELECT 
         SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvotes,
         SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvotes
       FROM message_votes
       WHERE message_id = $1`,
      [messageId]
    );
    const row = result.rows[0] || { upvotes: 0, downvotes: 0 };
    return {
      upvotes: Number(row.upvotes || 0),
      downvotes: Number(row.downvotes || 0),
    };
  },

  // Get a single user's vote for a message
  async getUserVoteForMessage(userId: string, messageId: string) {
    const result = await query(
      `SELECT vote FROM message_votes WHERE user_id = $1 AND message_id = $2 LIMIT 1`,
      [userId, messageId]
    );
    return result.rows[0]?.vote as -1 | 1 | undefined;
  },
};
