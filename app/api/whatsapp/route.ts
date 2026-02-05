import { NextResponse } from 'next/server';
import { analyzeSymptoms } from '@/lib/watson';
import twilio from 'twilio';

// Import modular components
import {
  analyzeWithNLU,
  transcribeAudio,
  detectLanguage,
  isEmergency,
  handleQuickReply,
  cleanupOldConversations,
  getConversation,
  getOrCreateConversation,
  deleteConversation,
  addMessage,
  setLastAssessment,
  formatAssessmentResponse,
  formatMoreDetails,
  formatRemedies,
  WELCOME_MESSAGE,
  HELP_MESSAGE,
  EMERGENCY_MESSAGE,
  CONVERSATION_CLEARED,
  GOODBYE_MESSAGE,
  NO_ASSESSMENT_MESSAGE,
  VOICE_ERROR_MESSAGE,
  VOICE_UNCLEAR_MESSAGE,
  NO_MESSAGE_RECEIVED,
  ERROR_MESSAGE,
  CHAT_FOLLOWUP,
  COULD_NOT_UNDERSTAND,
} from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    cleanupOldConversations();

    const formData = await req.formData();
    let body = (formData.get('Body') as string)?.trim() || '';
    const from = formData.get('From') as string;
    
    // Check for media (audio/voice message)
    const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10);
    const mediaUrl = formData.get('MediaUrl0') as string;
    const mediaType = formData.get('MediaContentType0') as string;
    
    let isVoiceMessage = false;
    let voiceTranscript = '';

    // Handle audio/voice messages
    if (numMedia > 0 && mediaUrl && mediaType?.startsWith('audio')) {
      isVoiceMessage = true;
      try {
        voiceTranscript = await transcribeAudio(mediaUrl);
        if (voiceTranscript) {
          body = voiceTranscript;
        } else {
          return sendTwiMLResponse(VOICE_UNCLEAR_MESSAGE);
        }
      } catch (error: any) {
        console.error('Audio transcription error:', error);
        return sendTwiMLResponse(VOICE_ERROR_MESSAGE(error.message));
      }
    }

    if (!body) {
      return sendTwiMLResponse(NO_MESSAGE_RECEIVED);
    }

    const lowerBody = body.toLowerCase();

    // Handle commands
    if (lowerBody === 'hi' || lowerBody === 'hello' || lowerBody === 'start') {
      return sendTwiMLResponse(WELCOME_MESSAGE);
    }

    if (lowerBody === 'help') {
      return sendTwiMLResponse(HELP_MESSAGE);
    }

    if (lowerBody === 'new' || lowerBody === 'reset' || lowerBody === 'clear') {
      deleteConversation(from);
      return sendTwiMLResponse(CONVERSATION_CLEARED);
    }

    // Get conversation (needed for quick replies)
    let conversation = getConversation(from);

    // Handle numbered quick replies (1, 2, 3)
    if (lowerBody === '1' || lowerBody === '2' || lowerBody === '3') {
      if (conversation?.lastAssessment) {
        const quickReply = handleQuickReply(lowerBody, conversation.lastAssessment);
        if (quickReply) return sendTwiMLResponse(quickReply);
      }
      return sendTwiMLResponse(NO_ASSESSMENT_MESSAGE);
    }

    // Check for emergency
    if (isEmergency(body)) {
      return sendTwiMLResponse(EMERGENCY_MESSAGE);
    }

    // Ensure conversation exists
    conversation = getOrCreateConversation(from);

    // Handle "more" command
    if (lowerBody === 'more' || lowerBody === 'details' || lowerBody === 'explain') {
      if (conversation.lastAssessment) {
        return sendTwiMLResponse(formatMoreDetails(conversation.lastAssessment));
      }
      return sendTwiMLResponse(NO_ASSESSMENT_MESSAGE);
    }

    // Handle "remedies" command
    if (lowerBody === 'remedies' || lowerBody === 'remedy' || lowerBody === 'treatment') {
      if (conversation.lastAssessment?.home_remedies) {
        return sendTwiMLResponse(formatRemedies(conversation.lastAssessment.home_remedies));
      }
      return sendTwiMLResponse(`ℹ️ No remedies available yet.\n\nDescribe your symptoms first.`);
    }

    // Analyze with NLU
    const nluAnalysis = await analyzeWithNLU(body);
    console.log('NLU Analysis:', nluAnalysis);

    // Handle goodbye intent
    if (nluAnalysis.intent === 'conversation_end') {
      return sendTwiMLResponse(GOODBYE_MESSAGE);
    }

    // Add user message to history
    addMessage(from, {
      role: 'user',
      content: body,
      nlu: {
        keywords: nluAnalysis.keywords,
        entities: nluAnalysis.entities,
        sentiment: nluAnalysis.sentiment
      }
    });

    // Get updated conversation
    conversation = getOrCreateConversation(from);

    // Enhance messages with NLU keywords
    const enhancedMessages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.role === 'user' && msg.nlu?.keywords?.length 
        ? `${msg.content} [Keywords: ${msg.nlu.keywords.slice(0, 5).join(', ')}]`
        : msg.content
    }));

    // Call AI
    const language = detectLanguage(body);
    const result = await analyzeSymptoms(enhancedMessages, language);

    // Format response
    let replyText = '';
    const voicePrefix = isVoiceMessage ? `🎤 _Voice: "${voiceTranscript}"_\n\n` : '';

    if (result.type === 'chat' && result.reply) {
      replyText = voicePrefix + result.reply + CHAT_FOLLOWUP;
      addMessage(from, { role: 'assistant', content: result.reply });
    } else if (result.type === 'assessment' && result.data) {
      setLastAssessment(from, result.data);
      replyText = formatAssessmentResponse(
        result.data,
        body,
        nluAnalysis.keywords,
        isVoiceMessage ? voiceTranscript : undefined
      );
      addMessage(from, { role: 'assistant', content: `Assessment: ${result.data.analysis}` });
    } else {
      replyText = voicePrefix + COULD_NOT_UNDERSTAND;
    }

    return sendTwiMLResponse(replyText);

  } catch (error: any) {
    console.error('Error in WhatsApp webhook:', error);
    return sendTwiMLResponse(ERROR_MESSAGE);
  }
}

function sendTwiMLResponse(message: string) {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message(message);

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
