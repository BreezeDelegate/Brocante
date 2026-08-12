import { config } from '../config.js';

interface OllamaResponse {
  message?: {
    content?: string;
  };
}

const imagePattern = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

export async function identify(image: string): Promise<string> {
  const match = image.match(imagePattern);
  if (!match?.[1]) return '';

  try {
    const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(config.IDENTIFY_TIMEOUT_MS),
      body: JSON.stringify({
        model: config.OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: 'user',
            content:
              'Identifie précisément cet objet pour une recherche de seconde main en France. Réponds uniquement avec 3 à 8 mots clés utiles : type, marque, modèle ou référence si visibles. Pas de phrase.',
            images: [match[1]],
          },
        ],
      }),
    });

    if (!response.ok) return '';

    const data = (await response.json()) as OllamaResponse;
    return (data.message?.content ?? '')
      .replace(/[\n"'<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  } catch {
    return '';
  }
}
