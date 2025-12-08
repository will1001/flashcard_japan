import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

const API_KEY = process.env.VITE_OPENROUTER_API_KEY;
const FLASHCARDS_PATH = './public/flashcards.json';
const BATCH_SIZE = 20; // Process 20 items per batch
const DELAY_MS = 1000; // Delay between batches

if (!API_KEY) {
  console.error('Error: VITE_OPENROUTER_API_KEY is not set in .env');
  process.exit(1);
}

// Function to translate batch
async function translateBatch(items) {
  const prompt = `Translate the following English words/phrases to Indonesian.
Return ONLY a valid JSON array of strings, maintaining the same order.
Example input: ["apple", "run", "beautiful"]
Example output: ["apel", "berlari", "indah"]

Items to translate:
${JSON.stringify(items.map(i => i.meaning))}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Flashcard Translate Script"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonStr = content.replace(/^```json\s*|\s*```$/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}

async function main() {
  try {
    console.log(`Reading ${FLASHCARDS_PATH}...`);
    const rawData = fs.readFileSync(FLASHCARDS_PATH, 'utf8');
    const data = JSON.parse(rawData);
    const flashcards = data.flashcards;

    // Filter items needing translation
    const itemsToTranslate = flashcards.filter(card => !card.meaning_id);
    console.log(`Found ${itemsToTranslate.length} items to translate.`);

    if (itemsToTranslate.length === 0) {
      console.log('All items already translated!');
      return;
    }

    // Process in batches
    let processedCount = 0;
    
    // For demo/safety, let's limit total processed items in one run if needed
    // But since user said "accept all", we try to loop until done or error
    const MAX_ITEMS = 3000; // Process all items
    
    const targetItems = itemsToTranslate.slice(0, MAX_ITEMS);
    console.log(`Processing next ${targetItems.length} items...`);

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      const batch = targetItems.slice(i, i + BATCH_SIZE);
      console.log(`Translatng batch ${i/BATCH_SIZE + 1}... (${batch.length} items)`);

      const translations = await translateBatch(batch);

      if (translations && translations.length === batch.length) {
        // Update flashcards
        batch.forEach((item, index) => {
            // Find original item in main array to update
            const originalItem = flashcards.find(f => f.id === item.id);
            if (originalItem) {
                originalItem.meaning_id = translations[index];
            }
        });
        
        processedCount += batch.length;
        console.log(`Saved progress... (${processedCount}/${targetItems.length})`);
        
        // Save intermediate result
        fs.writeFileSync(FLASHCARDS_PATH, JSON.stringify({ flashcards }, null, 2));
      } else {
        console.error('Failed to translate batch, skipping...');
      }

      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    console.log(`Done! Translated ${processedCount} items.`);
    console.log('To translate more, run the script again.');

  } catch (error) {
    console.error('Script error:', error);
  }
}

main();
