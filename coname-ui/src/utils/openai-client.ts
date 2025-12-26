/**
 * OpenAI API Client
 * Handles all communication with the OpenAI API
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export async function callAgent(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  } = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 4096, jsonMode = true } = options;

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env');
  }

  console.log('🤖 [AGENT] Making API call to GPT-4o-mini...');
  console.log('🤖 [AGENT] System prompt length:', systemPrompt.length);
  console.log('🤖 [AGENT] User message length:', userMessage.length);
  console.log('🤖 [AGENT] Options:', { temperature, maxTokens, jsonMode });

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // OpenAI requires 'json' in messages to use json_object response_format
  if (jsonMode) {
    const hasJson = systemPrompt.toLowerCase().includes('json') || 
                    userMessage.toLowerCase().includes('json');
    if (!hasJson) {
      messages[messages.length - 1].content += '\n\nRespond with JSON.';
    }
  }

  const request: OpenAIRequest = {
    model: MODEL,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    request.response_format = { type: 'json_object' };
  }

  try {
    console.log('🤖 [AGENT] Sending request to:', OPENAI_API_URL);
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(request),
    });

    console.log('🤖 [AGENT] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AGENT] API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();
    console.log('🤖 [AGENT] Response received:', JSON.stringify(data, null, 2).substring(0, 500));

    const text = data.choices[0]?.message?.content || '';
    console.log('✅ [AGENT] Extracted text:', text.substring(0, 200));

    return text;
  } catch (error) {
    console.error('❌ [AGENT] Error calling API:', error);
    throw error;
  }
}

export function parseAgentJson<T>(response: string): T {
  try {
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try to find JSON object in response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error(`Failed to parse response as JSON: ${response}`);
  }
}

