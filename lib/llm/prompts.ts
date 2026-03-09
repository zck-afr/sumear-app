// ============================================================================
// BriefAI — Comparison Prompts
// ============================================================================
// System prompt and user prompt builders for product comparison.
// Based on prompts/briefai_prompts.py (source of truth).
// ============================================================================

interface ClipForPrompt {
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  rating: number | null
  review_count: number | null
  description: string | null
  source_domain: string
  extracted_specs: Record<string, string>
}

/**
 * System prompt for product comparison.
 * Instructs the LLM to act as an impartial shopping advisor.
 */
export const COMPARISON_SYSTEM_PROMPT = `You are BriefAI, an impartial e-commerce shopping advisor. You work exclusively for the buyer — you have zero commercial relationship with any seller or brand.

Your job: analyze product data and deliver a clear, actionable comparison verdict.

RULES:
- Be brutally honest. If a product has red flags, say it.
- Base your analysis ONLY on the data provided. Don't invent specs or reviews.
- If data is missing or insufficient, say so explicitly.
- Respond in the same language as the product data (if products are in French, respond in French).
- Output ONLY valid JSON matching the exact schema below. No markdown, no preamble.

OUTPUT JSON SCHEMA:
{
  "verdict": {
    "winner_index": <number, 0-based index of the best product, or null if too close to call>,
    "summary": "<string, 2-3 sentences explaining the verdict>",
    "confidence": <number, 0.0-1.0, how confident you are>,
    "is_clear_winner": <boolean, true if one product is clearly superior>
  },
  "products": [
    {
      "name": "<string, product name>",
      "strengths": ["<string>", ...],
      "weaknesses": ["<string>", ...],
      "red_flags": [
        {
          "issue": "<string, what the problem is>",
          "severity": "<'low' | 'medium' | 'high'>",
          "evidence": "<string, what data supports this>"
        }
      ],
      "value_for_money": "<'excellent' | 'good' | 'average' | 'poor'>",
      "best_for": "<string, what type of buyer this product suits>"
    }
  ],
  "key_differences": [
    {
      "spec": "<string, spec name>",
      "values": ["<string, value for product 1>", "<string, value for product 2>", ...],
      "insight": "<string, why this difference matters>"
    }
  ]
}`

/**
 * Build the user message with product data for comparison.
 */
export function buildComparisonPrompt(clips: ClipForPrompt[]): string {
  const productsText = clips.map((clip, i) => {
    const lines: string[] = []
    lines.push(`--- PRODUCT ${i + 1} ---`)
    lines.push(`Name: ${clip.product_name}`)
    if (clip.brand) lines.push(`Brand: ${clip.brand}`)
    if (clip.price != null) lines.push(`Price: ${clip.price} ${clip.currency}`)
    if (clip.rating != null) lines.push(`Rating: ${clip.rating}/5 (${clip.review_count ?? 0} reviews)`)
    lines.push(`Source: ${clip.source_domain}`)
    if (clip.description) lines.push(`Description: ${clip.description}`)

    const specs = Object.entries(clip.extracted_specs || {})
    if (specs.length > 0) {
      lines.push('Specs:')
      for (const [key, value] of specs) {
        lines.push(`  - ${key}: ${value}`)
      }
    }

    return lines.join('\n')
  }).join('\n\n')

  return `Compare these ${clips.length} products and give me your verdict:\n\n${productsText}`
}

/**
 * Parse the LLM response into a structured comparison result.
 * Handles cases where the LLM wraps JSON in markdown code blocks.
 */
export function parseComparisonResponse(raw: string): any {
  // Strip markdown code blocks if present
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  const parsed = JSON.parse(cleaned)

  // Validate minimum structure
  if (!parsed.verdict || !parsed.products || !Array.isArray(parsed.products)) {
    throw new Error('Invalid comparison response: missing verdict or products')
  }

  return parsed
}
