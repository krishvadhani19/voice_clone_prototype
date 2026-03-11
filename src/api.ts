export type VoiceModel = {
  id: string
  label: string
}

export const VOICE_MODELS: VoiceModel[] = [
  { id: 'qwen', label: 'Qwen' },
  { id: 'resemble', label: 'Resemble' },
]

export type CloneVoiceParams = {
  audioFile: File
  transcription: string
  modelId: string
}

export type GenerateTTSParams = {
  clonedVoiceId: string
  script: string
  modelId: string
}

/**
 * Clone a voice from an audio sample.
 * Replace this implementation with your actual API call.
 * Expected to return a voice ID string.
 */
export async function cloneVoice(params: CloneVoiceParams): Promise<string> {
  const formData = new FormData()
  formData.append('audio', params.audioFile)
  formData.append('transcription', params.transcription)
  formData.append('model_id', params.modelId)

  const response = await fetch('/api/clone-voice', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voice cloning failed: ${error}`)
  }

  const data = await response.json()
  return data.voice_id as string
}

/**
 * Generate TTS audio using the cloned voice.
 * Replace this implementation with your actual API call.
 * Expected to return a Blob (audio/mpeg).
 */
export async function generateTTS(params: GenerateTTSParams): Promise<Blob> {
  const response = await fetch('/api/generate-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice_id: params.clonedVoiceId,
      script: params.script,
      model_id: params.modelId,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`TTS generation failed: ${error}`)
  }

  return response.blob()
}
