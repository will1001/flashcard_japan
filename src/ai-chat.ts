import type { Flashcard, ChatMessage, OpenRouterResponse } from "./types";

export class AIChat {
  private flashcardApp: {
    flashcards: Flashcard[];
    currentIndex: number;
  };
  private apiKey: string;
  private apiUrl: string = "https://openrouter.ai/api/v1/chat/completions";
  private model: string = "openai/gpt-4o-mini";
  private isOpen: boolean = false;
  private messages: ChatMessage[] = [];
  private isLoading: boolean = false;

  // DOM Elements
  private toggleBtn!: HTMLButtonElement;
  private container!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private contextKanji!: HTMLSpanElement;

  constructor(flashcardApp: { flashcards: Flashcard[]; currentIndex: number }) {
    this.flashcardApp = flashcardApp;
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

    this.init();
  }

  private init(): void {
    this.createChatUI();
    this.bindEvents();
  }

  private createChatUI(): void {
    // Chat toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "chat-toggle-btn";
    toggleBtn.id = "chatToggleBtn";
    toggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="chat-badge">AI</span>
    `;
    document.body.appendChild(toggleBtn);

    // Chat container
    const chatContainer = document.createElement("div");
    chatContainer.className = "chat-container";
    chatContainer.id = "chatContainer";
    chatContainer.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <span class="chat-ai-icon">🤖</span>
          <div>
            <h3>AI Sensei</h3>
            <span class="chat-status">Online - GPT-4o Mini</span>
          </div>
        </div>
        <button class="chat-close-btn" id="chatCloseBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-welcome">
          <div class="welcome-icon">🎌</div>
          <h4>Selamat Datang!</h4>
          <p>Tanyakan apapun tentang kanji yang sedang kamu pelajari. Contoh:</p>
          <div class="quick-prompts">
            <button class="quick-prompt" data-prompt="contoh kalimat">📝 Contoh Kalimat</button>
            <button class="quick-prompt" data-prompt="contoh soal N3">📚 Soal JLPT N3</button>
            <button class="quick-prompt" data-prompt="kata turunan">🔤 Kata Turunan</button>
            <button class="quick-prompt" data-prompt="cara mengingat">🧠 Tips Menghafal</button>
          </div>
        </div>
      </div>
      <div class="chat-input-container">
        <div class="current-kanji-context" id="currentKanjiContext">
          <span class="context-label">Kanji:</span>
          <span class="context-kanji" id="contextKanji">日</span>
        </div>
        <div class="chat-input-wrapper">
          <textarea 
            class="chat-input" 
            id="chatInput" 
            placeholder="Tanyakan tentang kanji ini..."
            rows="1"
          ></textarea>
          <button class="chat-send-btn" id="chatSendBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(chatContainer);

    // Store references
    this.toggleBtn = toggleBtn;
    this.container = chatContainer;
    this.messagesEl = document.getElementById("chatMessages") as HTMLDivElement;
    this.inputEl = document.getElementById("chatInput") as HTMLTextAreaElement;
    this.sendBtn = document.getElementById("chatSendBtn") as HTMLButtonElement;
    this.closeBtn = document.getElementById("chatCloseBtn") as HTMLButtonElement;
    this.contextKanji = document.getElementById("contextKanji") as HTMLSpanElement;
  }

  private bindEvents(): void {
    // Toggle chat
    this.toggleBtn.addEventListener("click", () => this.toggle());
    this.closeBtn.addEventListener("click", () => this.close());

    // Send message
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + "px";
    });

    // Quick prompts
    document.querySelectorAll(".quick-prompt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prompt = (btn as HTMLButtonElement).dataset.prompt;
        if (prompt) {
          this.handleQuickPrompt(prompt);
        }
      });
    });
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle("open", this.isOpen);
    this.toggleBtn.classList.toggle("active", this.isOpen);

    if (this.isOpen) {
      this.updateContext();
      this.inputEl.focus();
    }
  }

  private close(): void {
    this.isOpen = false;
    this.container.classList.remove("open");
    this.toggleBtn.classList.remove("active");
  }

  public updateContext(): void {
    const currentCard = this.flashcardApp.flashcards[this.flashcardApp.currentIndex];
    if (currentCard) {
      this.contextKanji.textContent = currentCard.kanji;
    }
  }

  private handleQuickPrompt(promptType: string): void {
    const currentCard = this.flashcardApp.flashcards[this.flashcardApp.currentIndex];
    const kanji = currentCard.kanji;
    const meaning = currentCard.meaning;

    let prompt = "";
    switch (promptType) {
      case "contoh kalimat":
        prompt = `Berikan 3 contoh kalimat dalam bahasa Jepang yang menggunakan kanji "${kanji}" (${meaning}). Sertakan furigana, romaji, dan terjemahan Indonesia.`;
        break;
      case "contoh soal N3":
        prompt = `Buatkan 2 contoh soal JLPT N3 yang berhubungan dengan kanji "${kanji}" (${meaning}). Bisa soal vocabulary, grammar, atau reading. Sertakan pilihan jawaban dan penjelasannya.`;
        break;
      case "kata turunan":
        prompt = `Jelaskan kata-kata turunan atau compound words yang menggunakan kanji "${kanji}" (${meaning}). Berikan minimal 5 contoh dengan furigana dan artinya.`;
        break;
      case "cara mengingat":
        prompt = `Berikan tips dan trik untuk mengingat kanji "${kanji}" (${meaning}). Jelaskan tentang radikal, mnemonics, atau cerita yang bisa membantu menghafal.`;
        break;
    }

    this.inputEl.value = prompt;
    this.sendMessage();
  }

  private async sendMessage(): Promise<void> {
    const userMessage = this.inputEl.value.trim();
    if (!userMessage || this.isLoading) return;

    // Clear input
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";

    // Hide welcome message
    const welcomeEl = this.messagesEl.querySelector(".chat-welcome") as HTMLElement;
    if (welcomeEl) {
      welcomeEl.style.display = "none";
    }

    // Get current kanji context
    const currentCard = this.flashcardApp.flashcards[this.flashcardApp.currentIndex];

    // Add user message to UI
    this.addMessage("user", userMessage);

    // Add context to the message
    const contextMessage = `[Konteks: User sedang mempelajari kanji "${currentCard.kanji}" (${currentCard.furigana}) yang berarti "${currentCard.meaning}"]\n\nPertanyaan: ${userMessage}`;

    // Add to messages history
    this.messages.push({
      role: "user",
      content: contextMessage,
    });

    // Show loading
    this.isLoading = true;
    const loadingEl = this.addMessage("assistant", "", true);

    try {
      const response = await this.callAPI();

      // Remove loading
      loadingEl.remove();

      // Add AI response
      this.addMessage("assistant", response);
      this.messages.push({
        role: "assistant",
        content: response,
      });
    } catch (error) {
      loadingEl.remove();
      this.addMessage("error", "Maaf, terjadi kesalahan. Silakan coba lagi.");
      console.error("AI Chat Error:", error);
    } finally {
      this.isLoading = false;
    }
  }

  private async callAPI(): Promise<string> {
    const systemPrompt = `Kamu adalah "AI Sensei", asisten belajar bahasa Jepang yang ramah dan helpful. 
Tugasmu membantu user mempelajari kanji dan bahasa Jepang. 
Selalu jawab dalam bahasa Indonesia dengan format yang rapi.
Gunakan furigana (dalam tanda kurung) untuk setiap kanji yang kamu tulis.
Berikan penjelasan yang mudah dipahami untuk pemula.
Jika memberikan contoh kalimat, selalu sertakan: kalimat Jepang, romaji, dan terjemahan.`;

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
          { role: "system", content: systemPrompt },
          ...this.messages.slice(-10), // Keep last 10 messages for context
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content;
  }

  private addMessage(role: string, content: string, isLoading = false): HTMLDivElement {
    const messageEl = document.createElement("div");
    messageEl.className = `chat-message ${role}`;

    if (isLoading) {
      messageEl.innerHTML = `
        <div class="message-avatar">${role === "assistant" ? "🤖" : "👤"}</div>
        <div class="message-content">
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
    } else {
      // Convert markdown-like formatting
      const formattedContent = this.formatMessage(content);
      messageEl.innerHTML = `
        <div class="message-avatar">${role === "assistant" ? "🤖" : role === "error" ? "⚠️" : "👤"}</div>
        <div class="message-content">${formattedContent}</div>
      `;
    }

    this.messagesEl.appendChild(messageEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    return messageEl;
  }

  private formatMessage(text: string): string {
    // Basic markdown formatting
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Code
      .replace(/`(.*?)`/g, "<code>$1</code>")
      // Line breaks
      .replace(/\n/g, "<br>")
      // Lists
      .replace(/^- (.*?)(<br>|$)/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>");
  }
}
