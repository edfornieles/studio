"""Text-to-speech engines for the Jabber generator.

Every engine has the same small interface:

    engine = make_engine(args)          # from command-line options
    pcm, rate = engine.synth("One sentence.")   # float32 mono numpy array, sample rate
    engine.label                         # e.g. "pocket:alba", stored in the manifest

Engines
-------
pocket  Kyutai Pocket TTS, runs on any CPU, free. Default.
        --voice alba (or a path to a .wav / .safetensors voice)

fish    Fish Audio (e.g. Drama 3), over HTTP. Two ways to run it:
        * your own machine: fish-speech's API server (default http://127.0.0.1:8080/v1/tts)
              --engine fish --fish-url http://127.0.0.1:8080/v1/tts --fish-voice <reference_id>
        * Fish Audio's hosted API (paid per character):
              --engine fish --fish-url https://api.fish.audio/v1/tts --fish-model <model id>
              --fish-voice <voice/reference id>      and FISH_API_KEY in the environment
        The request is JSON {"text", "reference_id", "format": "wav"}. The hosted API also
        takes the model in a "model" header. Field names follow Fish's published docs and
        fish-speech's api_client; check them against your installed version (see
        docs/tts-backend.md) before a long run: `python generate.py --probe ...`.

Mixing engines inside one book changes the voice between sections, so pick one per book.
"""
import io
import json
import os
import urllib.request
import wave

import numpy as np


class PocketEngine:
    def __init__(self, voice="alba"):
        from pocket_tts import TTSModel  # imported here so other engines don't need it
        self.model = TTSModel.load_model()
        self.voice = self.model.get_state_for_audio_prompt(voice)
        self.rate = self.model.sample_rate
        self.label = f"pocket:{os.path.basename(str(voice)).rsplit('.', 1)[0]}"

    def synth(self, text):
        return self.model.generate_audio(self.voice, text).numpy().astype(np.float32), self.rate


def decode_wav(data):
    with wave.open(io.BytesIO(data)) as w:
        rate, width, channels = w.getframerate(), w.getsampwidth(), w.getnchannels()
        raw = w.readframes(w.getnframes())
    if width == 2:
        pcm = np.frombuffer(raw, "<i2").astype(np.float32) / 32768
    elif width == 4:
        pcm = np.frombuffer(raw, "<i4").astype(np.float32) / 2147483648
    else:
        raise ValueError(f"unsupported WAV sample width {width}")
    if channels > 1:
        pcm = pcm.reshape(-1, channels).mean(axis=1)
    return pcm, rate


class FishEngine:
    def __init__(self, url, voice=None, model=None, api_key=None, timeout=300):
        self.url, self.voice, self.model, self.timeout = url, voice, model, timeout
        self.api_key = api_key or os.environ.get("FISH_API_KEY")
        self.label = f"fish:{model or 'local'}:{voice or 'default'}"

    def synth(self, text):
        body = {"text": text, "format": "wav"}
        if self.voice:
            body["reference_id"] = self.voice
        req = urllib.request.Request(self.url, data=json.dumps(body).encode(), method="POST")
        req.add_header("Content-Type", "application/json")
        if self.api_key:
            req.add_header("Authorization", f"Bearer {self.api_key}")
        if self.model:
            req.add_header("model", self.model)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Fish TTS {e.code}: {e.read()[:300]!r}") from None
        if not data.startswith(b"RIFF"):
            raise RuntimeError(f"Fish TTS did not return WAV audio (got {data[:60]!r})")
        return decode_wav(data)


def add_engine_args(ap):
    ap.add_argument("--engine", choices=["pocket", "fish"], default="pocket")
    ap.add_argument("--voice", default="alba", help="pocket: voice name or .wav/.safetensors path")
    ap.add_argument("--fish-url", default="http://127.0.0.1:8080/v1/tts")
    ap.add_argument("--fish-voice", default=None, help="fish: reference_id of the voice")
    ap.add_argument("--fish-model", default=None, help="fish hosted API: model id sent in the 'model' header")


def make_engine(args):
    if args.engine == "fish":
        return FishEngine(args.fish_url, args.fish_voice, args.fish_model)
    return PocketEngine(args.voice)
