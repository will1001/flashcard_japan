/**
 * Script to add JLPT level field to all flashcards
 * - ID 1-645: N3
 * - ID 646-1377: N5
 * - ID 1378-2000: N4
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flashcardsPath = path.join(__dirname, '../public/flashcards.json');

// Read the file
const data = JSON.parse(fs.readFileSync(flashcardsPath, 'utf-8'));

// Add level to each flashcard
data.flashcards = data.flashcards.map((card) => {
  let level;
  if (card.id >= 1 && card.id <= 645) {
    level = 'N3';
  } else if (card.id >= 646 && card.id <= 1377) {
    level = 'N5';
  } else {
    level = 'N4';
  }
  return { ...card, level };
});

// Write back
fs.writeFileSync(flashcardsPath, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ Added level field to all flashcards!');
console.log(`   N3: ${data.flashcards.filter(c => c.level === 'N3').length} cards`);
console.log(`   N5: ${data.flashcards.filter(c => c.level === 'N5').length} cards`);
console.log(`   N4: ${data.flashcards.filter(c => c.level === 'N4').length} cards`);
