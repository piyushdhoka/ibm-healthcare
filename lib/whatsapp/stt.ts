// IBM Watson Speech-to-Text Integration

// Transcribe audio from Twilio media URL using IBM Watson STT
export async function transcribeAudio(mediaUrl: string): Promise<string> {
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
  
  // Get content type
  const contentType = 'audio/ogg'; // Twilio typically sends OGG format

  // Send to IBM STT
  const sttResponse = await fetch(`${STT_URL}/v1/recognize?model=en-US_BroadbandModel`, {
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
    throw new Error(`STT API Error: ${sttResponse.statusText}`);
  }

  const data = await sttResponse.json();
  const transcript = data.results
    ?.map((result: any) => result.alternatives[0].transcript)
    .join(' ')
    .trim();

  return transcript || '';
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
