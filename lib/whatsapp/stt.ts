// IBM Watson Speech-to-Text Integration - Multilingual Support

// IBM Watson STT Language Models
const STT_MODELS: Record<string, string> = {
  'en': 'en-US_Multimedia',
  'es': 'es-ES_Multimedia',
  'fr': 'fr-FR_Multimedia',
  'de': 'de-DE_Multimedia',
  'hi': 'hi-IN_Multimedia',
  'pt': 'pt-BR_Multimedia',
  'it': 'it-IT_Multimedia',
  'ja': 'ja-JP_Multimedia',
  'ko': 'ko-KR_Multimedia',
  'zh': 'zh-CN_Multimedia',
  'ar': 'ar-MS_Multimedia',
  'nl': 'nl-NL_Multimedia',
};

// Language code to full name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'hi': 'Hindi',
  'pt': 'Portuguese',
  'it': 'Italian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'nl': 'Dutch',
};

interface TranscriptionResult {
  transcript: string;
  detectedLanguage: string;
  confidence: number;
}

// Transcribe audio from Twilio media URL using IBM Watson STT
export async function transcribeAudio(
  mediaUrl: string, 
  preferredLanguage: string = 'en'
): Promise<TranscriptionResult> {
  const STT_API_KEY = process.env.IBM_STT_API_KEY;
  const STT_URL = process.env.IBM_STT_URL;

  if (!STT_API_KEY || !STT_URL) {
    throw new Error('IBM STT credentials not configured');
  }

  // Twilio credentials for downloading media
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials required to download media');
  }

  // Download audio from Twilio
  const audioBuffer = await downloadTwilioMedia(mediaUrl, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  
  // Get content type - Twilio typically sends OGG format for voice messages
  const contentType = 'audio/ogg';

  // Select model based on preferred language
  const langCode = preferredLanguage.toLowerCase().slice(0, 2);
  const model = STT_MODELS[langCode] || STT_MODELS['en'];

  // Build query parameters for enhanced recognition
  const queryParams = new URLSearchParams({
    model,
    smart_formatting: 'true',
    word_confidence: 'true',
    low_latency: 'true',
  });

  // Send to IBM STT
  const sttResponse = await fetch(`${STT_URL}/v1/recognize?${queryParams.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`apikey:${STT_API_KEY}`).toString('base64')}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!sttResponse.ok) {
    const errorText = await sttResponse.text();
    console.error('STT API Error:', errorText);
    
    // Try fallback to English model
    if (langCode !== 'en') {
      const fallbackParams = new URLSearchParams({
        model: STT_MODELS['en'],
        smart_formatting: 'true',
        low_latency: 'true',
      });
      
      const fallbackResponse = await fetch(`${STT_URL}/v1/recognize?${fallbackParams.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`apikey:${STT_API_KEY}`).toString('base64')}`,
          'Content-Type': contentType,
        },
        body: new Uint8Array(audioBuffer),
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        return processSTTResponse(fallbackData, 'en');
      }
    }
    
    throw new Error(`STT API Error: ${sttResponse.statusText}`);
  }

  const data = await sttResponse.json();
  return processSTTResponse(data, langCode);
}

function processSTTResponse(data: any, requestedLang: string): TranscriptionResult {
  const results = data.results || [];
  
  let fullTranscript = '';
  let confidence = 0;
  
  for (const result of results) {
    if (result.final && result.alternatives && result.alternatives.length > 0) {
      const alternative = result.alternatives[0];
      fullTranscript += alternative.transcript + ' ';
      confidence = Math.max(confidence, alternative.confidence || 0);
    }
  }

  const transcript = fullTranscript.trim();
  
  // Try to detect language from script
  let detectedLanguage = LANGUAGE_NAMES[requestedLang] || 'English';
  
  // Check for non-Latin scripts
  if (/[\u0900-\u097F]/.test(transcript)) detectedLanguage = 'Hindi';
  else if (/[\u4e00-\u9fff]/.test(transcript)) detectedLanguage = 'Chinese';
  else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(transcript)) detectedLanguage = 'Japanese';
  else if (/[\uac00-\ud7af]/.test(transcript)) detectedLanguage = 'Korean';
  else if (/[\u0600-\u06FF]/.test(transcript)) detectedLanguage = 'Arabic';

  return {
    transcript,
    detectedLanguage,
    confidence: Math.round(confidence * 100),
  };
}

async function downloadTwilioMedia(
  mediaUrl: string, 
  accountSid: string, 
  authToken: string
): Promise<Buffer> {
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
