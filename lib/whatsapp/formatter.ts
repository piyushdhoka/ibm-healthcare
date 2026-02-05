// WhatsApp Response Formatter - Clean & Simple

import { getUrgencyEmoji } from './helpers';

export interface AssessmentData {
  analysis: string;
  probable_causes: string[];
  urgency_level: string;
  home_remedies: string[];
  medical_advice: string;
  disclaimer: string;
}

// Simple urgency indicator
function getUrgencyIndicator(level: string): string {
  switch (level?.toLowerCase()) {
    case 'emergency': return '🔴 EMERGENCY';
    case 'high': return '🟠 HIGH';
    case 'medium': return '🟡 MEDIUM';
    case 'low': return '🟢 LOW';
    default: return '⚪ UNKNOWN';
  }
}

// Format assessment response - SIMPLIFIED
export function formatAssessmentResponse(
  assessment: AssessmentData,
  userInput: string,
  nluKeywords: string[] = [],
  voiceTranscription?: string
): string {
  const voiceNote = voiceTranscription 
    ? `🎤 _"${voiceTranscription}"_\n\n` 
    : '';

  return voiceNote +
    `${getUrgencyEmoji(assessment.urgency_level)} *Health Assessment*\n\n` +
    
    `*Summary:*\n${assessment.analysis}\n\n` +
    
    `*Possible Causes:*\n${assessment.probable_causes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n` +
    
    `*Urgency:* ${getUrgencyIndicator(assessment.urgency_level)}\n\n` +
    
    `*Home Care:*\n${assessment.home_remedies.map(r => `• ${r}`).join('\n')}\n\n` +
    
    `*Medical Advice:*\n${assessment.medical_advice}\n\n` +
    
    `---\n` +
    `*Reply:* 1=Details | 2=Meds | 3=Warning signs | new=Reset\n\n` +
    
    `_${assessment.disclaimer}_`;
}

// Format more details response
export function formatMoreDetails(assessment: AssessmentData): string {
  return `📚 *Detailed Assessment*\n\n` +
    `*Analysis:*\n${assessment.analysis}\n\n` +
    `*Causes:*\n${assessment.probable_causes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n` +
    `*Home Remedies:*\n${assessment.home_remedies.map(r => `• ${r}`).join('\n')}\n\n` +
    `*When to see a doctor:*\n${assessment.medical_advice}\n\n` +
    `_Ask me any follow-up questions!_`;
}

// Format remedies response
export function formatRemedies(remedies: string[]): string {
  return `🌿 *Home Remedies*\n\n` +
    remedies.map((r, i) => `${i + 1}. ${r}`).join('\n') +
    `\n\n_See a doctor if symptoms persist beyond 3-5 days._`;
}
