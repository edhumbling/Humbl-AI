import { NextRequest, NextResponse } from 'next/server';
import { conversationDb, userDb } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

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
        isOwner = dbUser.id === result.user_id;
      }
    } catch (e) {
      // User not logged in or error fetching user - that's fine, isOwner stays false
    }

    return NextResponse.json({ 
      conversation: result,
      isOwner 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching public conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

