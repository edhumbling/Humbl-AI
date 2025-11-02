import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, userDb } from '@/lib/db';

// GET /api/conversations - Get all conversations for the current user
export async function GET(request: NextRequest) {
  try {
    // TODO: Get user from Stack Auth session
    // For now, return empty array if no auth
    const userId = request.headers.get('x-user-id'); // Placeholder
    
    if (!userId) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const conversations = await conversationDb.getUserConversations(userId);
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    // TODO: Get user from Stack Auth session
    const userId = request.headers.get('x-user-id'); // Placeholder
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title } = body;

    const conversation = await conversationDb.createConversation(
      userId,
      title || 'New Conversation'
    );

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
