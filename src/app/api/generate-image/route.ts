import { NextRequest } from 'next/server';

// Try Gemini API first
async function tryGemini(prompt: string): Promise<{ imageUrl: string } | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: {
              imageSize: '1K',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return null;
    }

    const data = await response.json();

    // Extract image data from the response
    if (
      data.candidates &&
      data.candidates[0]?.content?.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      // Look for inline data (image)
      const imagePart = data.candidates[0].content.parts.find(
        (part: any) => part.inlineData && part.inlineData.data
      );

      if (imagePart && imagePart.inlineData) {
        const { data: imageData, mimeType } = imagePart.inlineData;
        
        // Convert base64 to data URL
        const imageUrl = `data:${mimeType};base64,${imageData}`;
        
        return { imageUrl };
      }
    }

    return null;
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return null;
  }
}

// Try Reve API with a specific API key
async function tryReveWithKey(prompt: string, apiKey: string): Promise<{ imageUrl: string } | null> {
  try {
    const response = await fetch('https://api.reve.com/v1/image/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2560), // Max 2560 characters
        aspect_ratio: '1:1',
        version: 'latest',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Reve API error:', errorData);
      return null;
    }

    const data = await response.json();

    if (data.image && data.image.trim() !== '') {
      // Reve returns base64 PNG image
      const imageUrl = `data:image/png;base64,${data.image}`;
      
      return { imageUrl };
    }

    return null;
  } catch (error: any) {
    console.error('Reve API error:', error);
    return null;
  }
}

// Fallback to Reve API (tries primary key first, then all fallback keys in order)
async function tryReve(prompt: string): Promise<{ imageUrl: string } | null> {
  // Array of Reve API keys to try in order
  const reveApiKeys = [
    process.env.REVE_API_KEY,
    process.env.REVE_API_KEY_FALLBACK,
    process.env.REVE_API_KEY_FALLBACK_2,
  ].filter((key): key is string => !!key);

  // Try each key in order until one succeeds
  for (let i = 0; i < reveApiKeys.length; i++) {
    const apiKey = reveApiKeys[i];
    const result = await tryReveWithKey(prompt, apiKey);
    if (result) {
      return result;
    }
    if (i < reveApiKeys.length - 1) {
      console.log(`Reve API key ${i + 1} failed, trying next fallback key...`);
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || prompt.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try Gemini first
    let result = await tryGemini(prompt);
    
    // Fallback to Reve if Gemini fails
    if (!result) {
      console.log('Gemini failed, trying Reve API fallback...');
      result = await tryReve(prompt);
    }

    if (result) {
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Both APIs failed
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasReve = !!process.env.REVE_API_KEY || !!process.env.REVE_API_KEY_FALLBACK || !!process.env.REVE_API_KEY_FALLBACK_2;
    
    let errorMessage = 'Failed to generate image';
    if (!hasGemini && !hasReve) {
      errorMessage = 'No image generation API keys configured (GEMINI_API_KEY or REVE_API_KEY required)';
    } else {
      errorMessage = 'All image generation APIs failed';
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Image generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate image', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
