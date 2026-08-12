import { NextResponse } from 'next/server';

// llama3.2:1b is ~1.3GB — extremely fast (2-4s) and smart enough to guarantee valid JSON
const DEFAULT_MODEL = 'llama3.2:1b';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, model = DEFAULT_MODEL, format } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const payload: any = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.9,    // High enough for unique questions
        top_p: 0.9,
        num_predict: 300,    // Cap tokens — shorter = much faster
        num_ctx: 512,        // Small context window for speed
        repeat_penalty: 1.1,
      },
    };

    if (format === 'json') {
      payload.format = 'json';
    }

    // 60-second timeout (qwen2:0.5b is fast but give buffer for cold start)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ollama error (${response.status}):`, errorText);
      if (response.status === 404) {
        throw new Error(`Model '${model}' not found. Run: ollama pull ${model}`);
      }
      throw new Error(`Ollama responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ response: data.response });

  } catch (error: any) {
    console.error('Ollama API Error:', error);

    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout
      ? `Ollama timed out. Run: ollama pull qwen2:0.5b`
      : error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED'
        ? 'Ollama not running. Start it with: ollama serve'
        : error.message || 'Unknown Ollama error.';

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
