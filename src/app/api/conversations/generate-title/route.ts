import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/conversations/generate-title - Generate a title from user query and AI response
export async function POST(request: NextRequest) {
  try {
    const { query, aiResponse } = await request.json();

    if (!query || !aiResponse) {
      return NextResponse.json(
        { error: 'Query and AI response are required' },
        { status: 400 }
      );
    }

    // Use Groq to generate a short, descriptive title
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a title generator. Generate a short, concise title (3-8 words) for a conversation based on the user\'s query and the AI\'s response. Return ONLY the title, nothing else.'
        },
        {
          role: 'user',
          content: `User query: "${query}"\n\nAI response: "${aiResponse.substring(0, 200)}..."\n\nGenerate a short title for this conversation:`
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 20
    });

    const title = completion.choices[0]?.message?.content?.trim() || query.substring(0, 50);

    return NextResponse.json({ title }, { status: 200 });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}

