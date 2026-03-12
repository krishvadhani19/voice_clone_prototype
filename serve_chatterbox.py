import torch
import soundfile as sf
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import io
import tempfile
import os
import subprocess
import logging
import requests
import urllib.parse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


from chatterbox.tts import ChatterboxTTS
print("Loading Chatterbox...")
cb_model = ChatterboxTTS.from_pretrained(device="cuda:0")
print("Chatterbox ready!")

from qwen_tts import Qwen3TTSModel
print("Loading Qwen TTS...")
qwen_model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)
print("Qwen TTS ready!")


def generate_script_from_feedback(transcription: str, feedback: str, api_key: str) -> str:
    logger.info("Calling Groq to generate updated script...")
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-oss-20b",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a TTS script writer. Given an original spoken transcription and feedback, "
                        "rewrite the full script applying the feedback. "
                        "The output must be a complete, natural spoken script — similar in length to the original, "
                        "written in a conversational tone suitable for text-to-speech. "
                        "Output only the script text — no labels, no quotes, no explanations, no commentary."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Original transcription:\n{transcription}\n\nFeedback to apply:\n{feedback}\n\nRewritten script:",
                },
            ],
            "max_tokens": 512,
        },
        timeout=30,
    )
    response.raise_for_status()
    script = response.json()["choices"][0]["message"]["content"].strip()
    logger.info(f"Generated script: {script}")
    return script


def convert_to_wav(input_path):
    output_path = input_path.rsplit(".", 1)[0] + "_converted.wav"
    subprocess.run([
        "ffmpeg", "-y", "-i", input_path,
        "-ac", "1", "-ar", "24000", output_path
    ], check=True, capture_output=True)
    return output_path


def save_upload_to_temp(audio_file):
    ext = os.path.splitext(audio_file.filename)[1] or ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    audio_file.save(tmp.name)
    tmp.close()
    return tmp.name


@app.route("/chatterbox/generate", methods=["POST"])
def chatterbox_generate():
    logger.info("Chatterbox request received")
    transcription = request.form.get("transcription", "")
    feedback = request.form.get("feedback", "")
    api_key = request.form.get("groq_api_key", "")
    text = generate_script_from_feedback(transcription, feedback, api_key)

    audio_file = request.files["audio"]
    tmp_path = save_upload_to_temp(audio_file)
    wav_path = None

    try:
        wav_path = convert_to_wav(tmp_path)
        logger.info("Generating with Chatterbox...")
        wav = cb_model.generate(
            text,
            audio_prompt_path=wav_path,
            exaggeration=0.7,
            cfg_weight=0.3,
        )
        logger.info("Chatterbox generation complete")
    finally:
        os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)

    buffer = io.BytesIO()
    sf.write(buffer, wav.squeeze().cpu().numpy(), cb_model.sr, format="WAV")
    buffer.seek(0)
    response = send_file(buffer, mimetype="audio/wav")
    response.headers["X-Generated-Script"] = urllib.parse.quote(text)
    response.headers["Access-Control-Expose-Headers"] = "X-Generated-Script"
    return response


@app.route("/qwen/generate", methods=["POST"])
def qwen_generate():
    logger.info("Qwen request received")
    transcription = request.form.get("transcription", "")
    feedback = request.form.get("feedback", "")
    api_key = request.form.get("groq_api_key", "")
    text = generate_script_from_feedback(transcription, feedback, api_key)
    ref_text = transcription  # transcription doubles as ref_text for Qwen voice cloning
    language = request.form.get("language", "English")

    audio_file = request.files["audio"]
    tmp_path = save_upload_to_temp(audio_file)

    try:
        logger.info("Creating voice clone prompt...")
        voice_clone_prompt = qwen_model.create_voice_clone_prompt(
            ref_audio=tmp_path,
            ref_text=ref_text,
            x_vector_only_mode=False,
        )
        logger.info("Generating with Qwen...")
        wavs, sr = qwen_model.generate_voice_clone(
            text=[text],
            language=[language],
            voice_clone_prompt=voice_clone_prompt,
        )
        logger.info("Qwen generation complete")
    finally:
        os.unlink(tmp_path)

    buffer = io.BytesIO()
    sf.write(buffer, wavs[0], sr, format="WAV")
    buffer.seek(0)
    response = send_file(buffer, mimetype="audio/wav")
    response.headers["X-Generated-Script"] = urllib.parse.quote(text)
    response.headers["Access-Control-Expose-Headers"] = "X-Generated-Script"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "models": ["chatterbox", "qwen"]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5111)
