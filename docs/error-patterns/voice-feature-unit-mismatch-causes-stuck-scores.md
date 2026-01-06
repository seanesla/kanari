# Voice feature unit mismatch causes “stuck” stress/fatigue scores

## What it looks like

- Check-ins repeatedly report the **same stress/fatigue scores** (commonly `stress=75`, `fatigue=50`), even across very different recordings.
- Stress/fatigue “jumps” rarely (only when some single threshold flips), making the model feel broken.
- In debug logs, extracted features can look obviously wrong for the expected thresholds:
  - `zcr` is > 1 (often dozens) because it’s a **count per frame**, not a normalized rate.
  - `spectralFlux` is >> 1 because it’s an **unscaled spectrum distance**.
  - `spectralCentroid` can be **NaN** (one NaN poisons the mean) or in a different unit than expected.

## Why it happens

- `lib/ml/inference.ts` scoring thresholds assume several features are **normalized to 0..1** (`spectralCentroid`, `spectralFlux`, `zcr`).
- `lib/audio/feature-extractor.ts` originally passed through some raw Meyda outputs and a manual spectral-flux computation that:
  - produced `zcr` in **counts**, not `[0,1]`
  - produced `spectralFlux` in **large arbitrary units**
  - sometimes produced `spectralCentroid` that could become `NaN` and/or used a unit that didn’t match the thresholds
- With thresholds now completely misaligned to the feature ranges, the heuristic model **always hits the same buckets**, collapsing to repeated scores (e.g., `30+25+20 = 75`).

## How to detect it automatically

- Add an integration test that runs `FeatureExtractor` on a known WAV and asserts:
  - `spectralCentroid`, `spectralFlux`, `spectralRolloff`, `zcr` are **finite** and within `[0,1]`
  - `speechRate` is finite and within a reasonable bound (e.g., `<= 20`)

Example: `lib/audio/__tests__/feature-extractor.test.ts`.

## How to fix it

- Normalize features at extraction time and make units explicit:
  - Compute `spectralCentroid` and `spectralRolloff` from `amplitudeSpectrum` and normalize to `0..1`.
  - Compute `spectralFlux` from **normalized spectra** and scale it into `0..1`.
  - Compute `zcr` as a **normalized zero-crossing rate** (`crossings / frameLength`).
  - Ignore non-finite values when aggregating (avoid NaN poisoning).
- If speech-rate estimation uses overlapped windows, apply an overlap compensation factor so the value matches the “syllables/sec”-style thresholds.

## References

- `lib/audio/feature-extractor.ts`
- `lib/ml/inference.ts`
- Regression test: `lib/audio/__tests__/feature-extractor.test.ts`

