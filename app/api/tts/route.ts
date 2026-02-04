import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const API_KEY = process.env.IBM_TTS_API_KEY;
    const SERVICE_URL = process.env.IBM_TTS_URL;

    if (!API_KEY || !SERVICE_URL) {
      return NextResponse.json({ error: 'Missing IBM TTS credentials' }, { status: 500 });
    }

    const response = await fetch(`${SERVICE_URL}/v1/synthesize?voice=en-US_AllisonV3Voice&accept=audio/mp3`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error:', errorText);
      throw new Error(`TTS API Error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mp3',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    console.error('Error in TTS route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
