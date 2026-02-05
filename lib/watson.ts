
interface AssessmentData {
  analysis: string;
  probable_causes: string[];
  urgency_level: 'Low' | 'Medium' | 'High' | 'Emergency';
  home_remedies: string[];
  medical_advice: string;
  disclaimer: string;
}

interface ChatResponse {
  type: 'assessment' | 'chat';
  data?: AssessmentData;
  reply?: string;
}

export async function analyzeSymptoms(messages: any[], language: string = 'English'): Promise<ChatResponse> {
    const API_KEY = process.env.IBM_CLOUD_API_KEY;
    const PROJECT_ID = process.env.WATSONX_PROJECT_ID;
    const URL = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';

    if (!API_KEY || !PROJECT_ID) {
      throw new Error('Missing IBM Cloud credentials');
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

    // 2. Call Watsonx.ai
    const modelId = 'ibm/granite-3-8b-instruct'; 

    const systemPrompt = `You are a medical symptom analysis AI assistant. Analyze symptoms accurately and provide helpful health guidance.

CRITICAL RULES:
1. SAFETY FIRST: For emergencies (chest pain, breathing difficulty, stroke symptoms, severe bleeding, loss of consciousness) - set urgency_level to "Emergency" and advise immediate medical care.
2. Be ACCURATE: Base analysis on established medical knowledge. Don't guess - ask for clarification if needed.
3. Be SPECIFIC: Give actionable advice, not vague suggestions.
4. Language: Respond in ${language}.

OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no \`\`\`):

For SYMPTOM DESCRIPTIONS (user tells you what they feel):
{
  "type": "assessment",
  "data": {
    "analysis": "Clear 2-3 sentence summary of symptoms and likely condition",
    "probable_causes": ["Most likely cause", "Second possibility", "Third possibility"],
    "urgency_level": "Low|Medium|High|Emergency",
    "home_remedies": ["Specific remedy 1", "Specific remedy 2", "Specific remedy 3"],
    "medical_advice": "When to see a doctor and what type of doctor",
    "disclaimer": "This is not a diagnosis. Consult a healthcare provider for medical advice."
  }
}

For FOLLOW-UP QUESTIONS or general health queries:
{
  "type": "chat",
  "reply": "Your helpful response"
}

URGENCY LEVELS:
- Low: Common ailments, self-limiting (common cold, minor headache)
- Medium: Needs monitoring, may need doctor in 1-2 days (moderate fever, persistent symptoms)
- High: See doctor today/tomorrow (high fever, worsening symptoms, concerning signs)
- Emergency: Call 911/112 NOW (chest pain, breathing problems, stroke signs, severe bleeding)`;

    // Limit context to last 6 messages
    const recentMessages = messages.slice(-6);
    const conversation = recentMessages.map((m: any) => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${
            typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }`
    ).join('\n\n');

    const inputData = `System: ${systemPrompt}\n\nChat History:\n${conversation}\n\nAssistant:`;

    const payload = {
      model_id: modelId,
      project_id: PROJECT_ID,
      input: inputData,
      parameters: {
        decoding_method: 'greedy',
        max_new_tokens: 900,
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
    let parsedData: ChatResponse;
    try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
        parsedData = JSON.parse(jsonString);
    } catch (e) {
        console.error("JSON Parse Error", e);
        // Fallback
        parsedData = {
            type: 'chat',
            reply: generatedText || "I'm having trouble processing that request. Please try again."
        };
    }

    return parsedData;
}
