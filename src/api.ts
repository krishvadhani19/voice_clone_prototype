export type VoiceModel = {
  id: string
  label: string
}

export const VOICE_MODELS: VoiceModel[] = [
  { id: 'resemble', label: 'Resemble (ChatterboxTTS)' },
  { id: 'qwen', label: 'Qwen' },
]

export type GenerateParams = {
  audioFile: File
  transcription: string
  feedback: string
  groqApiKey: string
  modelId: string
  baseUrl: string
  // Qwen-only
  language?: string
}

export type GenerateResult = {
  blob: Blob
  generatedScript: string
}

/**
 * Routes to /chatterbox/generate or /qwen/generate based on modelId.
 * Sends feedback to server; server uses Ollama (qwen2.5:7b) to generate the TTS script.
 * Returns audio blob + the generated script from X-Generated-Script header.
 * Server runs at localhost:5111 (SSH tunnel: ssh -L 5111:localhost:5111 ra_krish@129.10.224.228)
 */
export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const formData = new FormData()
  formData.append('audio', params.audioFile)
  formData.append('transcription', params.transcription)
  formData.append('feedback', params.feedback)
  formData.append('groq_api_key', params.groqApiKey)

  let endpoint: string
  if (params.modelId === 'qwen') {
    endpoint = '/qwen/generate'
    if (params.language) formData.append('language', params.language)
  } else {
    endpoint = '/chatterbox/generate'
  }

  const base = params.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Generation failed: ${error}`)
  }

  const generatedScript = decodeURIComponent(response.headers.get('X-Generated-Script') ?? '')
  const blob = await response.blob()
  return { blob, generatedScript }
}
