# Audio Pipeline Documentation

Complete client-side audio processing pipeline for voice biomarker extraction in the kanari burnout detection app.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Audio Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. AudioRecorder (recorder.ts)                            │
│     ↓ Raw audio (Float32Array @ 16kHz mono)               │
│                                                             │
│  2. VoiceActivityDetector (vad.ts)                         │
│     ↓ Speech segments (filtered, non-speech removed)       │
│                                                             │
│  3. FeatureExtractor (feature-extractor.ts)                │
│     ↓ Audio features (MFCCs, spectral, temporal)          │
│                                                             │
│  4. AudioProcessor (processor.ts)                          │
│     → ProcessingResult (features + metadata)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Files

### 1. `recorder.ts`

Web Audio API wrapper for capturing microphone audio.

**Key Features:**
- 16kHz mono recording (VAD-compatible)
- Real-time audio level callbacks
- Graceful error handling
- Permission management

**Usage:**
```typescript
import { AudioRecorder } from "@/lib/audio/recorder"

const recorder = new AudioRecorder({
  sampleRate: 16000,
  channelCount: 1,
  onDataAvailable: (chunk) => {
    console.log("Audio chunk:", chunk)
  },
  onError: (error) => {
    console.error("Recording error:", error)
  },
})

await recorder.start()
// ... record audio ...
const audioData = await recorder.stop()
```

**States:**
- `idle` - Not recording
- `requesting` - Requesting microphone permission
- `recording` - Active recording
- `stopping` - Stopping and processing
- `error` - Error occurred

### 2. `vad.ts`

Voice Activity Detection using Silero VAD with energy-based fallback.

**Key Features:**
- Silero VAD integration (@ricky0123/vad-web)
- Automatic speech segmentation
- Energy-based fallback (SimpleVAD)
- Configurable thresholds

**Usage:**
```typescript
import { segmentSpeech } from "@/lib/audio/vad"

const segments = await segmentSpeech(audioData, {
  sampleRate: 16000,
  minSpeechDuration: 250, // ms
  minSilenceDuration: 500, // ms
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
})

// segments = [{ audio: Float32Array, start: 0.5, end: 2.3 }, ...]
```

**Note:** Silero VAD requires 16kHz audio. The implementation includes automatic resampling if needed.

### 3. `feature-extractor.ts`

Acoustic feature extraction using Meyda.

**Extracted Features:**
- **Spectral:** MFCCs (13 coefficients), spectral centroid, flux, rolloff
- **Energy:** RMS, zero-crossing rate
- **Temporal:** Speech rate, pause ratio, pause count, average pause duration
- **Pitch:** Mean F0, pitch standard deviation, pitch range (via YIN algorithm)

**Usage:**
```typescript
import { extractFeatures } from "@/lib/audio/feature-extractor"

const features = extractFeatures(audioData, {
  sampleRate: 16000,
  bufferSize: 512,
  hopSize: 256,
})

console.log(features)
// {
//   mfcc: [13 coefficients],
//   spectralCentroid: 0.23,  // Normalized 0..1 (0 = low, 1 = high)
//   spectralFlux: 0.12,      // Normalized 0..1 (higher = more dynamic)
//   spectralRolloff: 0.62,   // Normalized 0..1
//   rms: 0.045,
//   zcr: 0.123,
//   speechRate: 4.2,
//   pauseRatio: 0.35,
//   pauseCount: 12,
//   avgPauseDuration: 450.3,
//   pitchMean: 165.2,      // Mean F0 in Hz
//   pitchStdDev: 23.4,     // Pitch variability
//   pitchRange: 87.6,      // Max - Min pitch
// }
```

**Algorithm Details:**
- Frame-by-frame analysis with overlapping windows
- RMS-based voice activity for temporal features
- Energy peak detection for speech rate estimation
- MFCC aggregation via mean across frames
- YIN algorithm for fundamental frequency (pitch) detection

### 4. `processor.ts`

Main orchestrator that coordinates the entire pipeline.

**Usage:**
```typescript
import { processAudio } from "@/lib/audio/processor"

const result = await processAudio(audioData, {
  sampleRate: 16000,
  enableVAD: true,
  vadOptions: {
    minSpeechDuration: 250,
    minSilenceDuration: 500,
  },
  featureOptions: {
    bufferSize: 512,
    hopSize: 256,
  },
})

console.log(result)
// {
//   features: AudioFeatures,
//   segments: SpeechSegment[],
//   metadata: {
//     duration: 45.2,
//     speechDuration: 32.1,
//     processingTime: 234.5,
//     vadEnabled: true,
//   }
// }
```

### 5. `index.ts`

Barrel export for clean imports.

**Usage:**
```typescript
import {
  AudioRecorder,
  processAudio,
  extractFeatures,
  segmentSpeech,
} from "@/lib/audio"
```

## React Integration

### `hooks/use-recording.ts`

Complete React hook for recording workflow.

**States:**
- `idle` - Ready to record
- `requesting` - Requesting permission
- `recording` - Active recording
- `processing` - Processing audio
- `complete` - Processing complete
- `error` - Error occurred

**Usage:**
```typescript
import { useRecording } from "@/hooks/use-recording"

function RecordingComponent() {
  const [data, controls] = useRecording({
    sampleRate: 16000,
    enableVAD: true,
    autoProcess: true,
    onComplete: (result) => {
      console.log("Recording complete:", result)
      // Save to database
    },
    onError: (error) => {
      console.error("Error:", error)
    },
  })

  const { state, duration, audioLevel, features, error } = data
  const { startRecording, stopRecording, cancelRecording, reset } = controls

  return (
    <div>
      <button onClick={startRecording}>Start</button>
      <button onClick={stopRecording}>Stop</button>
      <p>Duration: {duration}s</p>
      <p>Level: {audioLevel}</p>
      {features && <pre>{JSON.stringify(features, null, 2)}</pre>}
    </div>
  )
}
```

### `components/dashboard/recording-waveform.tsx`

Audio visualization components.

**Components:**
1. **RecordingWaveform** - Canvas-based waveform
   - Realtime mode: Scrolling bars
   - Static mode: Full waveform visualization

2. **AudioLevelMeter** - Bar meter visualization

3. **AudioLevelCircle** - Circular level indicator

**Usage:**
```typescript
import { RecordingWaveform, AudioLevelMeter } from "@/components/dashboard/recording-waveform"

// Real-time
<AudioLevelMeter level={audioLevel} barCount={30} />

// Static waveform
<RecordingWaveform
  mode="static"
  audioData={audioData}
  width={400}
  height={80}
/>
```

## Integration Example

See `app/dashboard/record/page.tsx` for complete integration example.

## Dependencies

```json
{
  "meyda": "^5.6.3",
  "@ricky0123/vad-web": "^0.0.30"
}
```

## Browser Compatibility

- **Chrome/Edge:** Full support
- **Firefox:** Full support
- **Safari:** Full support (iOS 11+)

**Requirements:**
- `navigator.mediaDevices.getUserMedia`
- `AudioContext`
- `AudioWorkletNode` (modern API, replaces deprecated ScriptProcessorNode)

**Future:**
- Consider using `NonRealTimeVAD` for offline processing

## Performance

**Typical Processing Times:**
- 30s recording: ~200-300ms
- 60s recording: ~400-600ms

**Memory Usage:**
- 30s @ 16kHz mono: ~960KB (Float32Array)
- 60s @ 16kHz mono: ~1.9MB (Float32Array)

**Optimizations:**
- Frame-by-frame processing (constant memory)
- Chunked audio data handling
- VAD reduces feature extraction load

## Privacy

All processing happens **client-side**:
- Audio never leaves the device
- No network requests for audio data
- Features stored locally (IndexedDB)
- HIPAA/GDPR compliant architecture

## Known Limitations

1. **VAD Accuracy:** Energy-based fallback is less accurate than Silero
2. **Speech Rate:** Proxy-based estimation (energy peaks ≠ syllables)
3. **Resampling:** Linear interpolation (good enough, not perfect)

## Future Improvements

1. Add formant extraction (F1-F3)
2. Improve speech rate algorithm (use proper syllable detection)
3. Add real-time feature visualization
4. Support stereo input (currently mono only)
5. Add audio preprocessing (noise reduction, normalization)

## Testing

```bash
# Build check
pnpm build

# Run dev server
pnpm dev

# Test recording at /dashboard/record
```

## Troubleshooting

**Microphone permission denied:**
- Check browser settings
- HTTPS required (or localhost)
- Clear site permissions and retry

**No audio detected:**
- Check microphone is not muted
- Check system audio settings
- Try different microphone

**VAD not working:**
- Ensure 16kHz sample rate
- Check audio has actual speech
- Falls back to energy-based detection

**Processing too slow:**
- Reduce bufferSize (512 → 256)
- Disable VAD for faster processing
- Check browser performance

## License

Part of kanari - Gemini 3 Hackathon 2025
