// IBM Watson NLU Integration

export interface NLUResult {
  intent: string;
  sentiment: string;
  keywords: string[];
  entities: { type: string; text: string }[];
}

// Analyze text for intent, sentiment, keywords using IBM Watson NLU
export async function analyzeWithNLU(text: string): Promise<NLUResult> {
  const NLU_API_KEY = process.env.IBM_NLU_API_KEY;
  const NLU_URL = process.env.IBM_NLU_URL;

  if (!NLU_API_KEY || !NLU_URL) {
    console.log('NLU credentials not configured, using fallback');
    return { intent: 'symptom_description', sentiment: 'neutral', keywords: [], entities: [] };
  }

  try {
    const response = await fetch(`${NLU_URL}/v1/analyze?version=2022-04-07`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`apikey:${NLU_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        features: {
          keywords: { limit: 10 },
          entities: { limit: 10 },
          sentiment: {},
          categories: { limit: 3 },
        },
        language: 'en'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NLU API Error:', errorText);
      return { intent: 'symptom_description', sentiment: 'neutral', keywords: [], entities: [] };
    }

    const data = await response.json();
    
    // Extract data
    const categories = data.categories || [];
    const keywords = (data.keywords || []).map((k: any) => k.text);
    const entities = (data.entities || []).map((e: any) => ({ type: e.type, text: e.text }));
    const sentiment = data.sentiment?.document?.label || 'neutral';
    
    // Infer intent
    const intent = inferIntent(keywords, categories);
    
    return { intent, sentiment, keywords, entities };
  } catch (error) {
    console.error('NLU Error:', error);
    return { intent: 'symptom_description', sentiment: 'neutral', keywords: [], entities: [] };
  }
}

function inferIntent(keywords: string[], categories: any[]): string {
  const keywordText = keywords.join(' ').toLowerCase();
  
  if (keywordText.includes('help') || keywordText.includes('assist')) {
    return 'help_request';
  }
  
  if (categories.some((c: any) => 
    c.label.toLowerCase().includes('health') || 
    c.label.toLowerCase().includes('medicine')
  )) {
    return 'symptom_description';
  }
  
  if (keywordText.includes('thank') || keywordText.includes('bye')) {
    return 'conversation_end';
  }
  
  if (keywordText.includes('?') || keywordText.includes('what') || keywordText.includes('how')) {
    return 'question';
  }
  
  return 'symptom_description';
}
