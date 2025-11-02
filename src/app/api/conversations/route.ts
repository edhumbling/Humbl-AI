import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { conversationDb, userDb } from '@/lib/db';

// GET /api/conversations - Get all conversations for the current user
export async function GET(request: NextRequest) {
  try {
    // Get user from Stack Auth session
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    // Get or create user in our database
    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const conversations = await conversationDb.getUserConversations(dbUser.id);
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
    // Get user from Stack Auth session
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get or create user in our database
    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const body = await request.json();
    const { title } = body;

    const conversation = await conversationDb.createConversation(
      dbUser.id,
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
