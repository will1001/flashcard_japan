/**
 * Script to process vocabulary from n5_n4_n3.txt using AI
 * Generates furigana, romaji, meaning (EN), and meaning_id (ID)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.VITE_OPENROUTER_API_KEY;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Flashcard {
  id: number;
  kanji: string;
  furigana: string;
  romaji: string;
  meaning: string;
  meaning_id: string;
  level: 'N5' | 'N4' | 'N3';
}

interface VocabEntry {
  kanji: string;
  level: 'N5' | 'N4' | 'N3';
}

// Parse the txt file
function parseVocabFile(filePath: string): VocabEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const entries: VocabEntry[] = [];
  let currentLevel: 'N5' | 'N4' | 'N3' = 'N5';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for level headers
    if (trimmed.includes('# JLPT N5')) {
      currentLevel = 'N5';
      continue;
    } else if (trimmed.includes('# JLPT N4')) {
      currentLevel = 'N4';
      continue;
    } else if (trimmed.includes('# JLPT N3')) {
      currentLevel = 'N3';
      continue;
    }
    
    // Skip comments
    if (trimmed.startsWith('#')) continue;
    
    // Add entry (remove trailing period if any)
    const kanji = trimmed.replace(/\.$/, '');
    if (kanji) {
      entries.push({ kanji, level: currentLevel });
    }
  }
  
  return entries;
}

// Process batch of words with AI
async function processWithAI(words: VocabEntry[], batchSize: number = 20): Promise<Flashcard[]> {
  const results: Flashcard[] = [];
  let id = 1;
  
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const kanjiList = batch.map(w => w.kanji).join('\n');
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(words.length / batchSize)} (${batch.length} words)...`);
    
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

If a word is not a real Japanese word or doesn't make sense, still try to provide a reasonable reading and meaning based on the kanji components, or mark meaning as "(?)" if completely unclear.`
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
        // Add placeholder entries for failed batch
        for (const entry of batch) {
          results.push({
            id: id++,
            kanji: entry.kanji,
            furigana: entry.kanji,
            romaji: '',
            meaning: '(?)',
            meaning_id: '(?)',
            level: entry.level,
          });
        }
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
        
        for (let j = 0; j < batch.length; j++) {
          const entry = batch[j];
          const aiResult = parsed[j] || {};
          
          results.push({
            id: id++,
            kanji: entry.kanji,
            furigana: aiResult.furigana || entry.kanji,
            romaji: aiResult.romaji || '',
            meaning: aiResult.meaning || '(?)',
            meaning_id: aiResult.meaning_id || '(?)',
            level: entry.level,
          });
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // Add placeholder entries
        for (const entry of batch) {
          results.push({
            id: id++,
            kanji: entry.kanji,
            furigana: entry.kanji,
            romaji: '',
            meaning: '(?)',
            meaning_id: '(?)',
            level: entry.level,
          });
        }
      }
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Error processing batch:', error);
      // Add placeholder entries
      for (const entry of batch) {
        results.push({
          id: id++,
          kanji: entry.kanji,
          furigana: entry.kanji,
          romaji: '',
          meaning: '(?)',
          meaning_id: '(?)',
          level: entry.level,
        });
      }
    }
  }
  
  return results;
}

async function main() {
  console.log('Starting vocabulary processing...\n');
  
  // Parse vocab file
  const vocabPath = path.join(__dirname, '../n5_n4_n3.txt');
  const entries = parseVocabFile(vocabPath);
  
  console.log(`Found ${entries.length} vocabulary entries`);
  console.log(`- N5: ${entries.filter(e => e.level === 'N5').length}`);
  console.log(`- N4: ${entries.filter(e => e.level === 'N4').length}`);
  console.log(`- N3: ${entries.filter(e => e.level === 'N3').length}`);
  console.log('');
  
  // Process with AI
  const flashcards = await processWithAI(entries);
  
  // Save to flashcards.json
  const outputPath = path.join(__dirname, '../public/flashcards.json');
  const output = { flashcards };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\n✅ Done! Saved ${flashcards.length} flashcards to flashcards.json`);
  console.log(`- N5: ${flashcards.filter(f => f.level === 'N5').length}`);
  console.log(`- N4: ${flashcards.filter(f => f.level === 'N4').length}`);
  console.log(`- N3: ${flashcards.filter(f => f.level === 'N3').length}`);
}

main().catch(console.error);
