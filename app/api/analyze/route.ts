import { NextResponse } from 'next/server';

// Interface for the expected response structure
interface HealthResponse {
  analysis: string;
  probable_causes: string[];
  urgency_level: 'Low' | 'Medium' | 'High' | 'Emergency';
  home_remedies: string[];
  medical_advice: string;
  disclaimer: string;
}

export async function POST(req: Request) {
  try {
    const { symptoms, language = 'English' } = await req.json();

    if (!symptoms) {
      return NextResponse.json({ error: 'Symptoms are required' }, { status: 400 });
    }

    const API_KEY = process.env.IBM_CLOUD_API_KEY;
    const PROJECT_ID = process.env.WATSONX_PROJECT_ID;
    const URL = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com'; // Default to US South if not provided

    if (!API_KEY || !PROJECT_ID) {
      return NextResponse.json({ error: 'Missing IBM Cloud credentials' }, { status: 500 });
    }

    // 1. Get IAM Token
    const tokenResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: API_KEY,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to obtain IAM token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Call Watsonx.ai (using IBM Granite)
    // We use granite-3-8b-instruct or similar available model
    const modelId = 'ibm/granite-3-8b-instruct'; 

    const systemPrompt = `You are an AI Health Symptom Checker agent supported by IBM Granite. 
    Your goal is to analyze symptoms provided by the user and offer health insights.
    
    IMPORTANT GUIDELINES:
    1. PRIORITIZE SAFETY. If symptoms suggest a life-threatening emergency (chest pain, difficulty breathing, stroke signs), advise immediate emergency care.
    2. Provide PROBABLE causes, not definitive diagnoses.
    3. Suggest clear, actionable home remedies if applicable.
    4. Always include a disclaimer that you are an AI and not a doctor.
    5. Output the response in valid JSON format ONLY.
    6. Respond in the language: ${language}.
    
    JSON Schema:
    {
      "analysis": "Brief summary of the symptoms.",
      "probable_causes": ["Cause 1", "Cause 2", "Cause 3"],
      "urgency_level": "Low" | "Medium" | "High" | "Emergency",
      "home_remedies": ["Remedy 1", "Remedy 2"],
      "medical_advice": "When to see a doctor...",
      "disclaimer": "Standard medical disclaimer..."
    }
    `;

    const userPrompt = `User Symptoms: ${symptoms}`;

    const payload = {
      model_id: modelId,
      project_id: PROJECT_ID,
      input: `System: ${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
      parameters: {
        decoding_method: 'greedy',
        max_new_tokens: 500,
        min_new_tokens: 1,
        stop_sequences: [],
        repetition_penalty: 1.05
      }
    };

    const scoringResponse = await fetch(`${URL}/ml/v1/text/generation?version=2023-05-29`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!scoringResponse.ok) {
        const errorText = await scoringResponse.text();
        console.error("Watsonx API Error:", errorText);
        throw new Error(`Watsonx API Error: ${scoringResponse.statusText}`);
    }

    const data = await scoringResponse.json();
    const generatedText = data.results[0].generated_text;

    // Attempt to parse JSON from the model response
    // Sometimes models add extra text, so we try to find the JSON block
    let parsedData: HealthResponse;
    try {
        // specific cleanup if model returns markdown code blocks
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
        parsedData = JSON.parse(jsonString);
    } catch (e) {
        // Fallback if JSON parsing fails
        parsedData = {
            analysis: generatedText,
            probable_causes: [],
            urgency_level: 'Medium',
            home_remedies: [],
            medical_advice: "Please consult a healthcare professional for accurate diagnosis.",
            disclaimer: "Could not parse structured data. Please consult a doctor."
        };
    }

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Error in health agent:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
