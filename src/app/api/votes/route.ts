import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { conversationDb, query, userDb, voteDb } from '@/lib/db';

// POST /api/votes - Upsert a vote for a message by conversationId and messageIndex
export async function POST(request: NextRequest) {
  try {
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

    const { conversationId, messageIndex, vote } = await request.json();

    if (!conversationId || typeof messageIndex !== 'number' || !["up", "down"].includes(vote)) {
      return NextResponse.json({ error: 'conversationId, messageIndex and vote ("up"|"down") are required' }, { status: 400 });
    }

    // Ensure the conversation is accessible to the user (owned or public)
    const conv = await conversationDb.getConversation(conversationId, dbUser.id);
    if (!conv) {
      // Fallback: allow voting on public share as well
      const publicConv = await conversationDb.getConversationPublic(conversationId);
      if (!publicConv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // Fetch ordered messages and resolve the target message id
    const messagesResult = await query(
      `SELECT id, role FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
    const messages = messagesResult.rows;
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return NextResponse.json({ error: 'Invalid message index' }, { status: 400 });
    }

    const target = messages[messageIndex];
    const messageId: string = target.id;

    const numericVote: -1 | 1 = vote === 'up' ? 1 : -1;
    const saved = await voteDb.upsertVote(dbUser.id, conversationId, messageId, numericVote);
    const counts = await voteDb.getMessageVoteCounts(messageId);

    return NextResponse.json({
      vote: saved.vote,
      counts,
      messageId,
    }, { status: 200 });
  } catch (error) {
    console.error('Error saving vote:', error);
    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 });
  }
}


