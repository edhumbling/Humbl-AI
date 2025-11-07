import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { query, userDb } from '@/lib/db';

// POST /api/feedback - Create a new feedback entry
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    // Allow anonymous feedback (user can be null)
    let dbUser = null;
    if (user) {
      // Get or create user in our database if authenticated
      dbUser = await userDb.upsertUser(
        user.id,
        user.primaryEmail || '',
        user.displayName || undefined,
        user.profileImageUrl || undefined
      );
    }

    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Feedback content is required' },
        { status: 400 }
      );
    }

    // Validate content length (10-3500 characters)
    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      return NextResponse.json(
        { error: 'Feedback must be at least 10 characters long' },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 3500) {
      return NextResponse.json(
        { error: 'Feedback must be no more than 3500 characters long' },
        { status: 400 }
      );
    }

    // Create the feedback entry
    const result = await query(
      `INSERT INTO feedback (user_id, content, status)
       VALUES ($1, $2, 'new')
       RETURNING *`,
      [dbUser?.id || null, trimmedContent]
    );

    return NextResponse.json({ feedback: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

