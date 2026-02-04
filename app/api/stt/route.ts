import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;

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

    const response = await fetch(`${SERVICE_URL}/v1/recognize?model=en-US_BroadbandModel`, {
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
      throw new Error(`STT API Error: ${response.statusText}`);
    }

    const data = await response.json();
    // Extract transcript
    const transcript = data.results
      ?.map((result: any) => result.alternatives[0].transcript)
      .join(' ')
      .trim();

    return NextResponse.json({ transcript });

  } catch (error: any) {
    console.error('Error in STT route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
