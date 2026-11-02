#!/usr/bin/env python3
"""Record today's news.js as one MP3 so the phone can keep playing with the screen off
(iPhone stops speechSynthesis when it locks, but a real audio file keeps going).

    pip install kokoro-onnx soundfile "misaki[zh]==0.9.4"   # plus ffmpeg on PATH (or pip install imageio-ffmpeg)
    python scripts/news_audio.py

Voice: the free open-source Kokoro-82M v1.1-zh model (Apache-2.0), soft male voice VOICE below.
The model files are downloaded once to ~/.cache/kokoro. Every sentence of every item is read in full.
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
import urllib.request
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


class Voice:
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

    v = Voice()
    pause = lambda sec: np.zeros(int(RATE * sec), dtype=np.float32)
    chunks, starts, total = [], [], 0
    for k, text in enumerate(parts):
        if 1 <= k <= len(items):
            starts.append(round(total / RATE, 2))
        for sent in sentences(text):
            for a in (v.say(sent), pause(0.32)):
                chunks.append(a); total += len(a)
        a = pause(0.8)
        chunks.append(a); total += len(a)
    wav = np.concatenate(chunks)
    wav = wav / max(1e-6, float(np.abs(wav).max())) * 0.9

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
    print(f"{name}: {meta['length']} s, {(out_dir / name).stat().st_size // 1024} KB, voice {VOICE}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
