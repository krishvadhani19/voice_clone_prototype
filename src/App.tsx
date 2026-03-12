import { useState, useRef } from 'react'
import { VOICE_MODELS, generate } from './api'

type Status = 'idle' | 'generating' | 'done' | 'error'

export default function App() {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5111'
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [groqApiKey, setGroqApiKey] = useState('')
  const [transcription, setTranscription] = useState('')
  const [feedback, setFeedback] = useState('')
  const [modelId, setModelId] = useState(VOICE_MODELS[0].id)
  const [language, setLanguage] = useState('English')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [generatedScript, setGeneratedScript] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const canSubmit =
    groqApiKey.trim() !== '' &&
    audioFile !== null &&
    transcription.trim() !== '' &&
    feedback.trim() !== '' &&
    status !== 'generating'

  async function handleSubmit() {
    if (!audioFile) return
    setStatus('generating')
    setErrorMsg('')
    setAudioUrl(null)
    setGeneratedScript('')
    try {
      const { blob, generatedScript: script } = await generate({ audioFile, transcription, feedback, groqApiKey, language, modelId, baseUrl })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setGeneratedScript(script)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    dragRef.current = false
    const file = e.dataTransfer.files[0]
    if (file && /\.(mp3|wav|m4a)$/i.test(file.name)) {
      setAudioFile(file)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setAudioFile(file)
  }

  const isLoading = status === 'generating'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Voice Clone Studio</h1>
        <p className="mt-2 text-zinc-400 text-sm">Clone a voice and generate new speech in a single shot.</p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Groq API Key */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Groq API Key</label>
          <input
            type="password"
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            placeholder="gsk_..."
            disabled={isLoading}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Voice Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Voice Model</label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={isLoading}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          >
            {VOICE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Audio Upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Audio Sample</label>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!dragRef.current) { dragRef.current = true; setDragging(true) } }}
            onDragLeave={() => { dragRef.current = false; setDragging(false) }}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging
                ? 'border-violet-500 bg-violet-500/10'
                : audioFile
                ? 'border-emerald-600 bg-emerald-950/30'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a"
              className="hidden"
              onChange={handleFileInput}
              disabled={isLoading}
            />
            {audioFile ? (
              <>
                <AudioIcon className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-sm font-medium text-emerald-400">{audioFile.name}</span>
                <span className="text-xs text-zinc-500 mt-1">{(audioFile.size / 1024).toFixed(0)} KB · Click to change</span>
              </>
            ) : (
              <>
                <UploadIcon className="w-8 h-8 text-zinc-500 mb-2" />
                <span className="text-sm text-zinc-400">Drag & drop or click to upload</span>
                <span className="text-xs text-zinc-600 mt-1">MP3, WAV, M4A</span>
              </>
            )}
          </div>
        </div>

        {/* Transcription */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Transcription <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="What was said in the uploaded audio…"
            disabled={isLoading}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Feedback */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Feedback <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What to change about the script…"
            disabled={isLoading}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Qwen language selector */}
        {modelId === 'qwen' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isLoading}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
            >
              {['English', 'Chinese', 'Japanese', 'Korean', 'French', 'German', 'Spanish'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl font-medium text-sm bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Spinner />
              Generating…
            </>
          ) : (
            'Clone & Generate'
          )}
        </button>

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-lg bg-red-950/50 border border-red-800 px-4 py-3 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Result */}
        {status === 'done' && audioUrl && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4">
            {generatedScript && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generated Script</p>
                <p className="text-sm text-zinc-200 bg-zinc-800 rounded-lg px-3 py-2.5 leading-relaxed">{generatedScript}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generated Audio</p>
              <audio controls src={audioUrl} className="w-full accent-violet-500" />
              <a
                href={audioUrl}
                download="generated.wav"
                className="text-center text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
