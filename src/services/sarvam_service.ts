import * as sarvam from '@livekit/agents-plugin-sarvam';

export function getSTT() {
  return new sarvam.STT({
    languageCode: 'hi-IN',
    model: 'saaras:v3',
    mode: 'codemix', // Optimized for Hinglish (Hindi + English mix)
  });
}

export function getTTS() {
  return new sarvam.TTS({
    model: 'bulbul:v3',
    targetLanguageCode: 'hi-IN',
    speaker: 'priya',        // Female voice — matches the "Priya" persona
    pace: 1.0,               // Default pace (1.1 was causing TTS to fall behind)
    temperature: 0.7,        // Natural vocal variation
    sampleRate: 16000,       // 16kHz is plenty for voice calls, much faster to stream
  });
}
