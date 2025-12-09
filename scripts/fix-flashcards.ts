
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Flashcard } from '../src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.VITE_OPENROUTER_API_KEY;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Read existing flashcards
const flashcardsPath = path.join(__dirname, '../public/flashcards.json');
const rawData = fs.readFileSync(flashcardsPath, 'utf-8');
// Handle potential wrapping structure { flashcards: [...] } or just [...]
const parsedData = JSON.parse(rawData);
let allFlashcards: Flashcard[] = Array.isArray(parsedData) ? parsedData : parsedData.flashcards;

if (!allFlashcards) {
  console.error('Could not parse flashcards data');
  process.exit(1);
}

// Filter problematic flashcards
const incompleteFlashcards = allFlashcards.filter(f => {
  return (
    !f.romaji ||
    f.meaning.includes('(?)') ||
    f.meaning_id.includes('(?)') ||
    f.meaning === '' ||
    f.meaning_id === ''
  );
});

console.log(`Found ${incompleteFlashcards.length} incomplete flashcards out of ${allFlashcards.length} total.`);

if (incompleteFlashcards.length === 0) {
  console.log('No flashcards need fixing. Exiting.');
  process.exit(0);
}

// Process batch of words with AI
async function fixWithAI(cardsToFix: Flashcard[], batchSize: number = 20) {
  let successCount = 0;

  for (let i = 0; i < cardsToFix.length; i += batchSize) {
    const batch = cardsToFix.slice(i, i + batchSize);
    const kanjiList = batch.map(c => c.kanji).join('\n');
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToFix.length / batchSize)} (${batch.length} words)...`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a Japanese language expert. For each Japanese word given, provide:
1. furigana (hiragana reading)
2. romaji (romanized reading)
3. meaning (English meaning, concise)
4. meaning_id (Indonesian translation, concise)

Output ONLY valid JSON array, no explanation. Format:
[{"kanji":"学生","furigana":"がくせい","romaji":"gakusei","meaning":"student","meaning_id":"pelajar/mahasiswa"}, ...]

If a word is not a real Japanese word or doesn't make sense, still try to provide a reasonable reading and meaning based on the kanji components.`
            },
            {
              role: 'user',
              content: `Process these Japanese words:\n${kanjiList}`
            }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      
      // Extract JSON from response
      let jsonStr = content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      try {
        const parsed = JSON.parse(jsonStr);
        
        // Update original flashcards
        for (let j = 0; j < batch.length; j++) {
          const originalCard = batch[j];
          const aiResult = parsed.find((p: any) => p.kanji === originalCard.kanji) || parsed[j];
          
          if (aiResult) {
            // Find reference in main array to update
            const mainIndex = allFlashcards.findIndex(f => f.id === originalCard.id);
            if (mainIndex !== -1) {
              allFlashcards[mainIndex] = {
                ...allFlashcards[mainIndex],
                furigana: aiResult.furigana || allFlashcards[mainIndex].furigana, // Keep existing if ai fails? No, trust AI fix
                romaji: aiResult.romaji || '',
                meaning: aiResult.meaning || '(?)(unfixed)',
                meaning_id: aiResult.meaning_id || '(?)(unfixed)',
              };
              successCount++;
            }
          }
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.log('Raw content:', content);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Error processing batch:', error);
    }
  }

  // Save back to file
  const output = { flashcards: allFlashcards };
  fs.writeFileSync(flashcardsPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ Finished! Fixed ${successCount} flashcards.`);
}

fixWithAI(incompleteFlashcards).catch(console.error);
