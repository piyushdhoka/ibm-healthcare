
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

    // Count user messages to determine if we should give assessment
    const userMessageCount = messages.filter((m: any) => m.role === 'user').length;
    const shouldAssess = userMessageCount >= 2;

    const systemPrompt = `You are Dr. Health, a compassionate and knowledgeable AI medical assistant. You provide thorough, detailed health guidance.

🚨 EMERGENCY KEYWORDS - Detect and respond immediately with Emergency assessment:
heart attack, chest pain, mini heart attack, cardiac, can't breathe, difficulty breathing, choking, stroke, face drooping, arm weakness, slurred speech, severe bleeding, unconscious, seizure, suicidal, overdose, anaphylaxis, severe allergic

For ANY emergency, skip ALL questions and provide immediate Emergency assessment.

📋 CONVERSATION FLOW:
${shouldAssess ? '- User has provided enough information. Provide detailed assessment now.' : '- This is early in conversation. Ask 1-2 caring follow-up questions about duration, severity (1-10), other symptoms, or triggers.'}

🌍 Language: Respond entirely in ${language}.

📤 OUTPUT - Return ONLY valid JSON (no markdown, no backticks, no extra text):

FOR FOLLOW-UP (gathering info):
{"type":"chat","reply":"I understand you're experiencing [symptom]. That sounds uncomfortable. To help you better, could you tell me: 1) How long have you had this? 2) On a scale of 1-10, how severe is it?"}

FOR DETAILED ASSESSMENT (enough info gathered OR emergency):
{
  "type":"assessment",
  "data":{
    "analysis":"[3-4 detailed sentences explaining the condition, what might be happening in the body, and why the symptoms occur. Be specific and educational.]",
    "probable_causes":[
      "[Most likely cause with brief explanation]",
      "[Second possibility with brief explanation]", 
      "[Third possibility with brief explanation]"
    ],
    "urgency_level":"[Low/Medium/High/Emergency]",
    "home_remedies":[
      "[Specific actionable remedy with dosage/timing if applicable]",
      "[Second remedy with clear instructions]",
      "[Third remedy - what to avoid]",
      "[Fourth remedy - lifestyle adjustment]"
    ],
    "medical_advice":"[When to see doctor, what type of specialist, what tests might be needed, warning signs to watch for]",
    "disclaimer":"This is AI-generated health information, not a medical diagnosis. Always consult a healthcare professional for proper medical advice."
  }
}

URGENCY LEVELS:
- Low: Self-care at home (cold, minor headache, small cuts)
- Medium: See doctor within 2-3 days (persistent fever, infections)
- High: See doctor within 24 hours (high fever >103°F, severe pain, concerning symptoms)
- Emergency: Call 911/emergency services NOW (heart attack, stroke, severe bleeding, can't breathe)

QUALITY GUIDELINES:
✓ Be detailed and specific, not generic
✓ Explain WHY remedies help
✓ Include specific dosages when safe (e.g., "Take 400mg ibuprofen every 6 hours")
✓ Mention what to AVOID
✓ Be empathetic and reassuring
✓ For emergencies: Include immediate actions while waiting for help`;

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
        max_new_tokens: 1500,
        min_new_tokens: 50,
        stop_sequences: [],
        repetition_penalty: 1.05,
        temperature: 0.7
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
    
    console.log("Raw AI response:", generatedText);

    // Robust JSON extraction
    let parsedData: ChatResponse;
    try {
        // Try to find the FIRST complete JSON object
        let depth = 0;
        let startIdx = -1;
        let endIdx = -1;
        
        for (let i = 0; i < generatedText.length; i++) {
            if (generatedText[i] === '{') {
                if (depth === 0) startIdx = i;
                depth++;
            } else if (generatedText[i] === '}') {
                depth--;
                if (depth === 0 && startIdx !== -1) {
                    endIdx = i;
                    break;
                }
            }
        }
        
        if (startIdx !== -1 && endIdx !== -1) {
            const jsonString = generatedText.substring(startIdx, endIdx + 1);
            parsedData = JSON.parse(jsonString);
        } else {
            throw new Error("No valid JSON found");
        }
        
        // Validate the response structure
        if (!parsedData.type) {
            parsedData.type = 'chat';
        }
        if (parsedData.type === 'chat' && !parsedData.reply) {
            parsedData.reply = generatedText.replace(/[{}"]/g, '').trim() || "Could you tell me more about your symptoms?";
        }
        
    } catch (e) {
        console.error("JSON Parse Error:", e);
        // Extract any readable text as fallback
        const cleanText = generatedText
            .replace(/```json|```/g, '')
            .replace(/\{[\s\S]*?\}/g, '')
            .trim();
        
        parsedData = {
            type: 'chat',
            reply: cleanText || "I understand. Could you provide more details about your symptoms?"
        };
    }

    return parsedData;
}
