import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { conversationDb, userDb } from '@/lib/db';

// GET /api/conversations/archived - Get all archived conversations for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const conversations = await conversationDb.getArchivedConversations(dbUser.id);
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archived conversations' },
      { status: 500 }
    );
  }
}

