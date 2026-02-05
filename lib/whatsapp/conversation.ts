// Conversation Store Management

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  nlu?: {
    keywords: string[];
    entities: { type: string; text: string }[];
    sentiment: string;
  };
}

export interface Conversation {
  messages: Message[];
  lastAssessment: any;
  lastActivity: number;
  language?: string; // Detected/preferred language for the conversation
}

// In-memory conversation store (per phone number)
// In production, use Redis or a database
const conversationStore = new Map<string, Conversation>();

// Clean up old conversations (older than 1 hour)
const CONVERSATION_TTL = 60 * 60 * 1000; // 1 hour
const MAX_MESSAGES = 10;

export function cleanupOldConversations(): void {
  const now = Date.now();
  for (const [key, value] of conversationStore.entries()) {
    if (now - value.lastActivity > CONVERSATION_TTL) {
      conversationStore.delete(key);
    }
  }
}

export function getConversation(userId: string): Conversation | undefined {
  return conversationStore.get(userId);
}

export function createConversation(userId: string): Conversation {
  const conversation: Conversation = {
    messages: [],
    lastAssessment: null,
    lastActivity: Date.now()
  };
  conversationStore.set(userId, conversation);
  return conversation;
}

export function getOrCreateConversation(userId: string): Conversation {
  let conversation = conversationStore.get(userId);
  if (!conversation) {
    conversation = createConversation(userId);
  }
  return conversation;
}

export function deleteConversation(userId: string): void {
  conversationStore.delete(userId);
}

export function addMessage(userId: string, message: Message): void {
  const conversation = getOrCreateConversation(userId);
  conversation.messages.push(message);
  conversation.lastActivity = Date.now();
  
  // Keep only last N messages to avoid token limits
  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  }
  
  conversationStore.set(userId, conversation);
}

export function setLastAssessment(userId: string, assessment: any): void {
  const conversation = getOrCreateConversation(userId);
  conversation.lastAssessment = assessment;
  conversationStore.set(userId, conversation);
}

export function setConversationLanguage(userId: string, language: string): void {
  const conversation = getOrCreateConversation(userId);
  conversation.language = language;
  conversationStore.set(userId, conversation);
}

export function updateConversation(userId: string, conversation: Conversation): void {
  conversationStore.set(userId, conversation);
}
