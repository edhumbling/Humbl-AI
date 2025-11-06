import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, query, userDb } from '@/lib/db';
import { stackServerApp } from '@/stack/server';
import { v4 as uuidv4 } from 'uuid';

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

    // Get all messages up to and including the selected message
    const branchMessages = messages.slice(0, messageIndex + 1);
    
    // Create a new conversation for the branch
    const branchId = uuidv4();
    const branchTitle = branchMessages[0]?.content?.substring(0, 50) || 'Branched Conversation';
    
    // Create the branch conversation with parent reference
    await query(
      `INSERT INTO conversations (id, user_id, title, parent_conversation_id, parent_conversation_title, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [branchId, dbUser.id, `Branch · ${branchTitle}...`, conversationId, conversation.title]
    );

    // Copy messages to the branch conversation
    for (const msg of branchMessages) {
      await query(
        `INSERT INTO messages (id, conversation_id, role, content, images, citations, mode, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
        [
          branchId,
          msg.role,
          msg.content || '',
          JSON.stringify(msg.images || []),
          JSON.stringify(msg.citations || []),
          msg.mode || 'default'
        ]
      );
    }

    // Generate a WEB-style ID for the branch (similar to ChatGPT's format)
    const webId = `WEB:${branchId}`;

    return NextResponse.json({ 
      branchId: webId,
      conversationId: branchId 
    }, { status: 200 });
  } catch (error) {
    console.error('Error branching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to branch conversation' },
      { status: 500 }
    );
  }
}

