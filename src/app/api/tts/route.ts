import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || text.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Groq API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limit text length to 10K characters as per Groq docs
    const textToConvert = text.slice(0, 10000);

    // Generate speech using playai-tts model
    const speechResponse = await client.audio.speech.create({
      model: 'playai-tts',
      voice: 'Aaliyah-PlayAI', // Using the voice from the example
      input: textToConvert,
      response_format: 'wav',
    });

    // The Groq SDK returns a Response-like object with a body stream
    // We need to read the stream and convert it to a buffer
    let audioBuffer: ArrayBuffer;
    
    try {
      // Check if response has a body property (stream)
      if ((speechResponse as any).body && (speechResponse as any).body instanceof ReadableStream) {
        const stream = (speechResponse as any).body;
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        
        // Combine all chunks into a single buffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        audioBuffer = new ArrayBuffer(totalLength);
        const view = new Uint8Array(audioBuffer);
        let offset = 0;
        for (const chunk of chunks) {
          view.set(chunk, offset);
          offset += chunk.length;
        }
      } else if (typeof (speechResponse as any).arrayBuffer === 'function') {
        // If it has an arrayBuffer method, use it
        audioBuffer = await (speechResponse as any).arrayBuffer();
      } else if (speechResponse instanceof Response) {
        // If it's a Response object
        audioBuffer = await speechResponse.arrayBuffer();
      } else {
        // Try to get as buffer directly or convert to buffer
        const body = (speechResponse as any).body || speechResponse;
        if (body instanceof ReadableStream) {
          const reader = body.getReader();
          const chunks: Uint8Array[] = [];
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          audioBuffer = new ArrayBuffer(totalLength);
          const view = new Uint8Array(audioBuffer);
          let offset = 0;
          for (const chunk of chunks) {
            view.set(chunk, offset);
            offset += chunk.length;
          }
        } else {
          // Last resort: wrap in Response and get buffer
          audioBuffer = await new Response(body).arrayBuffer();
        }
      }
    } catch (streamError: any) {
      console.error('Error reading audio stream:', streamError);
      throw new Error(`Failed to process audio response: ${streamError.message || 'Unknown error'}`);
    }
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      response: error?.response,
      stack: error?.stack,
    });
    
    const errorMessage = error?.message || error?.error?.message || 'Failed to generate speech';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }),
      { status: error?.status || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
