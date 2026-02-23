import type { Flashcard } from "./types";

export type QuizLevel = "N5" | "N4" | "N3" | "My Level" | "ALL";
export type QuizMode = "meaning" | "reading";

export interface QuizQuestion {
  flashcard: Flashcard;
  options: string[]; // 4 options including the correct answer
  optionsRomaji?: string[]; // Romaji for each option (only for reading mode)
  correctIndex: number;
  mode: QuizMode; // Which mode this question is for
}

export interface QuizResult {
  total: number;
  correct: number;
  wrong: number;
  percentage: number;
  answers: {
    question: QuizQuestion;
    selectedIndex: number;
    isCorrect: boolean;
  }[];
}

export class Quiz {
  private flashcards: Flashcard[] = [];
  private filteredFlashcards: Flashcard[] = [];
  private questions: QuizQuestion[] = [];
  private currentQuestionIndex: number = 0;
  private score: number = 0;
  private answers: {
    question: QuizQuestion;
    selectedIndex: number;
    isCorrect: boolean;
  }[] = [];
  private isActive: boolean = false;
  private currentMode: QuizMode = "meaning";

  constructor(flashcards: Flashcard[]) {
    this.flashcards = flashcards;
  }

  /**
   * Start a new quiz with specified level, question count, and mode
   * questionCount = 0 means all available flashcards
   * mode = 'meaning' for guessing meaning, 'reading' for guessing furigana
   */
  startQuiz(
    level: QuizLevel,
    questionCount: number,
    mode: QuizMode = "meaning",
  ): QuizQuestion | null {
    this.currentMode = mode;

    // Filter flashcards by level
    if (level === "ALL") {
      this.filteredFlashcards = [...this.flashcards];
    } else {
      this.filteredFlashcards = this.flashcards.filter(
        (f) => f.level === level,
      );
    }

    console.log(`[Quiz] Level selected: ${level}, Mode: ${mode}`);
    console.log(`[Quiz] Total flashcards: ${this.flashcards.length}`);
    console.log(
      `[Quiz] Filtered flashcards: ${this.filteredFlashcards.length}`,
    );
    console.log(
      `[Quiz] Sample cards:`,
      this.filteredFlashcards
        .slice(0, 5)
        .map((f) => ({ id: f.id, kanji: f.kanji, level: f.level })),
    );

    if (this.filteredFlashcards.length < 4) {
      console.error("Not enough flashcards for quiz");
      return null;
    }

    // Shuffle flashcards
    const shuffled = this.shuffleArray([...this.filteredFlashcards]);

    // Ensure uniqueness based on ID (extra safety)
    const uniqueCards: Flashcard[] = [];
    const seenIds = new Set<number>();

    for (const card of shuffled) {
      if (!seenIds.has(card.id)) {
        seenIds.add(card.id);
        uniqueCards.push(card);
      }
    }

    // If questionCount is 0, use all unique flashcards, otherwise use specified count
    const actualCount =
      questionCount === 0
        ? uniqueCards.length
        : Math.min(questionCount, uniqueCards.length);
    const selectedCards = uniqueCards.slice(0, actualCount);

    // Generate questions (each flashcard used only once since we're slicing unique items)
    this.questions = selectedCards.map((card) => this.generateQuestion(card));

    // FINAL SAFETY CHECK: Remove any duplicates that might have slipped through (paranoid mode)
    const finalQuestions: QuizQuestion[] = [];
    const finalSeenIds = new Set<number>();

    for (const q of this.questions) {
      if (!finalSeenIds.has(q.flashcard.id)) {
        finalSeenIds.add(q.flashcard.id);
        finalQuestions.push(q);
      }
    }
    this.questions = finalQuestions;

    this.currentQuestionIndex = 0;
    this.score = 0;
    this.answers = [];
    this.isActive = true;

    return this.getCurrentQuestion();
  }

  /**
   * Generate a question with 4 options based on current mode
   */
  private generateQuestion(flashcard: Flashcard): QuizQuestion {
    // Get 3 random wrong answers that are unique strings and not equal to correct answer
    const currentAnswer =
      this.currentMode === "meaning"
        ? flashcard.meaning_id || flashcard.meaning
        : flashcard.furigana;

    console.log(
      `[Quiz] Generating question for: ${flashcard.kanji} (${flashcard.level}) - Answer: ${currentAnswer}`,
    );

    const uniqueDistractors: Flashcard[] = [];
    const seenAnswers = new Set<string>();
    seenAnswers.add(currentAnswer);

    // Filter potential distractors
    const potentialDistractors = this.filteredFlashcards.filter(
      (f) => f.id !== flashcard.id,
    );
    const shuffledPotentials = this.shuffleArray([...potentialDistractors]); // Copy to avoid mutating original filter result if it was a ref

    for (const card of shuffledPotentials) {
      const answer =
        this.currentMode === "meaning"
          ? card.meaning_id || card.meaning
          : card.furigana;

      if (!seenAnswers.has(answer)) {
        seenAnswers.add(answer);
        uniqueDistractors.push(card);
        console.log(
          `[Quiz] Added distractor: ${card.kanji} (${card.level}) - ${answer}`,
        );
      }

      if (uniqueDistractors.length >= 3) break;
    }

    // If we didn't find enough unique distractors (unlikely unless dataset is tiny), pad with any (should not happen with >4 cards)
    const finalDistractors = uniqueDistractors;

    let wrongOptions: string[];
    let correctAnswer = currentAnswer;
    let optionsRomaji: string[] | undefined;

    if (this.currentMode === "meaning") {
      wrongOptions = finalDistractors.map((f) => f.meaning_id || f.meaning);
    } else {
      wrongOptions = finalDistractors.map((f) => f.furigana);
    }

    // Combine options (before shuffling, for romaji mapping)
    const allOptions = [...wrongOptions, correctAnswer];

    // For reading mode, prepare romaji for each option
    if (this.currentMode === "reading") {
      const wrongRomaji = finalDistractors.map((f) => f.romaji);
      const allRomaji = [...wrongRomaji, flashcard.romaji];

      // Create paired array for shuffling together
      const paired = allOptions.map((opt, i) => ({
        option: opt,
        romaji: allRomaji[i],
      }));
      const shuffledPaired = this.shuffleArray(paired);

      const shuffledOptions = shuffledPaired.map((p) => p.option);
      optionsRomaji = shuffledPaired.map((p) => p.romaji);

      return {
        flashcard,
        options: shuffledOptions,
        optionsRomaji,
        correctIndex: shuffledOptions.indexOf(correctAnswer),
        mode: this.currentMode,
      };
    }

    // For meaning mode, just shuffle options
    const shuffledOptions = this.shuffleArray(allOptions);

    return {
      flashcard,
      options: shuffledOptions,
      correctIndex: shuffledOptions.indexOf(correctAnswer),
      mode: this.currentMode,
    };
  }

  /**
   * Get current question
   */
  getCurrentQuestion(): QuizQuestion | null {
    if (!this.isActive || this.currentQuestionIndex >= this.questions.length) {
      return null;
    }
    return this.questions[this.currentQuestionIndex];
  }

  /**
   * Check answer and move to next question
   */
  checkAnswer(selectedIndex: number): boolean {
    const question = this.getCurrentQuestion();
    if (!question) return false;

    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) {
      this.score++;
    }

    this.answers.push({
      question,
      selectedIndex,
      isCorrect,
    });

    return isCorrect;
  }

  /**
   * Move to next question
   */
  nextQuestion(): QuizQuestion | null {
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= this.questions.length) {
      this.isActive = false;
      return null;
    }
    return this.getCurrentQuestion();
  }

  /**
   * Check if quiz is finished
   */
  isFinished(): boolean {
    return this.currentQuestionIndex >= this.questions.length;
  }

  /**
   * Get quiz results
   */
  getResults(): QuizResult {
    return {
      total: this.questions.length,
      correct: this.score,
      wrong: this.questions.length - this.score,
      percentage: Math.round((this.score / this.questions.length) * 100),
      answers: this.answers,
    };
  }

  /**
   * Get progress info
   */
  getProgress(): { current: number; total: number; score: number } {
    return {
      current: this.currentQuestionIndex + 1,
      total: this.questions.length,
      score: this.score,
    };
  }

  /**
   * Check if quiz is active
   */
  isQuizActive(): boolean {
    return this.isActive;
  }

  /**
   * End quiz early
   */
  endQuiz(): void {
    this.isActive = false;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
