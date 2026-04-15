/**
 * Sanitize product data extracted from third-party e-commerce sites
 * before injecting it into LLM system prompts.
 *
 * Goal: neutralize prompt injection attempts hidden in product listings
 * while preserving legitimate product information (prices, specs, reviews).
 */

const REPLACEMENT = '[contenu filtré]'

// Flexible determiner group for French: tes, vos, les, toutes les, toutes, mes, ces, etc.
const FR_DET = '(?:tes?|vos?|les?|toutes?(?:\\s+les)?|mes|ces|ses|leurs?)'
// French nouns for "instructions/rules"
const FR_NOUNS = '(?:r[eè]gles?|instructions?|consignes?|directives?)'
// French adjectives for "previous"
const FR_PREV = '(?:pr[eé]c[eé]dentes?|ant[eé]rieures?|pass[eé]es?|d\\s*avant)'

// English filler words that can appear between the verb and the target noun
// e.g. "forget about all the previous" → about, all, the, previous are fillers
const EN_FILLER = '(?:\\s+(?:about|all|of|the|your|my|any|every|those|these|previous|prior|above|earlier|preceding|old|original|initial|first|given|existing|current)){1,5}'
// English target nouns
const EN_NOUNS = '(?:instructions?|rules?|prompts?|directives?|guidelines?|constraints?)'

// Phrases that attempt to override system instructions (case-insensitive)
const INJECTION_PHRASES: RegExp[] = [
  // EN: ignore/forget/disregard/override + filler words + target noun
  new RegExp(`(?:ignore|forget|disregard|override|skip|drop|erase|delete|remove|clear)${EN_FILLER}\\s+${EN_NOUNS}`, 'gi'),
  // FR: ignore/oublie [det] instructions [précédentes]
  new RegExp(`ignore\\s+${FR_DET}\\s+${FR_NOUNS}(\\s+${FR_PREV})?`, 'gi'),
  new RegExp(`oublie\\s+${FR_DET}\\s+${FR_NOUNS}(\\s+${FR_PREV})?`, 'gi'),
  // FR: oublie/ignore toutes instructions (without "les")
  new RegExp(`(?:oublie|ignore)\\s+toutes?\\s+${FR_NOUNS}(\\s+${FR_PREV})?`, 'gi'),
  // FR: oublie/ignore les instructions précédentes (adj at end)
  new RegExp(`(?:oublie|ignore)\\s+${FR_DET}\\s+${FR_NOUNS}\\s+${FR_PREV}`, 'gi'),
  // Role change
  /you\s+are\s+now\s+(?:a\s+)?/gi,
  /tu\s+es\s+maintenant\s+/gi,
  /tu\s+es\s+d[ée]sormais\s+/gi,
  /act\s+as\s+(?:a\s+|an\s+)?(?!a\s+shopping)/gi,
  /agis\s+comme\s+/gi,
  /behave\s+as\s+/gi,
  // New instructions
  /new\s+instructions?\s*:/gi,
  /nouvelles?\s+instructions?\s*:/gi,
  // System prompt reveal
  /system\s*prompt\s*:/gi,
  /r[eé]v[eè]le\s+(ton|le)\s+(system\s*)?prompt/gi,
  /reveal\s+(your|the)\s+(system\s*)?prompt/gi,
  /show\s+(me\s+)?(your|the)\s+(system\s*)?prompt/gi,
  /print\s+(your|the)\s+(system\s*)?prompt/gi,
  /repeat\s+(your|the)\s+(system\s*)?prompt/gi,
  /r[eé]p[eè]te\s+(ton|le)\s+(system\s*)?prompt/gi,
  /output\s+(your|the)\s+instructions?/gi,
  // Do not follow
  /do\s+not\s+follow\s+(your|the|any)\s+/gi,
  new RegExp(`ne\\s+suis\\s+pas\\s+${FR_DET}\\s+`, 'gi'),
  // Stop being
  /stop\s+being\s+(?:a\s+)?/gi,
  /arr[eê]te\s+d['']\s*[eê]tre\s+/gi,
  // Jailbreak / bypass
  /jailbreak/gi,
  /bypass\s+(the\s+)?(filter|safety|restriction|guardrail|rule)/gi,
  /contourne[rz]?\s+(le|la|les)\s+(filtre|s[eé]curit[eé]|restriction|r[eè]gle)/gi,
  /DAN\s*mode/gi,
  /developer\s*mode\s*(enabled|activ)/gi,
  /mode\s+d[eé]veloppeur/gi,
  /\bdo\s+anything\s+now\b/gi,
]

// Control tokens / structured markers used by various LLM systems
const CONTROL_TOKEN_PATTERNS: RegExp[] = [
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|endoftext\|>/gi,
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\|assistant\|>/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /<system>/gi,
  /<\/system>/gi,
  /\[system\]/gi,
  /\[\/system\]/gi,
  /```system/gi,
  /###\s*(system|instruction|directive)\s*:?/gi,
  /Human:\s*$/gim,
  /Assistant:\s*$/gim,
]

/**
 * Remove prompt injection patterns from a string of product data.
 * Legitimate product content (prices, dimensions, materials, reviews) is preserved.
 */
export function sanitizeProductData(text: string): string {
  if (!text) return text

  let result = text

  for (const pattern of CONTROL_TOKEN_PATTERNS) {
    pattern.lastIndex = 0
    result = result.replace(pattern, REPLACEMENT)
  }

  for (const pattern of INJECTION_PHRASES) {
    pattern.lastIndex = 0
    result = result.replace(pattern, REPLACEMENT)
  }

  return result
}

/**
 * Sanitize all string values in a key-value specs object.
 */
export function sanitizeSpecs(specs: Record<string, unknown> | null | undefined): Record<string, string> | null {
  if (!specs || typeof specs !== 'object') return null
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(specs)) {
    const k = sanitizeProductData(String(key))
    const v = sanitizeProductData(String(value ?? ''))
    clean[k] = v
  }
  return clean
}

// ── User message injection detection ─────────────────────────────────────────
// These patterns target what a USER would type (not product data).
// Kept separate from INJECTION_PHRASES to allow different sensitivity.

// Reuse the same flexible French groups for user-message detection
const U_FR_DET = FR_DET
const U_FR_NOUNS = FR_NOUNS
const U_FR_PREV = FR_PREV

const USER_INJECTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Instruction override (EN) — single flexible pattern with filler words
  { label: 'override instructions (en)', pattern: new RegExp(`(?:ignore|forget|disregard|override|skip|drop|erase|delete|remove|clear)${EN_FILLER}\\s+${EN_NOUNS}`, 'i') },
  { label: 'do not follow rules', pattern: new RegExp(`do\\s+not\\s+follow${EN_FILLER}\\s+${EN_NOUNS}`, 'i') },
  // Instruction override (FR) — flexible determiners + optional "précédentes"
  { label: 'ignore instructions (fr)', pattern: new RegExp(`ignore\\s+${U_FR_DET}\\s+${U_FR_NOUNS}(\\s+${U_FR_PREV})?`, 'i') },
  { label: 'oublie instructions (fr)', pattern: new RegExp(`oublie\\s+${U_FR_DET}\\s+${U_FR_NOUNS}(\\s+${U_FR_PREV})?`, 'i') },
  { label: 'oublie toutes instructions', pattern: new RegExp(`(?:oublie|ignore)\\s+toutes?\\s+${U_FR_NOUNS}(\\s+${U_FR_PREV})?`, 'i') },
  { label: 'ne suis pas tes règles', pattern: new RegExp(`ne\\s+suis\\s+pas\\s+${U_FR_DET}\\s+${U_FR_NOUNS}`, 'i') },
  // Role change
  { label: 'you are now', pattern: /you\s+are\s+now\s+/i },
  { label: 'tu es maintenant', pattern: /tu\s+es\s+(maintenant|d[ée]sormais)\s+/i },
  { label: 'act as / behave as', pattern: /(act|behave)\s+as\s+(a\s+|an\s+)?/i },
  { label: 'agis comme', pattern: /agis\s+comme\s+/i },
  { label: 'stop being', pattern: /stop\s+being\s+/i },
  { label: 'arrête d\'être', pattern: /arr[eê]te\s+d['']\s*[eê]tre\s+/i },
  // Unlimited / no limits roleplay
  { label: 'assistant sans limites', pattern: /assistant\s+(sans\s+limites?|illimit[eé]|libre)/i },
  { label: 'no restrictions', pattern: /(?:without|no|remove|disable)\s+(any\s+)?(restrictions?|limits?|constraints?|guardrails?|filters?|safety)/i },
  { label: 'sans restrictions', pattern: /sans\s+(aucune?\s+)?(restrictions?|limites?|contraintes?|filtres?|s[eé]curit[eé])/i },
  // System prompt reveal
  { label: 'reveal system prompt (en)', pattern: /(reveal|show|print|repeat|output|display|give\s+me)\s+(me\s+)?(your|the)\s+(system\s*)?(prompt|instructions?)/i },
  { label: 'reveal system prompt (fr)', pattern: /r[eé](v[eè]le|p[eè]te)\s+(ton|le|moi\s+ton|moi\s+le)\s+(system\s*)?(prompt|instructions?)/i },
  { label: 'system prompt:', pattern: /system\s*prompt\s*:/i },
  { label: 'what is your prompt', pattern: /(what|quel)\s+(is|are|est|sont)\s+(your|tes?|vos?)\s+(system\s*)?(prompt|instructions?)/i },
  // New instructions
  { label: 'new instructions:', pattern: /(new|nouvelles?)\s+instructions?\s*:/i },
  // Jailbreak keywords
  { label: 'jailbreak', pattern: /\bjailbreak\b/i },
  { label: 'DAN mode', pattern: /\bDAN\s*mode\b/i },
  { label: 'do anything now', pattern: /\bdo\s+anything\s+now\b/i },
  { label: 'developer mode', pattern: /(developer|d[eé]veloppeur)\s*mode/i },
  // Bypass
  { label: 'bypass filter (en)', pattern: /bypass\s+(the\s+)?(filter|safety|restriction|guardrail|rule)/i },
  { label: 'contourner filtre (fr)', pattern: /contourne[rz]?\s+(le|la|les)\s+(filtre|s[eé]curit[eé]|restriction|r[eè]gle)/i },
  // Control tokens in user message (highly suspicious)
  { label: 'control token [INST]', pattern: /\[INST\]/i },
  { label: 'control token <|im_start|>', pattern: /<\|im_start\|>/i },
  { label: 'control token <system>', pattern: /<system>/i },
  { label: 'control token <<SYS>>', pattern: /<<SYS>>/i },
]

export interface SuspiciousResult {
  isSuspicious: boolean
  triggers: string[]
}

/**
 * Detect prompt injection patterns in a user-typed chat message.
 * Returns which patterns matched — does NOT block the message.
 */
export function detectSuspiciousMessage(userMessage: string): SuspiciousResult {
  if (!userMessage) return { isSuspicious: false, triggers: [] }

  const triggers: string[] = []
  for (const { label, pattern } of USER_INJECTION_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(userMessage)) {
      triggers.push(label)
    }
  }

  return { isSuspicious: triggers.length > 0, triggers }
}
