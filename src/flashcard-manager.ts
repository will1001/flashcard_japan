import type { Flashcard, OpenRouterResponse } from "./types";

export class FlashcardManager {
  private apiKey: string;
  private apiUrl: string = "https://openrouter.ai/api/v1/chat/completions";
  private model: string = "openai/gpt-4o-mini";

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  }

  // Generate flashcard data from kanji using AI
  async generateFlashcardData(kanji: string): Promise<Omit<Flashcard, "id"> | null> {
    const prompt = `Analyze this Japanese word/kanji and provide the reading and meaning.

Word: "${kanji}"

Return ONLY a valid JSON object with this exact format (no markdown, no code blocks):
{"furigana":"hiragana reading","meaning":"English meaning","romaji":"romanized reading","meaning_id":"Indonesian meaning"}

Example for "日本":
{"furigana":"にほん","meaning":"Japan","romaji":"nihon","meaning_id":"Jepang"}

Important:
- furigana must be in hiragana only
- meaning must be in English
- romaji must be lowercase
- meaning_id must be in Indonesian`;

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Japanese Flashcard App",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are a Japanese language expert. Always respond with valid JSON only, no markdown formatting.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: OpenRouterResponse = await response.json();
      const content = data.choices[0].message.content.trim();
      
      // Parse JSON response
      const parsed = JSON.parse(content);
      
      return {
        kanji,
        furigana: parsed.furigana,
        meaning: parsed.meaning,
        romaji: parsed.romaji,
        meaning_id: parsed.meaning_id,
      };
    } catch (error) {
      console.error("Error generating flashcard data:", error);
      return null;
    }
  }

  // Save flashcard to flashcards.json via API
  async saveFlashcardToFile(flashcard: Flashcard): Promise<boolean> {
    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flashcard),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error saving flashcard to file:', error);
      return false;
    }
  }

  // Get next available ID from existing flashcards
  getNextId(existingFlashcards: Flashcard[]): number {
    if (existingFlashcards.length === 0) return 1;
    
    const maxId = Math.max(...existingFlashcards.map((f) => f.id));
    return maxId + 1;
  }
}
