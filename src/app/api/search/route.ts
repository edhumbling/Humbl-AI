import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Vision models for image analysis
const VISION_SCOUT = {
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 1,
  max_completion_tokens: 4096,
  top_p: 1,
  stream: true,
  stop: null
};

const VISION_MAVERICK = {
  model: "meta-llama/llama-4-maverick-17b-128e-instruct",
  temperature: 1,
  max_completion_tokens: 4096,
  top_p: 1,
  stream: true,
  stop: null
};

// Primary model configuration (Kimi Instruct)
const PRIMARY_MODEL = {
  model: "moonshotai/kimi-k2-instruct-0905",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 1,
  stream: true,
  stop: null
};

// Fallback model configuration (Qwen - previously primary)
const QWEN_FALLBACK = {
  model: "qwen/qwen3-32b",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 0.95,
  reasoning_effort: "default" as any,
  stream: true,
  stop: null
};

// Secondary fallback model configuration
const FALLBACK_MODEL = {
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 0.95,
  reasoning_effort: "default",
  stream: true,
  stop: null
};

// Secondary fallback: Open-source safeguard model
const SAFEGUARD_FALLBACK = {
  model: "openai/gpt-oss-safeguard-20b",
  temperature: 1,
  max_completion_tokens: 8192,
  top_p: 1,
  reasoning_effort: "medium" as any,
  stream: true,
  stop: null
};

// Additional OSS 20B fallback (non-safeguard)
const OSS20B_FALLBACK = {
  model: "openai/gpt-oss-20b",
  temperature: 1,
  max_completion_tokens: 8192,
  top_p: 1,
  reasoning_effort: "medium" as any,
  stream: true,
  stop: null
};

// GPT OSS 120B fallback
const OSS120B_FALLBACK = {
  model: "openai/gpt-oss-120b",
  temperature: 1,
  max_completion_tokens: 8192,
  top_p: 1,
  reasoning_effort: "medium" as any,
  stream: true,
  stop: null
};

// Additional fallback: Llama 3.3 70B Versatile
const VERSATILE_FALLBACK = {
  model: "llama-3.3-70b-versatile",
  temperature: 1,
  max_completion_tokens: 1024,
  top_p: 1,
  stream: true,
  stop: null
};

// Lightweight instant fallback: Llama 3.1 8B
const INSTANT_FALLBACK = {
  model: "llama-3.1-8b-instant",
  temperature: 1,
  max_completion_tokens: 1024,
  top_p: 1,
  stream: true,
  stop: null
};

// Prompt guard model (non-streaming, minimal tokens) as a final fallback/safety responder
const PROMPT_GUARD_FALLBACK = {
  model: "meta-llama/llama-prompt-guard-2-22m",
  temperature: 1,
  max_completion_tokens: 1,
  top_p: 1,
  stream: false,
  stop: null
};

// Detect if query is code/calculation related
function isCodeRelatedQuery(query: string): boolean {
  const codeKeywords = [
    'calculate', 'computation', 'compute', 'solve', 'formula', 'equation',
    'python', 'code', 'program', 'function', 'algorithm', 'debug', 'error',
    'math', 'mathematical', 'statistics', 'percentage', 'square root', 'sqrt',
    'loan', 'interest', 'payment', 'convert', 'parse', 'execute', 'run code',
    'will this code', 'does this code', 'check if code', 'test code', 'fix code'
  ];
  const lowerQuery = query.toLowerCase();
  return codeKeywords.some(keyword => lowerQuery.includes(keyword));
}

// Code execution models
const CODE_COMPOUND_MINI = {
  model: "groq/compound-mini",
  temperature: 0.6,
  max_completion_tokens: 4096,
  stream: true,
  stop: null
};

const CODE_COMPOUND = {
  model: "groq/compound",
  temperature: 0.6,
  max_completion_tokens: 4096,
  stream: true,
  stop: null
};

const CODE_OSS_20B = {
  model: "openai/gpt-oss-20b",
  temperature: 0.6,
  max_completion_tokens: 4096,
  top_p: 1,
  stream: true,
  stop: null,
  tool_choice: "required" as any,
  tools: [{ type: "code_interpreter" }] as any
};

// Try code execution model with special handling
async function tryCodeExecutionModel(modelConfig: any, query: string, controller: ReadableStreamDefaultController, images: string[], conversationHistory: any[] = []) {
  try {
    const userContent: any[] = [];
    if (query) {
      userContent.push({ type: "text", text: query });
    }
    for (const img of (images || []).slice(0, 5)) {
      userContent.push({ type: "image_url", image_url: { url: img } });
    }

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content: "You are Humbl AI, a powerful assistant with code execution capabilities. When computational problems or code-related queries arise, use code execution to provide accurate results. Show both the code you used and the final answer. Remember previous messages in the conversation to maintain context and flow."
      }
    ];

    // Add conversation history (limit to last 20 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-20);
    // Filter out empty or invalid messages
    const validHistory = recentHistory.filter(msg => 
      msg && 
      msg.role && 
      msg.content && 
      typeof msg.content === 'string' && 
      msg.content.trim() !== ''
    );
    
    for (const msg of validHistory) {
      if (msg.role === 'user') {
        const msgContent: any[] = [];
        if (msg.content) {
          msgContent.push({ type: "text", text: msg.content });
        }
        // Add images if present
        if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
          for (const img of msg.images.slice(0, 5)) {
            if (img) {
              msgContent.push({ type: "image_url", image_url: { url: img } });
            }
          }
        }
        if (msgContent.length > 0) {
          messages.push({
            role: "user",
            content: msgContent
          });
        }
      } else if (msg.role === 'assistant') {
        messages.push({
          role: "assistant",
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({
      role: "user",
      content: userContent.length > 0 ? userContent : [{ type: "text", text: query }]
    });

    const stream = client.chat.completions.create({
      ...modelConfig,
      messages: messages as any
    });

    const streamResult = await stream;
    for await (const chunk of streamResult as any) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
      }
    }

    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
    controller.close();
    return true;
  } catch (error: any) {
    console.error('Code execution model error:', error);
    if (error.status === 400 || error.status === 429 || error.status === 403) {
      return false;
    }
    throw error;
  }
}

async function tryGuardModel(query: string, controller: ReadableStreamDefaultController) {
  try {
    const completion: any = await client.chat.completions.create({
      ...PROMPT_GUARD_FALLBACK as any,
      messages: [
        { role: 'user', content: query }
      ]
    } as any);
    const msg = completion?.choices?.[0]?.message?.content || 'Request received.';
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: msg })}\n\n`));
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
    controller.close();
  } catch (e) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'All models unavailable. Please try again later.' })}\n\n`));
    controller.close();
  }
}

async function tryModel(modelConfig: any, query: string, controller: ReadableStreamDefaultController, images: string[], conversationHistory: any[] = []) {
  try {
    const userContent: any[] = [];
    if (query) {
      userContent.push({ type: "text", text: query });
    }
    for (const img of (images || []).slice(0, 5)) {
      userContent.push({ type: "image_url", image_url: { url: img } });
    }

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content: "You are Humbl AI, a powerful search engine assistant. Help users find relevant information and provide comprehensive, accurate answers to their queries. Be concise but thorough in your responses. Remember previous messages in the conversation to maintain context and flow."
      }
    ];

    // Add conversation history (limit to last 20 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-20);
    // Filter out empty or invalid messages
    const validHistory = recentHistory.filter(msg => 
      msg && 
      msg.role && 
      msg.content && 
      typeof msg.content === 'string' && 
      msg.content.trim() !== ''
    );
    
    for (const msg of validHistory) {
      if (msg.role === 'user') {
        const msgContent: any[] = [];
        if (msg.content) {
          msgContent.push({ type: "text", text: msg.content });
        }
        // Add images if present
        if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
          for (const img of msg.images.slice(0, 5)) {
            if (img) {
              msgContent.push({ type: "image_url", image_url: { url: img } });
            }
          }
        }
        if (msgContent.length > 0) {
          messages.push({
            role: "user",
            content: msgContent
          });
        }
      } else if (msg.role === 'assistant') {
        messages.push({
          role: "assistant",
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({
      role: "user",
      content: userContent.length > 0 ? userContent : [{ type: "text", text: query }]
    });

    const stream = client.chat.completions.create({
      ...modelConfig,
      messages: messages as any
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
    const { query, images, mode, conversationHistory = [] } = await request.json();

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
            const runCompound = async (modelId: string) => {
              // Build messages with conversation history for web search mode
              const messages: any[] = [
                { role: 'system', content: 'You are Humbl AI. Use web search when helpful and include concise citations. Remember previous messages in the conversation to maintain context and flow.' }
              ];
              
              // Add conversation history
              const recentHistory = conversationHistory.slice(-20);
              const validHistory = recentHistory.filter((msg: any) => msg && msg.content && msg.content.trim() !== '');
              for (const msg of validHistory) {
                if (msg.role === 'user') {
                  messages.push({ role: 'user', content: msg.content || '' });
                } else if (msg.role === 'assistant') {
                  messages.push({ role: 'assistant', content: msg.content || '' });
                }
              }
              
              // Add current query
              messages.push({ role: 'user', content: query });
              
              const completion = await client.chat.completions.create({
                model: modelId,
                messages: messages,
                stream: false,
                // widen search scope explicitly using include_domains wildcards per Groq docs
                // ref: https://console.groq.com/docs/web-search
                search_settings: {
                  include_domains: [
                    '*.com','*.org','*.net','*.edu','*.gov','*.io','*.ai','*.co','*.news','*.info','*.dev'
                  ]
                } as any
              });
              const choice: any = (completion as any).choices?.[0]?.message || {};
              const content = choice.content || '';
              const executed = choice.executed_tools?.[0]?.search_results || [];
              const citations = Array.isArray(executed)
                ? executed.map((r: any) => ({ title: r?.title ?? 'Source', url: r?.url ?? '#' })).slice(0, 10)
                : [];
              if (content) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ citations, done: true })}\n\n`));
              controller.close();
            };
            try {
              await runCompound('groq/compound');
              return;
            } catch (primaryErr) {
              try {
                await runCompound('groq/compound-mini');
                return;
              } catch (fallbackErr) {
                // Graceful degradation: answer without browsing using our default model
                try {
                  // Build messages with conversation history for fallback
                  const fallbackMessages: any[] = [
                    { role: 'system', content: 'You are Humbl AI. Provide your best answer without web search due to a temporary issue. Remember previous messages in the conversation to maintain context and flow.' }
                  ];
                  
                  // Add conversation history
                  const recentHistory = conversationHistory.slice(-20);
                  const validHistory = recentHistory.filter((msg: any) => msg && msg.content && msg.content.trim() !== '');
                  for (const msg of validHistory) {
                    if (msg.role === 'user') {
                      fallbackMessages.push({ role: 'user', content: msg.content || '' });
                    } else if (msg.role === 'assistant') {
                      fallbackMessages.push({ role: 'assistant', content: msg.content || '' });
                    }
                  }
                  
                  // Add current query
                  fallbackMessages.push({ role: 'user', content: query });
                  
                  const completion = await client.chat.completions.create({
                    ...QWEN_FALLBACK,
                    messages: fallbackMessages,
                    stream: false
                  } as any);
                  const choice: any = (completion as any).choices?.[0]?.message || {};
                  const content = choice.content || 'I couldn\'t run web search just now, but here\'s my best answer based on existing knowledge.';
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ citations: [], done: true })}\n\n`));
                  controller.close();
                  return;
                } catch (finalErr) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Web search failed. Please try again.' })}\n\n`));
                  controller.close();
                  return;
                }
              }
            }
          }

          // Default streaming flow (images supported)
          const imgs = Array.isArray(images) ? images.slice(0, 5) : []; // Vision models support up to 5 images
          const hasImages = imgs.length > 0;
          
          // Use vision models when images are present
          if (hasImages) {
            console.log('Images detected, using vision models...');
            const visionScoutSuccess = await tryModel(VISION_SCOUT, query, controller, imgs, conversationHistory);
            if (!visionScoutSuccess) {
              console.log('Vision Scout failed, trying Vision Maverick...');
              const visionMaverickSuccess = await tryModel(VISION_MAVERICK, query, controller, imgs, conversationHistory);
              if (!visionMaverickSuccess) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Vision models failed. Please try again.' })}\n\n`));
                controller.close();
                return;
              }
            }
            return; // Vision model succeeded
          }
          
          // Text-only queries: Check if query is code/calculation related and use code execution models
          if (isCodeRelatedQuery(query)) {
            console.log('Detected code-related query, using code execution models...');
            const codeMiniSuccess = await tryCodeExecutionModel(CODE_COMPOUND_MINI, query, controller, imgs, conversationHistory);
            if (!codeMiniSuccess) {
              console.log('Attempting Compound for code execution...');
              const codeCompoundSuccess = await tryCodeExecutionModel(CODE_COMPOUND, query, controller, imgs, conversationHistory);
              if (!codeCompoundSuccess) {
                console.log('Attempting GPT-OSS 20B with code interpreter...');
                const codeOssSuccess = await tryCodeExecutionModel(CODE_OSS_20B, query, controller, imgs, conversationHistory);
                if (!codeOssSuccess) {
                  console.log('Code execution models failed, falling back to regular models...');
                  // Fall through to regular model flow
                } else {
                  return; // Code execution succeeded
                }
              } else {
                return; // Code execution succeeded
              }
            } else {
              return; // Code execution succeeded
            }
          }
          
          // Text-only queries: Use regular models
          const primarySuccess = await tryModel(PRIMARY_MODEL, query, controller, imgs, conversationHistory);
          if (!primarySuccess) {
            console.log('Attempting GPT OSS 20B fallback model...');
            const gpt20bSuccess = await tryModel(OSS20B_FALLBACK as any, query, controller, imgs, conversationHistory);
            if (!gpt20bSuccess) {
              console.log('Attempting GPT OSS 120B fallback model...');
              const gpt120bSuccess = await tryModel(OSS120B_FALLBACK as any, query, controller, imgs, conversationHistory);
              if (!gpt120bSuccess) {
                console.log('Attempting Qwen fallback model...');
                const qwenSuccess = await tryModel(QWEN_FALLBACK as any, query, controller, imgs, conversationHistory);
                const fallbackSuccess = qwenSuccess ? true : await tryModel(FALLBACK_MODEL, query, controller, imgs, conversationHistory);
                if (!fallbackSuccess) {
                  console.log('Attempting versatile 70B fallback model...');
                  const versatileSuccess = await tryModel(VERSATILE_FALLBACK as any, query, controller, imgs, conversationHistory);
                  if (!versatileSuccess) {
                    console.log('Attempting instant 8B fallback model...');
                    const instantSuccess = await tryModel(INSTANT_FALLBACK as any, query, controller, imgs, conversationHistory);
                    if (!instantSuccess) {
                      console.log('Attempting prompt guard final fallback...');
                      await tryGuardModel(query, controller);
                    }
                  }
                }
              }
            }
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
