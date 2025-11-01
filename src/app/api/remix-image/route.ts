import { NextRequest, NextResponse } from 'next/server';

// Try Reve API remix with a specific API key
async function tryRemixWithKey(prompt: string, referenceImages: string[], apiKey: string): Promise<{ imageUrl: string; requestId?: string; creditsUsed?: number; creditsRemaining?: number } | { error: string, statusCode?: number } | null> {
  try {
    const response = await fetch('https://api.reve.com/v1/image/remix', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2560), // Max 2560 characters
        reference_images: referenceImages,
        aspect_ratio: '1:1',
        version: 'latest',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      
      // Check for 402 (budget exhausted) or credit-related errors
      if (response.status === 402 || errorData.message?.toLowerCase().includes('budget') || errorData.message?.toLowerCase().includes('funds')) {
        console.error(`Reve API key budget exhausted (402): ${errorData.message}`);
        return { error: 'BUDGET_EXHAUSTED', statusCode: 402 };
      }
      
      console.error('Reve API error:', errorData);
      return { error: errorData.message || 'Unknown error', statusCode: response.status };
    }

    const result = await response.json();

    if (result.content_violation) {
      return { error: 'Content policy violation detected', statusCode: 400 };
    }

    if (!result.image) {
      return { error: 'No image data returned', statusCode: 500 };
    }

    // Convert base64 to data URL
    const imageDataUrl = `data:image/png;base64,${result.image}`;

    return {
      imageUrl: imageDataUrl,
      requestId: result.request_id,
      creditsUsed: result.credits_used,
      creditsRemaining: result.credits_remaining,
    };
  } catch (error: any) {
    console.error('Reve API error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceImages } = await req.json();

    if (!prompt || !referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return NextResponse.json(
        { error: 'prompt and reference_images are required' },
        { status: 400 }
      );
    }

    if (referenceImages.length < 1 || referenceImages.length > 6) {
      return NextResponse.json(
        { error: 'reference_images must contain between 1 and 6 images' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URLs
    const base64Images = referenceImages.map((img: string) => {
      if (img.startsWith('data:')) {
        const matches = img.match(/^data:image\/\w+;base64,(.+)$/);
        if (matches) {
          return matches[1];
        } else {
          throw new Error('Invalid image format');
        }
      }
      return img;
    });

    // Array of Reve API keys to try in order
    const reveApiKeys = [
      process.env.REVE_API_KEY,
      process.env.REVE_API_KEY_FALLBACK,
      process.env.REVE_API_KEY_FALLBACK_2,
      process.env.REVE_API_KEY_FALLBACK_3,
    ].filter((key): key is string => !!key);

    if (reveApiKeys.length === 0) {
      return NextResponse.json(
        { error: 'No Reve API keys configured' },
        { status: 500 }
      );
    }

    // Try each key in order until one succeeds
    let lastError: { error: string, statusCode?: number } | null = null;
    for (let i = 0; i < reveApiKeys.length; i++) {
      const apiKey = reveApiKeys[i];
      const result = await tryRemixWithKey(prompt, base64Images, apiKey);
      
      // Check if result is success (has imageUrl)
      if (result && 'imageUrl' in result) {
        return NextResponse.json({
          imageUrl: result.imageUrl,
          requestId: result.requestId,
          creditsUsed: result.creditsUsed,
          creditsRemaining: result.creditsRemaining,
        });
      }
      
      // Check if it's a budget error (402) - should try next key
      if (result && 'error' in result) {
        lastError = result;
        if (result.statusCode === 402) {
          if (i < reveApiKeys.length - 1) {
            console.log(`Reve API key ${i + 1} budget exhausted (402), trying next fallback key...`);
            continue; // Try next key
          }
        }
      }
      
      // Other errors or no result - try next key if available
      if (i < reveApiKeys.length - 1) {
        console.log(`Reve API key ${i + 1} failed, trying next fallback key...`);
      }
    }

    // All keys failed
    const errorMessage = lastError?.error || 'Failed to remix image';
    const statusCode = lastError?.statusCode || 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  } catch (error: any) {
    console.error('Error remixing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remix image' },
      { status: 500 }
    );
  }
}

