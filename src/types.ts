// Types for flashcard data
export interface Flashcard {
  id: number;
  kanji: string;
  furigana: string;
  meaning: string;
  meaning_id?: string;
  romaji: string;
  level?: "N5" | "N4" | "N3" | "My Level";
}

export interface FlashcardData {
  flashcards: Flashcard[];
}

// Types for AI Chat
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}
