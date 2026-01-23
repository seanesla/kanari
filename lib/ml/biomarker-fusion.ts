import type { FatigueLevel, StressLevel } from "@/lib/types"
import { SCORE_LEVELS } from "./thresholds"

export type SemanticSource = "keywords" | "gemini"

export interface SemanticBiomarkers {
  stressScore: number
  fatigueScore: number
  stressConfidence: number
  fatigueConfidence: number
  source: SemanticSource
}

export interface BlendedBiomarkers {
  stressScore: number
  fatigueScore: number
  stressLevel: StressLevel
  fatigueLevel: FatigueLevel
  confidence: number
  debug: {
    stress: { acousticWeight: number; semanticWeight: number; acousticConfidence: number; semanticConfidence: number }
    fatigue: { acousticWeight: number; semanticWeight: number; acousticConfidence: number; semanticConfidence: number }
  }
}

const BASELINE_SCORE = 50
const BASELINE_CONFIDENCE = 0

const NEGATION_TOKENS = [
  "not",
  "no",
  "never",
  "dont",
  "don't",
  "do not",
  "isnt",
  "isn't",
  "arent",
  "aren't",
  "cant",
  "can't",
]

type TermRule = { term: string; score: number; confidence: number }

const STRESS_HIGH: TermRule[] = [
  { term: "overwhelmed", score: 95, confidence: 0.95 },
  { term: "panicking", score: 98, confidence: 0.95 },
  { term: "panic", score: 96, confidence: 0.9 },
  { term: "burned out", score: 95, confidence: 0.9 },
  { term: "burnt out", score: 95, confidence: 0.9 },
  { term: "too much", score: 92, confidence: 0.85 },
  { term: "can't cope", score: 96, confidence: 0.9 },
  { term: "cant cope", score: 96, confidence: 0.9 },
]

const STRESS_MODERATE: TermRule[] = [
  { term: "stressed", score: 90, confidence: 0.9 },
  { term: "stress", score: 85, confidence: 0.8 },
  { term: "anxious", score: 88, confidence: 0.9 },
  { term: "anxiety", score: 88, confidence: 0.85 },
  { term: "worried", score: 78, confidence: 0.75 },
  { term: "nervous", score: 72, confidence: 0.7 },
  { term: "tense", score: 78, confidence: 0.75 },
  { term: "on edge", score: 82, confidence: 0.8 },
  { term: "pressure", score: 78, confidence: 0.7 },
]

const STRESS_LOW: TermRule[] = [
  { term: "not stressed", score: 20, confidence: 0.75 },
  { term: "relaxed", score: 25, confidence: 0.6 },
  { term: "calm", score: 30, confidence: 0.55 },
  { term: "at ease", score: 30, confidence: 0.55 },
]

const FATIGUE_HIGH: TermRule[] = [
  { term: "exhausted", score: 95, confidence: 0.95 },
  { term: "sleep deprived", score: 95, confidence: 0.9 },
  { term: "drained", score: 90, confidence: 0.85 },
  { term: "wiped", score: 90, confidence: 0.85 },
  { term: "burned out", score: 90, confidence: 0.85 },
  { term: "burnt out", score: 90, confidence: 0.85 },
  { term: "can't stay awake", score: 98, confidence: 0.9 },
  { term: "cant stay awake", score: 98, confidence: 0.9 },
]

const FATIGUE_MODERATE: TermRule[] = [
  { term: "tired", score: 82, confidence: 0.85 },
  { term: "fatigued", score: 88, confidence: 0.9 },
  { term: "fatigue", score: 82, confidence: 0.8 },
  { term: "sleepy", score: 78, confidence: 0.8 },
  { term: "low energy", score: 82, confidence: 0.8 },
  { term: "run down", score: 82, confidence: 0.8 },
  { term: "worn out", score: 88, confidence: 0.85 },
]

const FATIGUE_LOW: TermRule[] = [
  { term: "not tired", score: 20, confidence: 0.75 },
  { term: "rested", score: 25, confidence: 0.65 },
  { term: "energized", score: 30, confidence: 0.65 },
  { term: "slept well", score: 25, confidence: 0.65 },
]

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreToStressLevel(score: number): StressLevel {
  if (score >= SCORE_LEVELS.HIGH) return "high"
  if (score >= SCORE_LEVELS.ELEVATED) return "elevated"
  if (score >= SCORE_LEVELS.MODERATE) return "moderate"
  return "low"
}

function scoreToFatigueLevel(score: number): FatigueLevel {
  if (score >= SCORE_LEVELS.HIGH) return "exhausted"
  if (score >= SCORE_LEVELS.ELEVATED) return "tired"
  if (score >= SCORE_LEVELS.MODERATE) return "normal"
  return "rested"
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function termToRegex(term: string): RegExp {
  const escaped = escapeRegExp(term).replace(/\s+/g, "\\s+")
  return new RegExp(`\\b${escaped}\\b`, "i")
}

function isNegated(text: string, term: string): boolean {
  const escaped = escapeRegExp(term).replace(/\s+/g, "\\s+")
  const negation = NEGATION_TOKENS.map((t) => escapeRegExp(t).replace(/\s+/g, "\\s+")).join("|")
  const pattern = `(?:\\b(?:${negation})\\b)\\s+(?:\\w+\\s+){0,2}${escaped}`
  return new RegExp(pattern, "i").test(text)
}

function pickBestRule(text: string, rules: TermRule[]): TermRule | null {
  for (const rule of rules) {
    if (!termToRegex(rule.term).test(text)) continue
    // Explicit "not X" rules are handled as-is (they already include negation in the term).
    if (!rule.term.includes("not ") && isNegated(text, rule.term)) continue
    return rule
  }
  return null
}

function pickBestSignal(text: string, high: TermRule[], moderate: TermRule[], low: TermRule[]) {
  return pickBestRule(text, high) ?? pickBestRule(text, moderate) ?? pickBestRule(text, low)
}

export function inferSemanticBiomarkersFromText(text: string): SemanticBiomarkers {
  const normalized = normalizeText(text)

  if (!normalized) {
    return {
      stressScore: BASELINE_SCORE,
      fatigueScore: BASELINE_SCORE,
      stressConfidence: BASELINE_CONFIDENCE,
      fatigueConfidence: BASELINE_CONFIDENCE,
      source: "keywords",
    }
  }

  const stressRule = pickBestSignal(normalized, STRESS_HIGH, STRESS_MODERATE, STRESS_LOW)
  const fatigueRule = pickBestSignal(normalized, FATIGUE_HIGH, FATIGUE_MODERATE, FATIGUE_LOW)

  return {
    stressScore: stressRule ? stressRule.score : BASELINE_SCORE,
    fatigueScore: fatigueRule ? fatigueRule.score : BASELINE_SCORE,
    stressConfidence: stressRule ? stressRule.confidence : BASELINE_CONFIDENCE,
    fatigueConfidence: fatigueRule ? fatigueRule.confidence : BASELINE_CONFIDENCE,
    source: "keywords",
  }
}

function pickDominant(prevScore: number, prevConfidence: number, nextScore: number, nextConfidence: number): number {
  const prevStrength = clamp01(prevConfidence) * Math.abs(prevScore - 50)
  const nextStrength = clamp01(nextConfidence) * Math.abs(nextScore - 50)
  return nextStrength >= prevStrength ? nextScore : prevScore
}

export function mergeSemanticBiomarkers(prev: SemanticBiomarkers | null, next: SemanticBiomarkers): SemanticBiomarkers {
  if (!prev) return next

  return {
    stressScore: pickDominant(prev.stressScore, prev.stressConfidence, next.stressScore, next.stressConfidence),
    fatigueScore: pickDominant(prev.fatigueScore, prev.fatigueConfidence, next.fatigueScore, next.fatigueConfidence),
    stressConfidence: Math.max(prev.stressConfidence, next.stressConfidence),
    fatigueConfidence: Math.max(prev.fatigueConfidence, next.fatigueConfidence),
    source: prev.source === "gemini" || next.source === "gemini" ? "gemini" : "keywords",
  }
}

function blendDimension(options: {
  acousticScore: number
  acousticConfidence: number
  semanticScore: number
  semanticConfidence: number
  baseAcousticWeight: number
  baseSemanticWeight: number
}): { score: number; acousticWeight: number; semanticWeight: number; confidence: number } {
  const aConf = clamp01(options.acousticConfidence)
  const sConf = clamp01(options.semanticConfidence)

  const acousticWeightRaw = options.baseAcousticWeight * (0.2 + 0.8 * aConf)
  const semanticStrength = sConf * sConf
  const semanticWeightRaw = options.baseSemanticWeight * semanticStrength

  const total = acousticWeightRaw + semanticWeightRaw
  if (total <= 0) {
    return {
      score: clampScore(options.acousticScore),
      acousticWeight: 1,
      semanticWeight: 0,
      confidence: aConf,
    }
  }

  const acousticWeight = acousticWeightRaw / total
  const semanticWeight = semanticWeightRaw / total

  const score =
    options.acousticScore * acousticWeight +
    options.semanticScore * semanticWeight

  const confidence = acousticWeight * aConf + semanticWeight * sConf

  return {
    score: clampScore(score),
    acousticWeight,
    semanticWeight,
    confidence: clamp01(confidence),
  }
}

export function blendAcousticAndSemanticBiomarkers(options: {
  acoustic: { stressScore: number; fatigueScore: number; confidence: number }
  semantic: { stressScore: number; fatigueScore: number; stressConfidence?: number; fatigueConfidence?: number; confidence?: number }
}): BlendedBiomarkers {
  const semanticStressConfidence = options.semantic.stressConfidence ?? options.semantic.confidence ?? BASELINE_CONFIDENCE
  const semanticFatigueConfidence = options.semantic.fatigueConfidence ?? options.semantic.confidence ?? BASELINE_CONFIDENCE

  const stress = blendDimension({
    acousticScore: options.acoustic.stressScore,
    acousticConfidence: options.acoustic.confidence,
    semanticScore: options.semantic.stressScore,
    semanticConfidence: semanticStressConfidence,
    baseAcousticWeight: 0.25,
    baseSemanticWeight: 0.75,
  })

  const fatigue = blendDimension({
    acousticScore: options.acoustic.fatigueScore,
    acousticConfidence: options.acoustic.confidence,
    semanticScore: options.semantic.fatigueScore,
    semanticConfidence: semanticFatigueConfidence,
    baseAcousticWeight: 0.35,
    baseSemanticWeight: 0.65,
  })

  return {
    stressScore: stress.score,
    fatigueScore: fatigue.score,
    stressLevel: scoreToStressLevel(stress.score),
    fatigueLevel: scoreToFatigueLevel(fatigue.score),
    confidence: clamp01((stress.confidence + fatigue.confidence) / 2),
    debug: {
      stress: {
        acousticWeight: stress.acousticWeight,
        semanticWeight: stress.semanticWeight,
        acousticConfidence: clamp01(options.acoustic.confidence),
        semanticConfidence: clamp01(semanticStressConfidence),
      },
      fatigue: {
        acousticWeight: fatigue.acousticWeight,
        semanticWeight: fatigue.semanticWeight,
        acousticConfidence: clamp01(options.acoustic.confidence),
        semanticConfidence: clamp01(semanticFatigueConfidence),
      },
    },
  }
}
