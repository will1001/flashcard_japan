import "./style.css";
import type { Flashcard, FlashcardData } from "./types";
import { AIChat } from "./ai-chat";

class FlashcardApp {
  public flashcards: Flashcard[] = [];
  public currentIndex: number = 0;
  private isFlipped: boolean = false;
  private isShuffled: boolean = false;
  private originalOrder: Flashcard[] = [];
  private aiChat: AIChat | null = null;

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
    this.flashcards = data.flashcards;
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
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new FlashcardApp();
});
