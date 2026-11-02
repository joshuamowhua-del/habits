#!/usr/bin/env python3
"""Record today's news.js as one MP3 so the phone can keep playing with the screen off
(iPhone stops speechSynthesis when it locks, but a real audio file keeps going).

    pip install kokoro-onnx soundfile "misaki[zh]==0.9.4"   # plus ffmpeg on PATH (or pip install imageio-ffmpeg)
    python scripts/news_audio.py

Voice: Microsoft Azure neural TTS (free F0 tier, 0.5M characters a month) when AZURE_SPEECH_KEY and
AZURE_SPEECH_REGION are set — the news-anchor voice AZURE_VOICE below. Without a key, or if Azure fails,
it falls back to the free open-source Kokoro-82M v1.1-zh model (files cached in ~/.cache/kokoro).
Every sentence of every item is read in full.
Writes news-audio/news-<date>.mp3 and news-audio.js with where each item starts.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import io
import urllib.error
import urllib.request
import uuid
from xml.sax.saxutils import escape
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
VOICE = os.environ.get('NEWS_VOICE', 'zm_031')  # soft male; samples of other voices were zm_014, zm_010
SPEED = 0.92
CACHE = Path.home() / '.cache' / 'kokoro'
FILES = {
    'kokoro-v1.1-zh.onnx': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.onnx',
    'voices-v1.1-zh.bin': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin',
    'config.json': 'https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/resolve/main/config.json',
}
AZURE_VOICE = os.environ.get('NEWS_AZURE_VOICE', 'zh-CN-YunyangNeural')  # male news anchor
AZURE_STYLE = os.environ.get('NEWS_AZURE_STYLE', 'newscast-casual')
AZURE_RATE = os.environ.get('NEWS_AZURE_RATE', '-6%')
RATE = 24000
NUMS = '一二三四五六七八九十'


def model_files():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        f = CACHE / name
        if not f.exists() or f.stat().st_size == 0:
            urllib.request.urlretrieve(url, f)
    return CACHE


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg  # local fallback when ffmpeg isn't installed
    return imageio_ffmpeg.get_ffmpeg_exe()


def tidy(s):
    # The voice reads plain sentences best: drop brackets/quotes, spell out a couple of symbols.
    for a, b in (('“', ''), ('”', ''), ('"', ''), ('「', ''), ('」', ''), ('《', ''), ('》', ''), ('…', '。'),
                 ('%', '%'), ('·', '，'), ('|', '，'), ('丨', '，'), ('?', '？'), ('!', '！'), ('~', '到')):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def sentences(text):
    """Split into sentences, and long sentences at commas, so no piece is too long for the model."""
    out = []
    for sent in re.split(r'(?<=[。！？；])', text):
        sent = sent.strip()
        while len(sent) > 70:
            cut = max(sent.rfind(c, 0, 70) for c in '，、,')
            cut = cut if cut > 10 else 70
            out.append(sent[:cut + 1]); sent = sent[cut + 1:].strip()
        if sent:
            out.append(sent)
    return out


class AzureVoice:
    """One request per news item, so the anchor voice gets whole paragraphs and reads them naturally."""
    whole_items = True

    def __init__(self, key, region):
        self.key = key
        self.url = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'

    def say(self, text):
        body = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" '
                f'xml:lang="zh-CN"><voice name="{AZURE_VOICE}"><mstts:express-as style="{AZURE_STYLE}">'
                f'<prosody rate="{AZURE_RATE}">{escape(text)}</prosody></mstts:express-as></voice></speak>')
        req = urllib.request.Request(self.url, data=body.encode('utf-8'), method='POST', headers={
            'Ocp-Apim-Subscription-Key': self.key, 'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'habits-news',
            'X-RequestId': uuid.uuid4().hex})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    audio, sr = sf.read(io.BytesIO(r.read()), dtype='float32')
                    assert sr == RATE, sr
                    return audio
            except urllib.error.HTTPError as e:
                if e.code != 429 or attempt == 3:  # 429 = free tier's per-minute limit; wait and retry
                    raise
                time.sleep(15 * (attempt + 1))


class Voice:
    whole_items = False

    def __init__(self):
        from kokoro_onnx import Kokoro
        from kokoro_onnx.tokenizer import Tokenizer
        from misaki import zh
        d = model_files()
        self.k = Kokoro(str(d / 'kokoro-v1.1-zh.onnx'), str(d / 'voices-v1.1-zh.bin'), vocab_config=str(d / 'config.json'))
        tok = Tokenizer()
        # English words (AI, OpenAI, PMI…) are read with an English pronunciation instead of being dropped.
        self.g2p = zh.ZHG2P(version='1.1', en_callable=lambda s: tok.phonemize(s, 'en-us'))
        self.style = self.k.get_voice_style(VOICE)

    def say(self, text):
        ph, _ = self.g2p(text)
        toks = self.k.tokenizer.tokenize(ph)[:500]
        if not toks:
            return np.zeros(0, dtype=np.float32)
        # Called directly: kokoro-onnx passes speed with the wrong dtype for this model version.
        audio = self.k.sess.run(None, {
            'input_ids': np.array([[0, *toks, 0]], dtype=np.int64),
            'style': np.array(self.style[len(toks)], dtype=np.float32),
            'speed': np.array([SPEED], dtype=np.float32),
        })[0]
        return np.asarray(audio, dtype=np.float32).squeeze()


def main():
    body = (ROOT / 'news.js').read_text(encoding='utf-8')
    news = json.loads(body[body.index('=') + 1:].strip().rstrip(';'))
    items = news['items']
    m, d = int(news['updated'][5:7]), int(news['updated'][8:10])
    parts = [f'睿睿播报。今天是{m}月{d}日，一共{len(items)}条新闻。']
    for k, n in enumerate(items):
        num = NUMS[k] if k < 10 else str(k + 1)
        parts.append(tidy(f"第{num}条，{n['tag']}。{n['title']}。{n.get('summary', '')}"))
    parts.append('今天的新闻就播到这里。祝爸爸妈妈身体健康，开开心心！')

    key, region = os.environ.get('AZURE_SPEECH_KEY'), os.environ.get('AZURE_SPEECH_REGION', 'eastus')
    v = AzureVoice(key, region) if key else Voice()
    try:
        wav, starts, total = record(v, parts, len(items))
        engine = f'Azure {AZURE_VOICE}' if key else f'Kokoro {VOICE}'
    except Exception as e:  # quota used up, network trouble…: the open-source voice still gets the news out
        if not key:
            raise
        print(f'Azure TTS failed ({e}); falling back to Kokoro', file=sys.stderr)
        wav, starts, total = record(Voice(), parts, len(items))
        engine = f'Kokoro {VOICE} (fallback)'
    write(news, items, wav, starts, total, engine)
    return 0


def record(v, parts, n_items):
    pause = lambda sec: np.zeros(int(RATE * sec), dtype=np.float32)
    chunks, starts, total = [], [], 0
    for k, text in enumerate(parts):
        if 1 <= k <= n_items:
            starts.append(round(total / RATE, 2))
        for sent in ([text] if v.whole_items else sentences(text)):
            for a in (v.say(sent), pause(0.32)):
                chunks.append(a); total += len(a)
        a = pause(0.8)
        chunks.append(a); total += len(a)
    wav = np.concatenate(chunks)
    wav = wav / max(1e-6, float(np.abs(wav).max())) * 0.9
    return wav, starts, total


def write(news, items, wav, starts, total, engine):
    out_dir = ROOT / 'news-audio'
    out_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        w, mp3 = Path(tmp) / 'all.wav', Path(tmp) / 'news.mp3'
        sf.write(w, wav, RATE)
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(w), '-ac', '1', '-b:a', '48k', str(mp3)], check=True)
        # The content hash is in the name, so phones never replay an older recording they cached for the same day.
        name = f"news-{news['updated']}-{hashlib.sha1(mp3.read_bytes()).hexdigest()[:8]}.mp3"
        shutil.move(str(mp3), out_dir / name)
    for old in out_dir.glob('news-*.mp3'):
        if old.name != name:
            old.unlink()
    meta = {'date': news['updated'], 'file': 'news-audio/' + name, 'count': len(items),
            'starts': starts, 'length': round(total / RATE, 1)}
    (ROOT / 'news-audio.js').write_text('window.NEWS_AUDIO = ' + json.dumps(meta) + ';\n', encoding='utf-8')
    print(f"{name}: {meta['length']} s, {(out_dir / name).stat().st_size // 1024} KB, voice {engine}")


if __name__ == '__main__':
    sys.exit(main())
