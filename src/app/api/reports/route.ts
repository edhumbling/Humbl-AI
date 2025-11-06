import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { query, userDb } from '@/lib/db';

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user in our database
    const dbUser = await userDb.upsertUser(
      user.id,
      user.primaryEmail || '',
      user.displayName || undefined,
      user.profileImageUrl || undefined
    );

    const { conversationId, category, subCategory, details } = await request.json();

    if (!conversationId || !category) {
      return NextResponse.json(
        { error: 'Conversation ID and category are required' },
        { status: 400 }
      );
    }

    // Create the report
    const result = await query(
      `INSERT INTO reports (user_id, conversation_id, category, sub_category, details, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [dbUser.id, conversationId, category, subCategory || null, details || null]
    );

    return NextResponse.json({ report: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}
