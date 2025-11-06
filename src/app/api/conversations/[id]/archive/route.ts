import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { conversationDb, userDb } from '@/lib/db';

// POST /api/conversations/[id]/archive - Archive a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const conversation = await conversationDb.archiveConversation(id, dbUser.id);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, conversation }, { status: 200 });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to archive conversation' },
      { status: 500 }
    );
  }
}

