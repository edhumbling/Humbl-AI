import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, query, userDb } from '@/lib/db';
import { stackServerApp } from '@/stack/server';
import { v4 as uuidv4 } from 'uuid';

// POST /api/message-shares - Create a message share (conversation starting from a specific message)
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user in our database
    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const { conversationId, messageIndex } = await request.json();
    
    if (!conversationId || typeof messageIndex !== 'number') {
      return NextResponse.json({ error: 'Conversation ID and message index are required' }, { status: 400 });
    }

    // Get the conversation
    const conversation = await conversationDb.getConversation(conversationId, dbUser.id);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages from the conversation
    const messagesResult = await query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );

    const messages = messagesResult.rows;
    
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return NextResponse.json({ error: 'Invalid message index' }, { status: 400 });
    }

    // The message at messageIndex should be an AI message
    const targetMessage = messages[messageIndex];
    if (targetMessage.role !== 'assistant') {
      return NextResponse.json({ error: 'Can only share AI messages' }, { status: 400 });
    }

    // Get all messages from this point forward (including the user message before this AI response)
    const shareMessages = messages.slice(Math.max(0, messageIndex - 1)); // Include user message before AI response
    
    // Create a new conversation for the share
    const shareId = uuidv4();
    const shareTitle = shareMessages[0]?.content?.substring(0, 50) || 'Shared Message';
    
    // Create the share conversation
    await query(
      `INSERT INTO conversations (id, user_id, title, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [shareId, dbUser.id, `Shared: ${shareTitle}`]
    );

    // Copy messages to the share conversation
    for (const msg of shareMessages) {
      await query(
        `INSERT INTO messages (id, conversation_id, role, content, images, citations, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          shareId,
          msg.role,
          msg.content || '',
          JSON.stringify(msg.images || []),
          JSON.stringify(msg.citations || [])
        ]
      );
    }

    // Generate unique ID for the share link (t_ prefix)
    const shareLinkId = `t_${shareId.replace(/-/g, '')}`;
    
    // Store the mapping in a new table or use an existing mechanism
    // For now, we'll use a simple approach: store it in a message_shares table
    await query(
      `CREATE TABLE IF NOT EXISTS message_shares (
        id TEXT PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    );

    await query(
      `INSERT INTO message_shares (id, conversation_id, message_index) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [shareLinkId, shareId, 0]
    );

    return NextResponse.json({ 
      shareId: shareLinkId,
      conversationId: shareId 
    }, { status: 200 });
  } catch (error) {
    console.error('Error creating message share:', error);
    return NextResponse.json(
      { error: 'Failed to create message share' },
      { status: 500 }
    );
  }
}


