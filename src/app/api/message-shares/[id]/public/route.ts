import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, query } from '@/lib/db';

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

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (error) {
    console.error('Error fetching message share:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message share' },
      { status: 500 }
    );
  }
}


