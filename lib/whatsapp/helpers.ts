// WhatsApp Helper Functions

// Detect language from text
export function detectLanguage(text: string): string {
  const hindiRegex = /[\u0900-\u097F]/;
  const spanishWords = /\b(hola|tengo|dolor|fiebre|cabeza|estómago)\b/i;
  
  if (hindiRegex.test(text)) return 'Hindi';
  if (spanishWords.test(text)) return 'Spanish';
  return 'English';
}

// Check for emergency keywords
export function isEmergency(text: string): boolean {
  const emergencyKeywords = [
    'chest pain', 'can\'t breathe', 'cannot breathe', 'heart attack', 'stroke', 
    'unconscious', 'severe bleeding', 'suicide', 'overdose', 'choking', 
    'seizure', 'not breathing', 'dying', 'emergency', 'passing out',
    'numbness face', 'slurred speech', 'severe head'
  ];
  const lowerText = text.toLowerCase();
  return emergencyKeywords.some(keyword => lowerText.includes(keyword));
}

// Format urgency with emoji
export function getUrgencyEmoji(level: string): string {
  switch (level?.toLowerCase()) {
    case 'emergency': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '📋';
  }
}

// Visual urgency bar (kept for potential use, simplified)
export function getUrgencyBar(level: string): string {
  switch (level?.toLowerCase()) {
    case 'emergency': return '🔴 Seek help NOW';
    case 'high': return '🟠 See doctor soon';
    case 'medium': return '🟡 Monitor closely';
    case 'low': return '🟢 Self-care should help';
    default: return '⚪ Assessing...';
  }
}

// Generate follow-up questions - simplified
export function generateFollowUpQuestions(assessment: any, userInput: string): string {
  const questions: string[] = [];
  const input = userInput.toLowerCase();
  
  // Basic questions if not already answered
  if (!input.match(/\d+\s*(day|hour|week)/)) {
    questions.push("How long have you had these symptoms?");
  }
  if (!input.match(/mild|moderate|severe|\d+\/10/)) {
    questions.push("How severe is it (mild/moderate/severe)?");
  }
  if (!input.includes('medication') && !input.includes('taking')) {
    questions.push("Are you taking any medications?");
  }
  
  questions.push("Is it getting better, worse, or staying the same?");
  
  return questions.slice(0, 2).map((q, i) => `${i + 1}. ${q}`).join('\n');
}

// Handle numbered quick replies (1, 2, 3) - simplified
export function handleQuickReply(reply: string, lastAssessment: any): string | null {
  if (!lastAssessment) return null;
  
  const d = lastAssessment;
  
  if (reply === '1') {
    return `📚 *Details*\n\n` +
      `*Condition:*\n${d.analysis}\n\n` +
      `*Causes:*\n${d.probable_causes.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n\n` +
      `_Any questions?_`;
  }
  
  if (reply === '2') {
    return `💊 *Treatment Tips*\n\n` +
      `⚠️ Always consult a doctor before taking medications.\n\n` +
      `*Recommended:*\n${d.home_remedies.map((r: string) => `• ${r}`).join('\n')}\n\n` +
      `*OTC options:* Ask your pharmacist about suitable pain relievers or symptom-specific medications.\n\n` +
      `_Need more info?_`;
  }
  
  if (reply === '3') {
    return `⚠️ *Warning Signs*\n\n` +
      `*Seek immediate care if:*\n` +
      `• Difficulty breathing\n` +
      `• Chest pain\n` +
      `• High fever (>103°F/39.4°C)\n` +
      `• Confusion\n` +
      `• Symptoms rapidly worsen\n\n` +
      `*Your urgency:* ${getUrgencyEmoji(d.urgency_level)} ${d.urgency_level}\n\n` +
      `_How are you feeling now?_`;
  }
  
  return null;
}
