import { NextRequest, NextResponse } from 'next/server';
import { conversationDb } from '@/lib/db';

// GET /api/conversations/[id]/public - Get a conversation publicly (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch conversation without user check (public access)
    const result = await conversationDb.getConversationPublic(id);
    
    if (!result) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation: result }, { status: 200 });
  } catch (error) {
    console.error('Error fetching public conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

