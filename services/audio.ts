/**
 * Audio plumbing shared by the live conversation view.
 *
 * Kept out of the React components so the codec details (base64, PCM, WAV headers)
 * live in one place instead of being inlined next to the JSX.
 */

/** Sample rate the microphone is captured at, and what the Live API expects. */
export const INPUT_SAMPLE_RATE = 16000;
/** Sample rate the model's speech comes back at. */
export const OUTPUT_SAMPLE_RATE = 24000;

export interface PcmBlob {
  data: string;
  mimeType: string;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Turns raw 16-bit PCM from the model into a playable AudioBuffer. */
export async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/** Packs one microphone frame for the Live API. */
export function createPcmBlob(data: Float32Array): PcmBlob {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
  };
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Concatenates captured microphone frames into a mono 16-bit WAV file.
 * WAV rather than WebM because it is one of the container formats the
 * transcription model accepts directly.
 */
export function encodeWav(chunks: Float32Array[], sampleRate: number): Uint8Array {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const byteLength = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          /* PCM header size */
  view.setUint16(20, 1, true);           /* format: PCM */
  view.setUint16(22, 1, true);           /* channels: mono */
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); /* byte rate */
  view.setUint16(32, 2, true);           /* block align */
  view.setUint16(34, 16, true);          /* bits per sample */
  writeAscii(view, 36, 'data');
  view.setUint32(40, byteLength, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Sends a recording to the backend for speech-to-text.
 *
 * Deliberately server-side: the browser's Web Speech API depends on Google's
 * cloud endpoint, which privacy-focused browsers (Brave) and many networks block
 * outright, so it fails with an opaque 'network' error and no transcript.
 */
export async function transcribeRecording(chunks: Float32Array[], sampleRate: number): Promise<string> {
  const wav = encodeWav(chunks, sampleRate);

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: encodeBase64(wav), mime_type: 'audio/wav' }),
  });

  if (!response.ok) {
    throw new Error(`Transcription failed (${response.status})`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}
