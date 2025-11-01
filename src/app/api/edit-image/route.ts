import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { editInstruction, referenceImage } = await req.json();

    if (!editInstruction || !referenceImage) {
      return NextResponse.json(
        { error: 'edit_instruction and reference_image are required' },
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

    // Validate edit instruction length (max 2560 characters)
    const trimmedInstruction = editInstruction.trim();
    if (trimmedInstruction.length === 0) {
      return NextResponse.json(
        { error: 'edit_instruction cannot be empty' },
        { status: 400 }
      );
    }
    
    if (trimmedInstruction.length > 2560) {
      return NextResponse.json(
        { error: 'edit_instruction cannot exceed 2560 characters' },
        { status: 400 }
      );
    }

    // Extract base64 data if it's a data URL
    let base64Image = referenceImage;
    if (referenceImage.startsWith('data:')) {
      const matches = referenceImage.match(/^data:image\/\w+;base64,(.+)$/);
      if (matches) {
        base64Image = matches[1];
      } else {
        return NextResponse.json(
          { error: 'Invalid image format' },
          { status: 400 }
        );
      }
    }

    const response = await fetch('https://api.reve.com/v1/image/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${reveApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        edit_instruction: trimmedInstruction,
        reference_image: base64Image,
        version: 'latest',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to edit image' },
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
    console.error('Error editing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to edit image' },
      { status: 500 }
    );
  }
}

