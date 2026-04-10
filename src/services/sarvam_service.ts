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
    speaker: 'anand',
  });
}
