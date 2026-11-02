#!/usr/bin/env python3
"""Record today's news.js as one MP3 so the phone can keep playing with the screen off
(iPhone stops speechSynthesis when it locks, but a real audio file keeps going).

    pip install piper-tts      # plus ffmpeg on PATH (or pip install imageio-ffmpeg)
    python scripts/news_audio.py

Uses the free offline Piper voice zh_CN-huayan-medium (downloaded once to ~/.cache/piper).
Writes news-audio/news-<date>.mp3 and news-audio.js with where each item starts.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = 'zh_CN-huayan-medium'
VOICE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/'
CACHE = Path.home() / '.cache' / 'piper'
NUMS = '一二三四五六七八九十'


def voice_model():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in (VOICE + '.onnx', VOICE + '.onnx.json'):
        f = CACHE / name
        if not f.exists():
            urllib.request.urlretrieve(VOICE_URL + name, f)
    return CACHE / (VOICE + '.onnx')


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg  # local fallback when ffmpeg isn't installed
    return imageio_ffmpeg.get_ffmpeg_exe()


def tidy(s):
    # The voice reads plain sentences best: drop brackets/quotes, spell out a couple of symbols.
    for a, b in (('“', ''), ('”', ''), ('"', ''), ('「', ''), ('」', ''), ('《', ''), ('》', ''), ('…', '。'),
                 ('%', '%'), ('·', '，'), ('|', '，'), ('丨', '，'), ('?', '？'), ('!', '！')):
        s = s.replace(a, b)
    return s.strip()


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

    model = voice_model()
    out_dir = ROOT / 'news-audio'
    out_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wavs = []
        for k, text in enumerate(parts):
            w = Path(tmp) / f'{k:02d}.wav'
            subprocess.run([sys.executable, '-m', 'piper', '-m', str(model), '-f', str(w),
                            '--length-scale', '1.12', '--sentence-silence', '0.35'],
                           input=text.encode('utf-8'), check=True, capture_output=True)
            wavs.append(w)
        # Join with a short pause and note where each news item starts.
        starts, frames = [], 0
        joined = Path(tmp) / 'all.wav'
        with wave.open(str(joined), 'wb') as out:
            for k, w in enumerate(wavs):
                with wave.open(str(w), 'rb') as src:
                    if k == 0:
                        out.setparams(src.getparams())
                        rate, gap = src.getframerate(), b'\x00' * src.getsampwidth() * int(src.getframerate() * 0.9)
                    if 1 <= k <= len(items):
                        starts.append(round(frames / rate, 2))
                    out.writeframes(src.readframes(src.getnframes()))
                    frames += src.getnframes()
                out.writeframes(gap)
                frames += len(gap) // 2
        name = f"news-{news['updated']}.mp3"
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(joined), '-ac', '1', '-b:a', '40k',
                        str(out_dir / name)], check=True)
    for old in out_dir.glob('news-*.mp3'):
        if old.name != name:
            old.unlink()
    meta = {'date': news['updated'], 'file': 'news-audio/' + name, 'count': len(items),
            'starts': starts, 'length': round(frames / rate, 1)}
    (ROOT / 'news-audio.js').write_text('window.NEWS_AUDIO = ' + json.dumps(meta) + ';\n', encoding='utf-8')
    print(f"{name}: {meta['length']} s, {(out_dir / name).stat().st_size // 1024} KB")
    return 0


if __name__ == '__main__':
    sys.exit(main())
