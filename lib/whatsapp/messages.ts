// WhatsApp Message Templates - Clean & Simple

export const WELCOME_MESSAGE = `🏥 *Health Assistant*

Hi! I can help you understand your symptoms.

*How to use:*
• Type your symptoms
• Or send a voice message 🎤

*Example:*
_"I have a headache and fever for 2 days"_

*Commands:* help | new | 1 | 2 | 3

_Powered by IBM Granite AI_`;

export const HELP_MESSAGE = `ℹ️ *Help*

*Describe your symptoms with:*
• What you feel
• How long (hours/days)
• Severity (mild/moderate/severe)

*Example:* _"Sore throat and runny nose for 2 days, moderate severity"_

*Commands:*
• *new* - Start over
• *more* - More details
• *1* - Detailed info
• *2* - Medication tips
• *3* - Warning signs

🚨 Emergency? Call 911 (US) / 112 (India/EU)`;

export const EMERGENCY_MESSAGE = `🚨 *EMERGENCY*

This sounds serious. Please call emergency services NOW:

🇺🇸 USA: *911*
🇮🇳 India: *112*
🇬🇧 UK: *999*

Do not wait.

_If not an emergency, describe your symptoms again._`;

export const CONVERSATION_CLEARED = `🔄 *Conversation cleared!*

Describe your symptoms and I'll help.`;

export const GOODBYE_MESSAGE = `👋 Take care! Type *hi* to chat again.`;

export const NO_ASSESSMENT_MESSAGE = `ℹ️ No assessment yet. Describe your symptoms first.`;

export const VOICE_ERROR_MESSAGE = (error: string) => `🎤 Couldn't process audio: ${error}\n\nPlease type your symptoms instead.`;

export const VOICE_UNCLEAR_MESSAGE = `🎤 Couldn't understand the audio clearly.\n\nTry speaking clearly or type your symptoms instead.`;

export const NO_MESSAGE_RECEIVED = `ℹ️ No message received. Describe your symptoms or send a voice message.`;

export const ERROR_MESSAGE = `❌ Something went wrong. Try again or type *new* to start over.`;

export const CHAT_FOLLOWUP = `\n\n_Ask me anything else about your health!_`;

export const COULD_NOT_UNDERSTAND = `🤔 Could you describe your symptoms more clearly?\n\n_Example: "I have a headache and nausea since this morning"_`;
