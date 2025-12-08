import fs from 'fs';
import * as wanakana from 'wanakana';

const FLASHCARDS_PATH = './public/flashcards.json';

try {
  // Read file
  console.log(`Reading ${FLASHCARDS_PATH}...`);
  const rawData = fs.readFileSync(FLASHCARDS_PATH, 'utf8');
  const data = JSON.parse(rawData);
  const flashcards = data.flashcards;

  console.log(`Processing ${flashcards.length} flashcards...`);
  let updatedCount = 0;

  // Process data
  const updatedFlashcards = flashcards.map(card => {
    if (!card.romaji || card.romaji.trim() === '') {
      // Convert furigana to romaji
      // wanakana.toRomaji handles hiragana/katakana conversion
      const romaji = wanakana.toRomaji(card.furigana);
      
      updatedCount++;
      return {
        ...card,
        romaji: romaji
      };
    }
    return card;
  });

  // Write back
  console.log(`Updating ${updatedCount} items...`);
  fs.writeFileSync(FLASHCARDS_PATH, JSON.stringify({ flashcards: updatedFlashcards }, null, 2));
  console.log('Done!');

} catch (error) {
  console.error('Error:', error);
}
