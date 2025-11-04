import { NextResponse } from 'next/server';

// Generate prompts based on the current date (changes daily)
function generateDailyPrompts(): string[] {
  const today = new Date();
  const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  
  // Simple hash function to create consistent prompts for the same day
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Pool of cute prompt suggestions
  const promptPool = [
    "✨ What's a fun fact about space?",
    "💡 Explain quantum physics simply",
    "🎨 Help me write a creative story",
    "🍕 What's the best pizza recipe?",
    "🌍 Tell me about ancient civilizations",
    "🤖 How does AI actually work?",
    "🎵 What makes a song catchy?",
    "📚 Recommend a good book",
    "🏃 What's the science behind exercise?",
    "🧪 Explain photosynthesis simply",
    "🎬 What makes a great movie?",
    "🍀 How does luck actually work?",
    "🌈 Why do we see colors?",
    "🐾 Fun facts about animals",
    "🌊 How do ocean currents work?",
    "🎯 Tips for better focus",
    "🍯 Why do bees make honey?",
    "⚡ How does electricity work?",
    "🎭 What's the history of theater?",
    "🌱 How do plants communicate?",
    "🧠 How does memory work?",
    "🎪 Fun facts about circuses",
    "🏔️ What creates mountains?",
    "🎨 History of art movements",
    "🍰 Best baking tips",
    "🌙 Why do we have seasons?",
    "🎪 What makes music emotional?",
    "🦋 Life cycle of a butterfly",
    "🎯 How to set better goals",
    "🌍 Climate change explained simply",
  ];
  
  // Select 5 prompts based on hash
  const selectedPrompts: string[] = [];
  const usedIndices = new Set<number>();
  
  for (let i = 0; i < 5; i++) {
    let index;
    do {
      index = Math.abs((hash + i * 137) % promptPool.length);
    } while (usedIndices.has(index));
    
    usedIndices.add(index);
    selectedPrompts.push(promptPool[index]);
  }
  
  return selectedPrompts;
}

export async function GET() {
  try {
    const prompts = generateDailyPrompts();
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error generating daily prompts:', error);
    // Fallback prompts
    return NextResponse.json({
      prompts: [
        "✨ What's a fun fact about space?",
        "💡 Explain quantum physics simply",
        "🎨 Help me write a creative story",
        "🍕 What's the best pizza recipe?",
        "🌍 Tell me about ancient civilizations",
      ]
    });
  }
}

