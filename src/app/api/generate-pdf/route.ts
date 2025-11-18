import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

interface Message {
  type: 'user' | 'ai';
  content: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, title, includeUserMessages = true, selectedIndices } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Filter messages based on selectedIndices or includeUserMessages
    let filteredMessages: Message[];
    if (selectedIndices && Array.isArray(selectedIndices) && selectedIndices.length > 0) {
      // Use selected indices
      filteredMessages = selectedIndices
        .map((idx: number) => messages[idx])
        .filter((msg: Message | undefined) => msg !== undefined);
    } else {
      // Filter by message type
      filteredMessages = includeUserMessages
        ? messages
        : messages.filter((msg: Message) => msg.type === 'ai');
    }

    if (filteredMessages.length === 0) {
      return NextResponse.json(
        { error: 'No messages to include in PDF' },
        { status: 400 }
      );
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Create a buffer to store PDF
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Helper function to strip HTML and markdown
    const stripMarkdown = (text: string): string => {
      return text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/#{1,6}\s+/g, '') // Remove markdown headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove inline code
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .trim();
    };

    // Helper function to clean text for PDF
    const cleanText = (text: string): string => {
      return stripMarkdown(text)
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double
        .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove thinking blocks
        .replace(/<think>[\s\S]*?<\/think>/gi, ''); // Remove redacted reasoning
    };

    // Add title
    const pdfTitle = title || 'Conversation Export';
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(pdfTitle, { align: 'center' });
    doc.moveDown(2);

    // Process messages
    filteredMessages.forEach((message: Message, index: number) => {
      const content = cleanText(message.content);
      
      if (!content || content.trim().length === 0) {
        return;
      }

      // Add page break before new sections if content is long
      if (index > 0 && index % 5 === 0) {
        doc.addPage();
      }

      // Style based on message type
      if (message.type === 'user') {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('User:', { continued: false });
        doc.moveDown(0.3);
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#333333')
           .text(content, {
             align: 'left',
             indent: 10,
           });
      } else {
        // AI messages - treat as main content
        // Check if this looks like a heading/title
        const firstLine = content.split('\n')[0];
        const isHeading = firstLine.length < 100 && 
                         (firstLine.match(/^[A-Z][^.!?]*$/) || 
                          content.split('\n').length === 1 && content.length < 200);

        if (isHeading && index > 0) {
          doc.moveDown(1);
          doc.fontSize(14)
             .font('Helvetica-Bold')
             .fillColor('#1a1a1a')
             .text(firstLine);
          doc.moveDown(0.5);
          
          const remainingContent = content.substring(firstLine.length).trim();
          if (remainingContent) {
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#333333')
               .text(remainingContent, {
                 align: 'left',
                 indent: 10,
               });
          }
        } else {
          // Regular content
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor('#333333')
             .text(content, {
               align: 'left',
               indent: 10,
             });
        }
      }

      doc.moveDown(1);
    });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);
    });

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(pdfTitle)}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

