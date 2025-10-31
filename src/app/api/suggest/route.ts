import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    if (!q) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    // Proxy Google suggestions (Firefox client returns simple JSONP-like array)
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
    const data = await res.json();
    const suggestions = Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}


