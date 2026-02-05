import { NextResponse } from 'next/server';

// IBM Watson TTS Voices - Neural V3 voices for best quality
const TTS_VOICES: Record<string, { voice: string; gender: string; description: string }[]> = {
  'English': [
    { voice: 'en-US_AllisonV3Voice', gender: 'female', description: 'American English - Allison' },
    { voice: 'en-US_MichaelV3Voice', gender: 'male', description: 'American English - Michael' },
    { voice: 'en-US_EmilyV3Voice', gender: 'female', description: 'American English - Emily' },
    { voice: 'en-US_HenryV3Voice', gender: 'male', description: 'American English - Henry' },
    { voice: 'en-GB_CharlotteV3Voice', gender: 'female', description: 'British English - Charlotte' },
    { voice: 'en-GB_JamesV3Voice', gender: 'male', description: 'British English - James' },
    { voice: 'en-AU_HeidiExpressive', gender: 'female', description: 'Australian English - Heidi (Expressive)' },
    { voice: 'en-AU_JackExpressive', gender: 'male', description: 'Australian English - Jack (Expressive)' },
  ],
  'Spanish': [
    { voice: 'es-ES_LauraV3Voice', gender: 'female', description: 'Castilian Spanish - Laura' },
    { voice: 'es-ES_EnriqueV3Voice', gender: 'male', description: 'Castilian Spanish - Enrique' },
    { voice: 'es-LA_SofiaV3Voice', gender: 'female', description: 'Latin American Spanish - Sofia' },
    { voice: 'es-US_SofiaV3Voice', gender: 'female', description: 'US Spanish - Sofia' },
  ],
  'French': [
    { voice: 'fr-FR_ReneeV3Voice', gender: 'female', description: 'French - Renee' },
    { voice: 'fr-FR_NicolasV3Voice', gender: 'male', description: 'French - Nicolas' },
    { voice: 'fr-CA_LouiseV3Voice', gender: 'female', description: 'Canadian French - Louise' },
  ],
  'German': [
    { voice: 'de-DE_BirgitV3Voice', gender: 'female', description: 'German - Birgit' },
    { voice: 'de-DE_DieterV3Voice', gender: 'male', description: 'German - Dieter' },
    { voice: 'de-DE_ErikaV3Voice', gender: 'female', description: 'German - Erika' },
  ],
  'Italian': [
    { voice: 'it-IT_FrancescaV3Voice', gender: 'female', description: 'Italian - Francesca' },
  ],
  'Portuguese': [
    { voice: 'pt-BR_IsabelaV3Voice', gender: 'female', description: 'Brazilian Portuguese - Isabela' },
  ],
  'Japanese': [
    { voice: 'ja-JP_EmiV3Voice', gender: 'female', description: 'Japanese - Emi' },
  ],
  'Korean': [
    { voice: 'ko-KR_JinV3Voice', gender: 'female', description: 'Korean - Jin' },
  ],
  'Dutch': [
    { voice: 'nl-NL_MerelV3Voice', gender: 'female', description: 'Dutch - Merel' },
  ],
  'Chinese': [
    { voice: 'zh-CN_LiNaVoice', gender: 'female', description: 'Chinese - LiNa' },
    { voice: 'zh-CN_WangWeiVoice', gender: 'male', description: 'Chinese - WangWei' },
  ],
  // Hindi fallback to English with transliteration note
  'Hindi': [
    { voice: 'en-US_AllisonV3Voice', gender: 'female', description: 'Hindi (via English voice)' },
  ],
};

// Audio format options
const AUDIO_FORMATS: Record<string, string> = {
  'mp3': 'audio/mp3',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg;codecs=opus',
  'webm': 'audio/webm;codecs=opus',
  'flac': 'audio/flac',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      text, 
      language = 'English', 
      voicePreference = 'female',
      audioFormat = 'mp3',
      pitch = 0,        // -100 to 100
      rate = 0,         // -100 to 100  
      useSSML = false,
    } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const API_KEY = process.env.IBM_TTS_API_KEY;
    const SERVICE_URL = process.env.IBM_TTS_URL;

    if (!API_KEY || !SERVICE_URL) {
      return NextResponse.json({ error: 'Missing IBM TTS credentials' }, { status: 500 });
    }

    // Select voice based on language and preference
    const voices = TTS_VOICES[language] || TTS_VOICES['English'];
    let selectedVoice = voices.find(v => v.gender === voicePreference) || voices[0];

    // Build the text/SSML content
    let content = text;
    
    if (useSSML || pitch !== 0 || rate !== 0) {
      // Use SSML for advanced control
      const prosodyAttrs: string[] = [];
      if (pitch !== 0) prosodyAttrs.push(`pitch="${pitch > 0 ? '+' : ''}${pitch}%"`);
      if (rate !== 0) prosodyAttrs.push(`rate="${rate > 0 ? '+' : ''}${rate}%"`);
      
      const prosodyTag = prosodyAttrs.length > 0 
        ? `<prosody ${prosodyAttrs.join(' ')}>${escapeXML(text)}</prosody>`
        : escapeXML(text);
      
      content = `<speak version="1.0">
        <voice name="${selectedVoice.voice}">
          ${prosodyTag}
        </voice>
      </speak>`;
    }

    // Determine content type and accept header
    const acceptFormat = AUDIO_FORMATS[audioFormat] || AUDIO_FORMATS['mp3'];
    const contentType = useSSML || pitch !== 0 || rate !== 0 
      ? 'application/ssml+xml' 
      : 'application/json';

    const requestBody = contentType === 'application/json' 
      ? JSON.stringify({ text: content })
      : content;

    const response = await fetch(
      `${SERVICE_URL}/v1/synthesize?voice=${selectedVoice.voice}&accept=${encodeURIComponent(acceptFormat)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`,
          'Content-Type': contentType,
        },
        body: requestBody,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error:', errorText);
      
      // Fallback to default English voice if selected voice fails
      if (language !== 'English') {
        const fallbackVoice = TTS_VOICES['English'][0];
        const fallbackResponse = await fetch(
          `${SERVICE_URL}/v1/synthesize?voice=${fallbackVoice.voice}&accept=${encodeURIComponent(acceptFormat)}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          }
        );
        
        if (fallbackResponse.ok) {
          const audioBuffer = await fallbackResponse.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': acceptFormat.split(';')[0],
              'Content-Length': audioBuffer.byteLength.toString(),
              'X-Voice-Used': fallbackVoice.voice,
              'X-Fallback': 'true',
            },
          });
        }
      }
      
      throw new Error(`TTS API Error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': acceptFormat.split(';')[0],
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-Voice-Used': selectedVoice.voice,
        'X-Language': language,
      },
    });

  } catch (error: any) {
    console.error('Error in TTS route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// GET endpoint to list available voices
export async function GET() {
  const voiceList = Object.entries(TTS_VOICES).map(([language, voices]) => ({
    language,
    voices: voices.map(v => ({
      id: v.voice,
      gender: v.gender,
      description: v.description,
    })),
  }));

  return NextResponse.json({
    voices: voiceList,
    formats: Object.keys(AUDIO_FORMATS),
    features: [
      'SSML support for advanced speech control',
      'Pitch adjustment (-100 to +100)',
      'Rate/speed adjustment (-100 to +100)',
      'Multiple audio formats (MP3, WAV, OGG, WebM, FLAC)',
      'Neural V3 voices for natural speech',
      'Expressive voices for Australian English',
    ],
  });
}

// Helper to escape XML special characters for SSML
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
