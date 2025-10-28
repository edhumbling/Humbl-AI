import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || query.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Groq API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await client.chat.completions.create({
            model: "qwen/qwen3-32b",
            messages: [
              {
                role: "system",
                content: "You are Humbl AI, a powerful search engine assistant. Help users find relevant information and provide comprehensive, accurate answers to their queries. Be concise but thorough in your responses."
              },
              {
                role: "user",
                content: query
              }
            ],
            temperature: 0.6,
            max_completion_tokens: 4096,
            top_p: 0.95,
            reasoning_effort: "default",
            stream: true,
            stop: null
          });

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          // Send completion signal
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Failed to process search query' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Search API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process search query' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
