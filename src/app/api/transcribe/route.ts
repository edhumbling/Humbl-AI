import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Groq API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert the File to a Node.js compatible Blob/Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const webFile = new File([buffer], file.name || 'audio.webm', { type: file.type || 'audio/webm' }) as any;

    async function attemptTranscribe(model: string) {
      return await client.audio.transcriptions.create({
        file: webFile,
        model,
        temperature: 0,
        response_format: 'verbose_json' as any,
      } as any);
    }

    // Try primary Whisper model, then fall back to turbo variant
    let transcription: any;
    try {
      transcription = await attemptTranscribe('whisper-large-v3');
    } catch (primaryErr: any) {
      const status = primaryErr?.status;
      if (status === 400 || status === 403 || status === 429) {
        // soft fallback
      }
      // Fallback to turbo regardless of specific error to maximize resilience
      transcription = await attemptTranscribe('whisper-large-v3-turbo');
    }

    const text = transcription?.text || '';
    return new Response(
      JSON.stringify({ text }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to transcribe audio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


