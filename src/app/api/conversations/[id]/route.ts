import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { conversationDb, userDb } from '@/lib/db';

// GET /api/conversations/[id] - Get a single conversation with messages
export async function GET(
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

    const conversation = await conversationDb.getConversation(id, dbUser.id);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations/[id] - Update conversation (rename)
export async function PATCH(
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

    const body = await request.json();
    const { title, folder_id, is_archived } = body;

    let conversation;

    // Update title if provided
    if (title) {
      if (!title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      conversation = await conversationDb.updateConversationTitle(
        id,
        dbUser.id,
        title
      );
    }

    // Update folder if provided
    if (folder_id !== undefined) {
      conversation = await conversationDb.updateConversationFolder(
        id,
        dbUser.id,
        folder_id
      );
      
      // If folder was updated but conversation is null, try to fetch it
      if (!conversation) {
        conversation = await conversationDb.getConversation(id, dbUser.id);
      }
    }

    // Update archive status if provided
    if (is_archived !== undefined) {
      conversation = await conversationDb.archiveConversation(
        id,
        dbUser.id,
        is_archived
      );
      
      // If archive was updated but conversation is null, try to fetch it
      if (!conversation) {
        conversation = await conversationDb.getConversation(id, dbUser.id);
      }
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Ensure folder_id is included in response (even if null)
    const responseData = {
      ...conversation,
      folder_id: conversation.folder_id || null
    };

    return NextResponse.json({ conversation: responseData }, { status: 200 });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id] - Delete a conversation
export async function DELETE(
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

    await conversationDb.deleteConversation(id, dbUser.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
