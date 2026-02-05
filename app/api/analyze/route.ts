import { NextResponse } from 'next/server';
import { analyzeSymptoms } from '@/lib/watson';

export async function POST(req: Request) {
  try {
    const { messages, language = 'English', symptoms } = await req.json();

    // Support legacy "symptoms" field for initial call, which we convert to a message
    let conversation = messages || [];
    if (!messages && symptoms) {
        conversation = [{ role: 'user', content: symptoms }];
    }

    if (!conversation || conversation.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const result = await analyzeSymptoms(conversation, language);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in health agent:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
