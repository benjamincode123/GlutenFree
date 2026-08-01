import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

function ocrUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/ocr${path}`;
}

export class OcrRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OcrRequestError';
    this.status = status;
  }
}

export interface OcrParsedLabel {
  produsent: string;
  name: string;
  ingredients: string;
  allergensContains: string[];
  allergensMayContain: string[];
}

export interface OcrReadResult {
  text: string;
  parsed: OcrParsedLabel | null;
  parseWarning: string | null;
}

/**
 * Runs Azure OCR on a compressed product photo (max 1 MB data-URI / base64).
 * When OCR finds text, the API also runs Azure OpenAI field extraction.
 */
export async function readImageText(
  token: string,
  imageBase64: string
): Promise<OcrReadResult> {
  const url = ocrUrl('/read');
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    });
  } catch {
    throw new AppError('network');
  }

  if (!response.ok) {
    const apiError = await readApiErrorMessage(response);
    if (response.status === 404) {
      throw new OcrRequestError(
        `OCR endpoint missing on ${config.apiBaseUrl}. Deploy backend or use local API.`,
        404
      );
    }
    if (apiError) {
      throw new OcrRequestError(apiError, response.status);
    }
    throw appErrorFromHttp(response.status, apiError, 'unauthorized');
  }

  const data = (await response.json()) as {
    text?: string;
    parsed?: Partial<OcrParsedLabel> | null;
    parseWarning?: string | null;
  };

  const parsedRaw = data.parsed;
  const parsed: OcrParsedLabel | null = parsedRaw
    ? {
        produsent:
          typeof parsedRaw.produsent === 'string' ? parsedRaw.produsent.trim() : '',
        name: typeof parsedRaw.name === 'string' ? parsedRaw.name.trim() : '',
        ingredients:
          typeof parsedRaw.ingredients === 'string'
            ? parsedRaw.ingredients.trim()
            : '',
        allergensContains: Array.isArray(parsedRaw.allergensContains)
          ? parsedRaw.allergensContains.filter(
              (a): a is string => typeof a === 'string' && a.trim().length > 0
            )
          : [],
        allergensMayContain: Array.isArray(parsedRaw.allergensMayContain)
          ? parsedRaw.allergensMayContain.filter(
              (a): a is string => typeof a === 'string' && a.trim().length > 0
            )
          : [],
      }
    : null;

  return {
    text: typeof data.text === 'string' ? data.text : '',
    parsed,
    parseWarning:
      typeof data.parseWarning === 'string' && data.parseWarning.trim()
        ? data.parseWarning.trim()
        : null,
  };
}
