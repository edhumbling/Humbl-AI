import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Primary model configuration
const PRIMARY_MODEL = {
  model: "meta-llama/llama-4-maverick-17b-128e-instruct",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 1,
  stream: true,
  stop: null
};

// Fallback model configuration
const FALLBACK_MODEL = {
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 0.95,
  reasoning_effort: "default",
  stream: true,
  stop: null
};

async function tryModel(modelConfig: any, query: string, controller: ReadableStreamDefaultController, images: string[]) {
  try {
    const userContent: any[] = [];
    if (query) {
      userContent.push({ type: "text", text: query });
    }
    for (const img of (images || []).slice(0, 4)) {
      userContent.push({ type: "image_url", image_url: { url: img } });
    }

    const stream = client.chat.completions.create({
      ...modelConfig,
      messages: [
        {
          role: "system",
          content: "You are Humbl AI, a powerful search engine assistant. Help users find relevant information and provide comprehensive, accurate answers to their queries. Be concise but thorough in your responses."
        },
        {
          role: "user",
          content: userContent.length > 0 ? userContent : [{ type: "text", text: query }]
        }
      ]
    });

    // Handle streaming response according to Groq documentation
    // Await the stream first, then iterate through completion deltas
    const streamResult = await stream;
    for await (const chunk of streamResult as any) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
      }
    }

    // Send completion signal
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
    controller.close();
    return true;
  } catch (error: any) {
    console.error('Model error:', error);
    
    // Check for specific error codes that should trigger fallback
    if (error.status === 400 || error.status === 429 || error.status === 403) {
      console.log(`Primary model failed with status ${error.status}, trying fallback...`);
      return false; // Indicate fallback should be tried
    }
    
    // For other errors, throw to be handled by outer catch
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, images, mode } = await request.json();

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
          // Web search mode: use Compound systems and include citations (non-stream for metadata)
          if (mode === 'search') {
            try {
              const completion = await client.chat.completions.create({
                model: 'groq/compound',
                messages: [
                  { role: 'system', content: 'You are Humbl AI. Use web search when helpful and include concise citations.' },
                  { role: 'user', content: query }
                ],
                stream: false
              });
              const choice: any = (completion as any).choices?.[0]?.message;
              const content = choice?.content || '';
              const executed = choice?.executed_tools?.[0]?.search_results || [];
              const citations = executed.map((r: any) => ({ title: r.title, url: r.url })).slice(0, 10);
              if (content) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ citations, done: true })}\n\n`));
              controller.close();
              return;
            } catch (primaryErr) {
              try {
                const completion = await client.chat.completions.create({
                  model: 'groq/compound-mini',
                  messages: [
                    { role: 'system', content: 'You are Humbl AI. Use web search when helpful and include concise citations.' },
                    { role: 'user', content: query }
                  ],
                  stream: false
                });
                const choice: any = (completion as any).choices?.[0]?.message;
                const content = choice?.content || '';
                const executed = choice?.executed_tools?.[0]?.search_results || [];
                const citations = executed.map((r: any) => ({ title: r.title, url: r.url })).slice(0, 10);
                if (content) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ citations, done: true })}\n\n`));
                controller.close();
                return;
              } catch (fallbackErr) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Web search failed. Please try again.' })}\n\n`));
                controller.close();
                return;
              }
            }
          }

          // Default streaming flow (images supported)
          const primarySuccess = await tryModel(PRIMARY_MODEL, query, controller, Array.isArray(images) ? images.slice(0,4) : []);
          
          if (!primarySuccess) {
            // If primary failed with 400/429/403, try fallback model
            console.log('Attempting fallback model...');
            await tryModel(FALLBACK_MODEL, query, controller, Array.isArray(images) ? images.slice(0,4) : []);
          }
        } catch (error) {
          console.error('All models failed:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' })}\n\n`));
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
