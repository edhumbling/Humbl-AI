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
  temperature: 0.7,
  max_completion_tokens: 4096,
  top_p: 0.95,
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

const CURRENT_DATETIME = "2025-11-13T22:56:18";

const BASE_SYSTEM_PROMPT = `Current date and time: ${CURRENT_DATETIME}.

You are a helpful assistant with access to web search results and page content. Base your answers on the provided context. If the answer is not present in the context, respond with "I don't know" rather than inventing information.

Guidelines:
1. Write answers in markdown with clearly numbered headers and subheaders.
2. Provide thorough, informative responses, even if that means expanding beyond the exact wording of the question.
3. Present every plausible answer the sources support when multiple possibilities exist.
4. Address every part of multi-part questions to the best of your ability.
5. When a question is time-sensitive, reference the precise publication or update timestamp from the source and format dates as YYYY-MM-DD or an explicit relative time.
6. Reply in the user's language if they do not use English.
7. Cite every source at the end of the answer, including the domain and the timestamp when available; if no sources are available, state that explicitly.
8. Whenever reasonable, conclude with a helpful summary table.

Formatting reminders:
- Avoid repeating the same word, phrase, or sentence consecutively.
- Keep clear spacing and line breaks between sections.
- Use markdown elements such as lists, tables, and code blocks when appropriate.
- Ensure citations are readable and tied to the statements they support.`;

const SEARCH_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

Additional directives:
- Use web search when it adds value and include concise citations connected to each referenced fact.
- Maintain awareness of the existing conversation history to preserve continuity.
- Keep responses concise yet sufficiently detailed for the user to act on.`;

const OFFLINE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

Additional directives:
- Web search is currently unavailable; rely solely on supplied context and existing knowledge.
- Make it clear to the user when information cannot be confirmed from the available context.`;

const GENERAL_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

Additional directives:
- Deliver thoughtful, context-aware answers grounded in the conversation history.
- Surface all relevant details the user would need to act confidently on the response.`;

const CODE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

Additional directives for code-related tasks:
- Leverage code execution tools when they help produce accurate results.
- Show both the code you ran and the resulting output or answer.
- Separate code, explanations, and results with clear markdown structure.
- Maintain awareness of prior conversation turns so the solution stays contextual.`;

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
        content: CODE_SYSTEM_PROMPT
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

async function tryModel(
  modelConfig: any,
  query: string,
  controller: ReadableStreamDefaultController,
  images: string[],
  conversationHistory: any[] = [],
  systemPrompt: string = GENERAL_SYSTEM_PROMPT
) {
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
        content: systemPrompt
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
                { role: 'system', content: SEARCH_SYSTEM_PROMPT }
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
                    { role: 'system', content: OFFLINE_SYSTEM_PROMPT }
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
