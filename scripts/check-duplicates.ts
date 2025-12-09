
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flashcardsPath = path.join(__dirname, '../public/flashcards.json');
const rawData = fs.readFileSync(flashcardsPath, 'utf-8');
const parsedData = JSON.parse(rawData);
const flashcards = Array.isArray(parsedData) ? parsedData : parsedData.flashcards;

const kanjiSet = new Set();
const duplicates = [];

flashcards.forEach((f: any) => {
  if (kanjiSet.has(f.kanji)) {
    duplicates.push({ id: f.id, kanji: f.kanji });
  }
  kanjiSet.add(f.kanji);
});

console.log(`Total flashcards: ${flashcards.length}`);
console.log(`Unique Kanji: ${kanjiSet.size}`);
console.log(`Duplicate Kanji found: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log('Duplicate Kanji examples:', duplicates.slice(0, 10));
}
