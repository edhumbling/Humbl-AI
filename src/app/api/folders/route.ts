import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { folderDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const dbUser = await (await import('@/lib/db')).userDb.getUserByStackId(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch all folders for the user
    const folders = await folderDb.getUserFolders(dbUser.id);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const dbUser = await (await import('@/lib/db')).userDb.getUserByStackId(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    if (name.length > 200) {
      return NextResponse.json({ error: 'Folder name is too long' }, { status: 400 });
    }

    // Create new folder
    const folder = await folderDb.createFolder(dbUser.id, name.trim());

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('Failed to create folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

