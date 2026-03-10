/**
 * DeepL translation utility.
 * Uses the DeepL Free/Pro API v2.
 * Requires DEEPL_API_KEY in environment.
 *
 * Free API endpoint: https://api-free.deepl.com/v2/translate
 * Pro API endpoint:  https://api.deepl.com/v2/translate
 *
 * Locale mapping: DeepL uses uppercase language codes (DE, EN, JA).
 * We store locales in lowercase (de, en, ja), so we uppercase before calling.
 */

const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? ''

// DeepL Free accounts use api-free.deepl.com; Pro use api.deepl.com
// Detect by checking if key ends with ':fx' (Free tier suffix)
function getDeeplEndpoint(): string {
  return DEEPL_API_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
}

/**
 * Translate a single text string via DeepL.
 * @param text        Source text to translate
 * @param targetLang  Target locale code (e.g. 'en', 'ja', 'de')
 * @param sourceLang  Optional source locale code; omit to let DeepL auto-detect
 * @returns Translated text
 * @throws Error if API key is missing or request fails
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<string> {
  if (!DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY is not set')
  }
  if (!text || !text.trim()) return text

  const body: Record<string, unknown> = {
    text: [text],
    target_lang: targetLang.toUpperCase(),
  }
  if (sourceLang) {
    body.source_lang = sourceLang.toUpperCase()
  }

  const res = await fetch(getDeeplEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(`DeepL API error ${res.status}: ${errorText}`)
  }

  const data = await res.json() as { translations: { text: string }[] }
  return data.translations[0]?.text ?? text
}

/**
 * Translate multiple texts in a single DeepL API call (batch).
 * DeepL supports up to 50 texts per request.
 * @param texts       Array of source strings
 * @param targetLang  Target locale code
 * @param sourceLang  Optional source locale code
 * @returns Array of translated strings in the same order
 */
export async function translateTexts(
  texts: string[],
  targetLang: string,
  sourceLang?: string
): Promise<string[]> {
  if (!DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY is not set')
  }
  if (!texts.length) return []

  const body: Record<string, unknown> = {
    text: texts,
    target_lang: targetLang.toUpperCase(),
  }
  if (sourceLang) {
    body.source_lang = sourceLang.toUpperCase()
  }

  const res = await fetch(getDeeplEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(`DeepL API error ${res.status}: ${errorText}`)
  }

  const data = await res.json() as { translations: { text: string }[] }
  return data.translations.map((t) => t.text)
}
