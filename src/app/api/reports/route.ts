import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { userDb, query } from '@/lib/db';

// POST /api/reports - Create a new report
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

    const body = await request.json();
    const { conversationId, category, subCategory, details } = body;

    if (!conversationId || !category || !subCategory || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert report into database
    const result = await query(
      `INSERT INTO reports (user_id, conversation_id, category, sub_category, details, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [dbUser.id, conversationId, category, subCategory, details]
    );

    return NextResponse.json(
      { success: true, report: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

// GET /api/reports - Get all reports (admin only - optional)
export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return empty array. Can be extended for admin access later
    return NextResponse.json({ reports: [] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

