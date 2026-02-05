import { NextResponse } from 'next/server';

// IBM Watson STT Language Models - Broadband (16kHz+) for high-quality audio
const STT_MODELS: Record<string, string> = {
  'English': 'en-US_Multimedia',
  'Spanish': 'es-ES_Multimedia',
  'French': 'fr-FR_Multimedia',
  'Hindi': 'hi-IN_Multimedia',
  'German': 'de-DE_Multimedia',
  'Portuguese': 'pt-BR_Multimedia',
  'Italian': 'it-IT_Multimedia',
  'Japanese': 'ja-JP_Multimedia',
  'Korean': 'ko-KR_Multimedia',
  'Chinese': 'zh-CN_Multimedia',
  'Arabic': 'ar-MS_Multimedia',
  'Dutch': 'nl-NL_Multimedia',
  // Fallbacks for telephony (8kHz) audio
  'English-Telephony': 'en-US_Telephony',
  'Spanish-Telephony': 'es-ES_Telephony',
};

// Language detection keywords for auto-detect
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  'Hindi': /[\u0900-\u097F]/,
  'Chinese': /[\u4e00-\u9fff]/,
  'Japanese': /[\u3040-\u309f\u30a0-\u30ff]/,
  'Korean': /[\uac00-\ud7af]/,
  'Arabic': /[\u0600-\u06FF]/,
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;
    const language = (formData.get('language') as string) || 'English';
    const autoDetect = formData.get('autoDetect') === 'true';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const API_KEY = process.env.IBM_STT_API_KEY;
    const SERVICE_URL = process.env.IBM_STT_URL;

    if (!API_KEY || !SERVICE_URL) {
      return NextResponse.json({ error: 'Missing IBM STT credentials' }, { status: 500 });
    }

    // Convert Blob to Buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer());

    // Select appropriate model based on language
    let model = STT_MODELS[language] || STT_MODELS['English'];
    
    // Build query parameters for enhanced recognition
    const queryParams = new URLSearchParams({
      model,
      // Enable smart formatting (dates, times, numbers, currency)
      smart_formatting: 'true',
      // Enable speaker labels if multiple speakers
      speaker_labels: 'false',
      // Enable word confidence scores
      word_confidence: 'true',
      // Enable timestamps for each word
      timestamps: 'true',
      // Enable profanity filtering
      profanity_filter: 'false',
      // Low latency mode for real-time
      low_latency: 'true',
    });

    // If auto-detect is enabled, use multiple language models
    if (autoDetect) {
      // Use the base model which has better multi-language support
      queryParams.set('model', 'en-US_Multimedia');
    }

    const response = await fetch(`${SERVICE_URL}/v1/recognize?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`,
        'Content-Type': audioFile.type || 'audio/webm',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('STT API Error:', errorText);
      
      // Try fallback to telephony model if multimedia fails
      if (errorText.includes('not supported') || errorText.includes('model')) {
        const fallbackModel = STT_MODELS['English-Telephony'];
        queryParams.set('model', fallbackModel);
        
        const fallbackResponse = await fetch(`${SERVICE_URL}/v1/recognize?${queryParams.toString()}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`,
            'Content-Type': audioFile.type || 'audio/webm',
          },
          body: buffer,
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          return processSTTResponse(fallbackData, 'English');
        }
      }
      
      throw new Error(`STT API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return processSTTResponse(data, language);

  } catch (error: any) {
    console.error('Error in STT route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function processSTTResponse(data: any, language: string) {
  // Extract transcript with confidence
  const results = data.results || [];
  
  let fullTranscript = '';
  let confidence = 0;
  let wordDetails: Array<{ word: string; confidence: number; startTime: number; endTime: number }> = [];
  
  for (const result of results) {
    if (result.final && result.alternatives && result.alternatives.length > 0) {
      const alternative = result.alternatives[0];
      fullTranscript += alternative.transcript + ' ';
      confidence = Math.max(confidence, alternative.confidence || 0);
      
      // Extract word-level details if available
      if (alternative.timestamps && alternative.word_confidence) {
        for (let i = 0; i < alternative.timestamps.length; i++) {
          const [word, startTime, endTime] = alternative.timestamps[i];
          const wordConf = alternative.word_confidence[i]?.[1] || 0;
          wordDetails.push({ word, confidence: wordConf, startTime, endTime });
        }
      }
    }
  }

  // Detect language from transcript if needed
  let detectedLanguage = language;
  const transcript = fullTranscript.trim();
  
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(transcript)) {
      detectedLanguage = lang;
      break;
    }
  }

  return NextResponse.json({
    transcript,
    confidence: Math.round(confidence * 100),
    detectedLanguage,
    wordDetails: wordDetails.length > 0 ? wordDetails : undefined,
    speakerLabels: data.speaker_labels || undefined,
  });
}
