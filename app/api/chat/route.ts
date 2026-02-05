import { NextResponse } from 'next/server';
// import NaturalLanguageUnderstandingV1 from 'ibm-watson/natural-language-understanding/v1';
// import { IamAuthenticator } from 'ibm-watson/auth';

// We'll use direct fetch for NLU to avoid heavy SDK dependency issues if not pre-installed,
// but for robustness we can assume standard fetch requests.

export async function POST(req: Request) {
    try {
        const { message, history, context, language } = await req.json();

        const NLU_API_KEY = process.env.IBM_NLU_API_KEY;
        const NLU_URL = process.env.IBM_NLU_URL;
        const WATSONX_API_KEY = process.env.IBM_CLOUD_API_KEY;
        const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;
        const WATSONX_URL = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';

        if (!NLU_API_KEY || !NLU_URL || !WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
            return NextResponse.json({ error: 'Missing IBM Cloud credentials' }, { status: 500 });
        }

        // 1. Analyze with IBM NLU
        // We want to extract keywords and entities to understand the context
        let nluContext = "";

        try {
            const nluResponse = await fetch(`${NLU_URL}/v1/analyze?version=2022-04-07`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`apikey:${NLU_API_KEY}`)}`
                },
                body: JSON.stringify({
                    text: message,
                    features: {
                        entities: { limit: 3 },
                        keywords: { limit: 3, sentiment: true },
                        emotion: {}
                    }
                })
            });

            if (nluResponse.ok) {
                const nluData = await nluResponse.json();
                const keywords = nluData.keywords?.map((k: any) => k.text).join(', ');
                const entities = nluData.entities?.map((e: any) => e.text).join(', ');
                const emotions = nluData.emotion?.document?.emotion;

                // Find dominant emotion
                let dominantEmotion = 'neutral';
                let maxScore = 0;
                if (emotions) {
                    Object.entries(emotions).forEach(([emo, score]: [string, any]) => {
                        if (score > maxScore) {
                            maxScore = score;
                            dominantEmotion = emo;
                        }
                    });
                }

                nluContext = `Analysis: User is discussing keywords: [${keywords}]. Entities: [${entities}]. Detected Emotion: ${dominantEmotion}.`;
            } else {
                console.log("NLU Error", await nluResponse.text());
            }
        } catch (e) {
            console.error("NLU Fetch Error", e);
            // Continue without NLU context if it fails
        }

        // 2. Generate Follow-up with IBM Granite
        // Get IAM Token for Watsonx
        const tokenResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
                apikey: WATSONX_API_KEY,
            }),
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Construct prompt
        const systemPrompt = `You are a helpful medical assistant chatbot.
    Your goal is to ask relevant follow-up questions to clarify the user's symptoms and answers queries about their diagnosis.
    Use the provided NLU analysis to tailor your response.
    
    CRITICAL INSTRUCTION: The user has selected the language: "${language}". 
    You MUST reply in "${language}" ONLY. Do NOT use English if the selected language is not English.
    If the language is "Hindi", use Devanagari script.
    
    ${language === 'Hindi' ? `
    Example Conversation in Hindi:
    User: मुझे सिरदर्द है।
    Assistant: मुझे यह सुनकर खेद है। यह दर्द कब से हो रहा है? क्या यह तेज है या हल्का?
    ` : ''}
    
    ${context ? `CURRENT DIAGNOSIS CONTEXT: ${context}` : ''}
    
    If the user's emotion is "sadness" or "fear", be extra empathetic.
    Keep your questions short, clear, and one at a time.
    Do NOT diagnose. Just gather information and explain the current diagnosis properties if asked.
    
    ${nluContext}
    `;

        // Format history for context
        const conversation = history.slice(-4).map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const payload = {
            model_id: 'ibm/granite-3-8b-instruct',
            project_id: WATSONX_PROJECT_ID,
            input: `System: ${systemPrompt}\n\n${conversation}\nUser: ${message} (Reply in ${language})\nAssistant:`,
            parameters: {
                decoding_method: 'greedy',
                max_new_tokens: 150,
                min_new_tokens: 1,
                stop_sequences: ['User:', 'System:'],
                repetition_penalty: 1.05
            }
        };

        const scoringResponse = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        const graniteData = await scoringResponse.json();
        const reply = graniteData.results[0].generated_text.trim();

        return NextResponse.json({ reply });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
    }
}
