import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, query, userDb } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

// GET /api/message-shares/[id]/public - Get a message share publicly (no user check)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find the conversation_id from the share link ID
    const shareResult = await query(
      `SELECT conversation_id FROM message_shares WHERE id = $1`,
      [id]
    );

    if (shareResult.rows.length === 0) {
      return NextResponse.json({ error: 'Message share not found' }, { status: 404 });
    }

    const conversationId = shareResult.rows[0].conversation_id;
    
    // Get the conversation and its messages
    const conversation = await conversationDb.getConversationPublic(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check if current user owns this conversation (optional - user might not be logged in)
    let isOwner = false;
    try {
      const user = await stackServerApp.getUser();
      if (user) {
        const dbUser = await userDb.upsertUser(
          user.id,
          user.primaryEmail || '',
          user.displayName || undefined,
          user.profileImageUrl || undefined
        );
        isOwner = dbUser.id === conversation.user_id;
      }
    } catch (e) {
      // User not logged in or error fetching user - that's fine, isOwner stays false
    }

    return NextResponse.json({ 
      conversation,
      isOwner 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching message share:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message share' },
      { status: 500 }
    );
  }
}


