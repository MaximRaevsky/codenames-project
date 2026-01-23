/**
 * OpenAI API Client
 * Handles all communication with the OpenAI API
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // Upgraded from gpt-4o-mini for better performance

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
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();
    const text = data.choices[0]?.message?.content || '';

    return text;
  } catch (error) {
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

