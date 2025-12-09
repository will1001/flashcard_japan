import "./style.css";
import type { Flashcard, FlashcardData } from "./types";
import { AIChat } from "./ai-chat";
import { FlashcardManager } from "./flashcard-manager";
import { Quiz, type QuizLevel, type QuizMode, type QuizQuestion } from "./quiz";

class FlashcardApp {
  public flashcards: Flashcard[] = [];
  private allFlashcards: Flashcard[] = []; // Store all flashcards before filtering
  public currentIndex: number = 0;
  private isFlipped: boolean = false;
  private isShuffled: boolean = false;
  private originalOrder: Flashcard[] = [];
  private aiChat: AIChat | null = null;
  private flashcardManager: FlashcardManager | null = null;
  private pendingFlashcard: Omit<Flashcard, "id"> | null = null;
  private currentLevel: string = "ALL";
  
  // Quiz
  private quiz: Quiz | null = null;
  private selectedQuizLevel: QuizLevel = "ALL";
  private selectedQuizCount: number = 20;
  private selectedQuizMode: QuizMode = "meaning";

  // DOM Elements
  private flashcardEl!: HTMLDivElement;
  private kanjiDisplay!: HTMLDivElement;
  private kanjiBack!: HTMLDivElement;
  private furiganaDisplay!: HTMLDivElement;
  private furiganaBack!: HTMLDivElement;
  private meaningDisplay!: HTMLDivElement;
  private meaningIdDisplay!: HTMLDivElement;
  private romajiDisplay!: HTMLDivElement;
  private romajiBack!: HTMLDivElement;
  private progressBadge!: HTMLSpanElement;
  private progressBar!: HTMLDivElement;
  private voiceBtn!: HTMLButtonElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private shuffleBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;

  // Speech
  private voices: SpeechSynthesisVoice[] = [];
  private japaneseVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.loadFlashcards();
      this.bindDOMElements();
      this.bindEvents();
      this.updateDisplay();
      this.initSpeech();
      this.aiChat = new AIChat(this);
      this.flashcardManager = new FlashcardManager();
      this.quiz = new Quiz(this.allFlashcards);
      this.bindAddFlashcardEvents();
      this.bindLevelFilter();
      this.bindQuizEvents();
    } catch (error) {
      console.error("Error initializing app:", error);
      this.showError("Gagal memuat data flashcard");
    }
  }

  private async loadFlashcards(): Promise<void> {
    const response = await fetch("/flashcards.json");
    if (!response.ok) {
      throw new Error("Failed to load flashcards");
    }
    const data: FlashcardData = await response.json();
    this.allFlashcards = data.flashcards;
    this.flashcards = [...this.allFlashcards];
    this.originalOrder = [...this.flashcards];
  }

  private bindDOMElements(): void {
    this.flashcardEl = document.getElementById("flashcard") as HTMLDivElement;
    this.kanjiDisplay = document.getElementById("kanjiDisplay") as HTMLDivElement;
    this.kanjiBack = document.getElementById("kanjiBack") as HTMLDivElement;
    this.furiganaDisplay = document.getElementById("furiganaDisplay") as HTMLDivElement;
    this.furiganaBack = document.getElementById("furiganaBack") as HTMLDivElement;
    this.meaningDisplay = document.getElementById("meaningDisplay") as HTMLDivElement;
    this.meaningIdDisplay = document.getElementById("meaningIdDisplay") as HTMLDivElement;
    this.romajiDisplay = document.getElementById("romajiDisplay") as HTMLDivElement;
    this.romajiBack = document.getElementById("romajiBack") as HTMLDivElement;
    this.progressBadge = document.getElementById("progressBadge") as HTMLSpanElement;
    this.progressBar = document.getElementById("progressBar") as HTMLDivElement;
    this.voiceBtn = document.getElementById("voiceBtn") as HTMLButtonElement;
    this.prevBtn = document.getElementById("prevBtn") as HTMLButtonElement;
    this.nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;
    this.shuffleBtn = document.getElementById("shuffleBtn") as HTMLButtonElement;
    this.resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
  }

  private bindEvents(): void {
    // Flashcard click - flip
    this.flashcardEl.addEventListener("click", () => this.flipCard());

    // Navigation buttons
    this.prevBtn.addEventListener("click", () => this.prevCard());
    this.nextBtn.addEventListener("click", () => this.nextCard());

    // Action buttons
    this.shuffleBtn.addEventListener("click", () => this.toggleShuffle());
    this.resetBtn.addEventListener("click", () => this.reset());

    // Voice button
    this.voiceBtn.addEventListener("click", () => this.speak());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyboard(e));
  }

  private handleKeyboard(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowLeft":
        this.prevCard();
        break;
      case "ArrowRight":
        this.nextCard();
        break;
      case "f":
      case "F":
        e.preventDefault();
        this.flipCard();
        break;
      case "s":
      case "S":
        this.speak();
        break;
    }
  }

  private flipCard(): void {
    this.isFlipped = !this.isFlipped;
    this.flashcardEl.classList.toggle("flipped", this.isFlipped);
  }

  private prevCard(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.changeCard();
    }
  }

  private nextCard(): void {
    if (this.currentIndex < this.flashcards.length - 1) {
      this.currentIndex++;
      this.changeCard();
    }
  }

  private changeCard(): void {
    // Reset flip state
    this.isFlipped = false;
    this.flashcardEl.classList.remove("flipped");

    // Add animation class
    this.flashcardEl.classList.add("changing");
    setTimeout(() => {
      this.flashcardEl.classList.remove("changing");
    }, 300);

    this.updateDisplay();

    // Update AI chat context
    if (this.aiChat) {
      this.aiChat.updateContext();
    }
  }

  private updateDisplay(): void {
    const card = this.flashcards[this.currentIndex];

    // Update front side
    this.kanjiDisplay.textContent = card.kanji;
    this.furiganaDisplay.textContent = card.furigana;
    
    // Handle romaji - hide if empty
    if (card.romaji) {
      this.romajiDisplay.textContent = card.romaji;
      this.romajiDisplay.style.display = "block";
      this.romajiBack.textContent = card.romaji;
      this.romajiBack.style.display = "block";
    } else {
      this.romajiDisplay.style.display = "none";
      this.romajiBack.style.display = "none";
    }

    // Update back side
    this.kanjiBack.textContent = card.kanji;
    this.furiganaBack.textContent = card.furigana;
    this.meaningDisplay.textContent = card.meaning;
    
    // Meaning ID (Indonesian)
    if (card.meaning_id) {
        this.meaningIdDisplay.textContent = card.meaning_id;
        this.meaningIdDisplay.style.display = "block";
    } else {
        this.meaningIdDisplay.style.display = "none";
    }
    
    // Romaji Back handled above

    // Update progress
    const current = this.currentIndex + 1;
    const total = this.flashcards.length;
    this.progressBadge.textContent = `${current} / ${total}`;

    // Update progress bar
    const percentage = (current / total) * 100;
    this.progressBar.style.width = `${percentage}%`;

    // Update button states
    this.prevBtn.disabled = this.currentIndex === 0;
    this.nextBtn.disabled = this.currentIndex === this.flashcards.length - 1;
  }

  private toggleShuffle(): void {
    this.isShuffled = !this.isShuffled;
    this.shuffleBtn.classList.toggle("active", this.isShuffled);

    if (this.isShuffled) {
      this.shuffleCards();
    } else {
      this.flashcards = [...this.originalOrder];
    }

    this.currentIndex = 0;
    this.changeCard();
  }

  private shuffleCards(): void {
    // Fisher-Yates shuffle algorithm
    const shuffled = [...this.flashcards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.flashcards = shuffled;
  }

  private reset(): void {
    this.isShuffled = false;
    this.shuffleBtn.classList.remove("active");
    this.flashcards = [...this.originalOrder];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.flashcardEl.classList.remove("flipped");
    this.updateDisplay();
  }

  private initSpeech(): void {
    // Check if speech synthesis is supported
    if (!("speechSynthesis" in window)) {
      this.voiceBtn.disabled = true;
      this.voiceBtn.title = "Browser tidak mendukung Text-to-Speech";
      return;
    }

    const loadVoices = (): void => {
      this.voices = speechSynthesis.getVoices();
      // Try to find Japanese voice
      this.japaneseVoice =
        this.voices.find(
          (voice) => voice.lang.includes("ja") || voice.lang.includes("JP")
        ) || null;

      // Fallback: try to find any Japanese-supporting voice
      if (!this.japaneseVoice) {
        this.japaneseVoice =
          this.voices.find(
            (voice) =>
              voice.name.toLowerCase().includes("japanese") ||
              voice.name.toLowerCase().includes("japan")
          ) || null;
      }
    };

    loadVoices();

    // Chrome loads voices asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private speak(): void {
    if (!("speechSynthesis" in window)) {
      alert("Browser Anda tidak mendukung Text-to-Speech");
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const card = this.flashcards[this.currentIndex];

    // Use furigana for pronunciation (more accurate for TTS)
    // Get the first reading if there are multiple
    const reading = card.furigana.split("/")[0].trim();

    const utterance = new SpeechSynthesisUtterance(reading);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8; // Slightly slower for learning
    utterance.pitch = 1;

    // Use Japanese voice if available
    if (this.japaneseVoice) {
      utterance.voice = this.japaneseVoice;
    }

    // Visual feedback
    this.voiceBtn.classList.add("speaking");

    utterance.onend = (): void => {
      this.voiceBtn.classList.remove("speaking");
    };

    utterance.onerror = (): void => {
      this.voiceBtn.classList.remove("speaking");
      console.error("Speech synthesis error");
    };

    speechSynthesis.speak(utterance);
  }

  private showError(message: string): void {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 1.2rem;
      z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
  }


  // Bind add flashcard modal events
  private bindAddFlashcardEvents(): void {
    const addBtn = document.getElementById("addFlashcardBtn");
    const modal = document.getElementById("addFlashcardModal");
    const closeBtn = document.getElementById("modalCloseBtn");
    const generateBtn = document.getElementById("generateBtn");
    const saveBtn = document.getElementById("saveFlashcardBtn");
    const kanjiInput = document.getElementById("kanjiInput") as HTMLInputElement;

    // Open modal
    addBtn?.addEventListener("click", () => {
      modal?.classList.add("open");
      kanjiInput?.focus();
    });

    // Close modal
    closeBtn?.addEventListener("click", () => this.closeAddModal());
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) this.closeAddModal();
    });

    // Generate flashcard data
    generateBtn?.addEventListener("click", () => this.generateFlashcard());

    // Enter key to generate
    kanjiInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.generateFlashcard();
    });

    // Save flashcard
    saveBtn?.addEventListener("click", () => this.saveFlashcard());
  }

  private closeAddModal(): void {
    const modal = document.getElementById("addFlashcardModal");
    const previewSection = document.getElementById("previewSection");
    const kanjiInput = document.getElementById("kanjiInput") as HTMLInputElement;
    
    modal?.classList.remove("open");
    if (previewSection) previewSection.style.display = "none";
    if (kanjiInput) kanjiInput.value = "";
    this.pendingFlashcard = null;
  }

  private async generateFlashcard(): Promise<void> {
    const kanjiInput = document.getElementById("kanjiInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;
    const btnText = generateBtn?.querySelector(".btn-text") as HTMLElement;
    const btnLoading = generateBtn?.querySelector(".btn-loading") as HTMLElement;
    const previewSection = document.getElementById("previewSection");

    const kanji = kanjiInput?.value.trim();
    if (!kanji || !this.flashcardManager) return;

    // Show loading state
    generateBtn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (btnLoading) btnLoading.style.display = "flex";

    try {
      const data = await this.flashcardManager.generateFlashcardData(kanji);

      if (data) {
        this.pendingFlashcard = data;

        // Update preview
        const previewKanji = document.getElementById("previewKanji");
        const previewFurigana = document.getElementById("previewFurigana");
        const previewRomaji = document.getElementById("previewRomaji");
        const previewMeaning = document.getElementById("previewMeaning");
        const previewMeaningId = document.getElementById("previewMeaningId");

        if (previewKanji) previewKanji.textContent = data.kanji;
        if (previewFurigana) previewFurigana.textContent = data.furigana;
        if (previewRomaji) previewRomaji.textContent = data.romaji;
        if (previewMeaning) previewMeaning.textContent = data.meaning;
        if (previewMeaningId) previewMeaningId.textContent = data.meaning_id || "-";

        // Show preview section
        if (previewSection) previewSection.style.display = "block";
      } else {
        alert("Gagal generate data. Pastikan input valid.");
      }
    } catch (error) {
      console.error("Error generating flashcard:", error);
      alert("Terjadi kesalahan saat generate.");
    } finally {
      // Reset button state
      generateBtn.disabled = false;
      if (btnText) btnText.style.display = "inline";
      if (btnLoading) btnLoading.style.display = "none";
    }
  }

  private async saveFlashcard(): Promise<void> {
    if (!this.pendingFlashcard || !this.flashcardManager) return;

    const newFlashcard: Flashcard = {
      id: this.flashcardManager.getNextId(this.flashcards),
      ...this.pendingFlashcard,
    };

    // Save to flashcards.json via API
    const success = await this.flashcardManager.saveFlashcardToFile(newFlashcard);
    
    if (!success) {
      alert("❌ Gagal menyimpan flashcard ke file.");
      return;
    }

    // Add to current flashcards
    this.flashcards.push(newFlashcard);
    this.originalOrder.push(newFlashcard);

    // Go to the new flashcard
    this.currentIndex = this.flashcards.length - 1;
    this.updateDisplay();

    // Update AI Chat context
    if (this.aiChat) {
      this.aiChat.updateContext();
    }

    // Close modal and show success
    this.closeAddModal();
    alert(`✅ Flashcard "${newFlashcard.kanji}" berhasil disimpan ke flashcards.json!`);
  }

  // Level Filter
  private bindLevelFilter(): void {
    const levelFilter = document.getElementById("levelFilter") as HTMLSelectElement;
    if (levelFilter) {
      levelFilter.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        this.currentLevel = target.value;
        this.filterByLevel(this.currentLevel);
      });
    }
  }

  private filterByLevel(level: string): void {
    if (level === "ALL") {
      this.flashcards = [...this.allFlashcards];
    } else {
      this.flashcards = this.allFlashcards.filter(f => f.level === level);
    }
    this.originalOrder = [...this.flashcards];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.isShuffled = false;
    this.updateDisplay();
    this.changeCard();
  }

  // Quiz Events
  private bindQuizEvents(): void {
    const quizBtn = document.getElementById("quizBtn");
    const quizModal = document.getElementById("quizModal");
    const closeQuizModal = document.getElementById("closeQuizModal");
    const startQuizBtn = document.getElementById("startQuizBtn");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    const restartQuizBtn = document.getElementById("restartQuizBtn");

    // Open quiz modal
    quizBtn?.addEventListener("click", () => {
      quizModal?.classList.add("open");
      this.resetQuizUI();
    });

    // Close quiz modal
    closeQuizModal?.addEventListener("click", () => {
      quizModal?.classList.remove("open");
      this.quiz?.endQuiz();
    });

    // Close on overlay click - DISABLED as per user request
    // quizModal?.addEventListener("click", (e) => {
    //   if (e.target === quizModal) {
    //     quizModal.classList.remove("open");
    //     this.quiz?.endQuiz();
    //   }
    // });

    // Level selection
    document.querySelectorAll(".quiz-level-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".quiz-level-btn").forEach(b => b.classList.remove("active"));
        (e.target as HTMLElement).classList.add("active");
        this.selectedQuizLevel = (e.target as HTMLElement).dataset.level as QuizLevel;
      });
    });

    // Count selection
    document.querySelectorAll(".quiz-count-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".quiz-count-btn").forEach(b => b.classList.remove("active"));
        (e.target as HTMLElement).classList.add("active");
        this.selectedQuizCount = parseInt((e.target as HTMLElement).dataset.count || "20");
      });
    });

    // Mode selection
    document.querySelectorAll(".quiz-mode-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".quiz-mode-btn").forEach(b => b.classList.remove("active"));
        (e.target as HTMLElement).classList.add("active");
        this.selectedQuizMode = (e.target as HTMLElement).dataset.mode as QuizMode;
      });
    });

    // Start quiz
    startQuizBtn?.addEventListener("click", () => {
      this.startQuiz();
    });

    // Next question
    nextQuestionBtn?.addEventListener("click", () => {
      this.showNextQuestion();
    });

    // Restart quiz
    restartQuizBtn?.addEventListener("click", () => {
      this.resetQuizUI();
    });
  }

  private resetQuizUI(): void {
    const quizSetup = document.getElementById("quizSetup");
    const quizQuestion = document.getElementById("quizQuestion");
    const quizResults = document.getElementById("quizResults");

    quizSetup!.style.display = "block";
    quizQuestion!.style.display = "none";
    quizResults!.style.display = "none";
  }

  private startQuiz(): void {
    if (!this.quiz) return;

    const question = this.quiz.startQuiz(this.selectedQuizLevel, this.selectedQuizCount, this.selectedQuizMode);
    if (!question) {
      alert("Tidak cukup flashcard untuk kuis ini!");
      return;
    }

    const quizSetup = document.getElementById("quizSetup");
    const quizQuestion = document.getElementById("quizQuestion");

    quizSetup!.style.display = "none";
    quizQuestion!.style.display = "block";

    this.displayQuestion(question);
  }

  private displayQuestion(question: QuizQuestion): void {
    const quizKanji = document.getElementById("quizKanji");
    const quizFurigana = document.getElementById("quizFurigana");
    const quizOptions = document.getElementById("quizOptions");
    const quizProgressText = document.getElementById("quizProgressText");
    const quizScoreText = document.getElementById("quizScoreText");
    const quizProgressBar = document.getElementById("quizProgressBar");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    const quizRomajiHint = document.getElementById("quizRomajiHint");
    const quizMeaningFeedback = document.getElementById("quizMeaningFeedback");

    const progress = this.quiz!.getProgress();

    quizKanji!.textContent = question.flashcard.kanji;
    
    // Reset meaning feedback
    quizMeaningFeedback!.style.display = 'none';
    quizMeaningFeedback!.textContent = '';
    
    // Show/hide furigana based on mode
    // For reading mode, hide furigana since that's what user needs to guess
    if (question.mode === 'reading') {
      quizFurigana!.textContent = '???';
      quizFurigana!.style.color = 'var(--text-secondary)';
      // Show romaji hint container for reading mode
      quizRomajiHint!.style.display = 'block';
    } else {
      quizFurigana!.textContent = question.flashcard.furigana;
      quizFurigana!.style.color = '';
      // Hide romaji hint container for meaning mode
      quizRomajiHint!.style.display = 'none';
    }
    
    quizProgressText!.textContent = `${progress.current} / ${progress.total}`;
    quizScoreText!.textContent = `Skor: ${progress.score}`;
    quizProgressBar!.style.width = `${(progress.current / progress.total) * 100}%`;
    nextQuestionBtn!.style.display = "none";

    // Reset romaji toggle state
    const romajiToggleBtn = document.getElementById("romajiToggleBtn");
    romajiToggleBtn!.textContent = "🔒 Sembunyikan Romaji";
    // We'll use a data attribute to track state since we removed the text element
    romajiToggleBtn!.dataset.visible = "true";

    // Clear and add options
    quizOptions!.innerHTML = "";
    const showRomaji = question.mode === 'reading' && question.optionsRomaji;
    
    question.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option-btn";
      
      if (showRomaji && question.optionsRomaji) {
        // Create option with furigana and romaji (visible by default now)
        btn.innerHTML = `
          <span class="option-furigana">${option}</span>
          <span class="option-romaji" style="display: inline;">(${question.optionsRomaji[index]})</span>
        `;
      } else {
        btn.textContent = option;
      }
      
      btn.addEventListener("click", () => this.handleAnswer(index, question.correctIndex));
      quizOptions!.appendChild(btn);
    });

    // Bind romaji toggle for reading mode
    if (question.mode === 'reading') {
      romajiToggleBtn!.onclick = () => {
        const isCurrentlyVisible = romajiToggleBtn!.dataset.visible === "true";
        const newState = !isCurrentlyVisible;
        
        romajiToggleBtn!.dataset.visible = newState ? "true" : "false";
        romajiToggleBtn!.textContent = newState ? "🔒 Sembunyikan Romaji" : "💡 Tampilkan Romaji";
        
        // Toggle romaji on all options
        document.querySelectorAll(".option-romaji").forEach(el => {
          (el as HTMLElement).style.display = newState ? "inline" : "none";
        });
      };
    }
  }

  private handleAnswer(selectedIndex: number, correctIndex: number): void {
    const quizOptions = document.getElementById("quizOptions");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    const quizMeaningFeedback = document.getElementById("quizMeaningFeedback");
    const buttons = quizOptions!.querySelectorAll(".quiz-option-btn");

    // Disable all buttons
    buttons.forEach(btn => btn.classList.add("disabled"));

    // Show correct/wrong
    buttons[correctIndex].classList.add("correct");
    if (selectedIndex !== correctIndex) {
      buttons[selectedIndex].classList.add("wrong");
    }

    // Check answer
    this.quiz!.checkAnswer(selectedIndex);
    
    // Show meaning feedback for reading mode
    const currentQuestion = this.quiz!.getCurrentQuestion();
    if (currentQuestion && currentQuestion.mode === 'reading') {
      const meaning = currentQuestion.flashcard.meaning_id || currentQuestion.flashcard.meaning;
      quizMeaningFeedback!.textContent = `Arti: ${meaning}`;
      quizMeaningFeedback!.style.display = 'block';
    }

    // Show next button or results
    if (this.quiz!.isFinished()) {
      setTimeout(() => this.showResults(), 2000); // Increased delay to read feedback
    } else {
      nextQuestionBtn!.style.display = "block";
    }
  }

  private showNextQuestion(): void {
    const question = this.quiz!.nextQuestion();
    if (question) {
      this.displayQuestion(question);
    } else {
      this.showResults();
    }
  }

  private showResults(): void {
    const quizQuestion = document.getElementById("quizQuestion");
    const quizResults = document.getElementById("quizResults");
    const scoreNumber = document.getElementById("scoreNumber");
    const correctCount = document.getElementById("correctCount");
    const wrongCount = document.getElementById("wrongCount");

    const results = this.quiz!.getResults();

    quizQuestion!.style.display = "none";
    quizResults!.style.display = "block";

    scoreNumber!.textContent = results.percentage.toString();
    correctCount!.textContent = results.correct.toString();
    wrongCount!.textContent = results.wrong.toString();
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new FlashcardApp();
});
