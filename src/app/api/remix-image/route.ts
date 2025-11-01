import { NextRequest, NextResponse } from 'next/server';

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

    const reveApiKey = process.env.REVE_API_KEY;
    if (!reveApiKey) {
      return NextResponse.json(
        { error: 'REVE_API_KEY is not configured' },
        { status: 500 }
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

    const response = await fetch('https://api.reve.com/v1/image/remix', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${reveApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2560), // Max 2560 characters
        reference_images: base64Images,
        aspect_ratio: '1:1',
        version: 'latest',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to remix image' },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.content_violation) {
      return NextResponse.json(
        { error: 'Content policy violation detected' },
        { status: 400 }
      );
    }

    if (!result.image) {
      return NextResponse.json(
        { error: 'No image data returned' },
        { status: 500 }
      );
    }

    // Convert base64 to data URL
    const imageDataUrl = `data:image/png;base64,${result.image}`;

    return NextResponse.json({
      imageUrl: imageDataUrl,
      requestId: result.request_id,
      creditsUsed: result.credits_used,
      creditsRemaining: result.credits_remaining,
    });
  } catch (error: any) {
    console.error('Error remixing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remix image' },
      { status: 500 }
    );
  }
}

