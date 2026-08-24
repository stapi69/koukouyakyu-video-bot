#!/usr/bin/env python3
"""Google Cloud TTS（APIキー方式）でナレーション生成"""
import json, os, subprocess, sys, base64, struct
from urllib.request import urlopen, Request

API_KEY = os.environ.get('GCP_TTS_API_KEY', '')
TTS_URL = f'https://texttospeech.googleapis.com/v1/text:synthesize?key={API_KEY}'

def pcm_to_wav(pcm_data, rate=24000, channels=1, bits=16):
    data_size = len(pcm_data)
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', data_size + 36, b'WAVE',
        b'fmt ', 16, 1, channels, rate,
        rate * channels * bits // 8,
        channels * bits // 8, bits,
        b'data', data_size)
    return header + pcm_data

def tts(text):
    payload = json.dumps({
        'input': {'text': text},
        'voice': {'languageCode': 'ja-JP', 'name': 'ja-JP-Neural2-B'},
        'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}
    }).encode('utf-8')
    req = Request(TTS_URL, data=payload,
                  headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=30) as r:
        result = json.loads(r.read())
    pcm = base64.b64decode(result['audioContent'])
    return pcm_to_wav(pcm)

def silent(sec=3, rate=24000):
    pcm = b'\x00' * int(sec * rate * 2)
    return pcm_to_wav(pcm)

def main():
    if not API_KEY:
        print('GCP_TTS_API_KEY が未設定です', flush=True)
        sys.exit(1)

    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date  = d.get('date', '')
    print(f"games={len(games)} date={date}", flush=True)
    os.makedirs('narration', exist_ok=True)

    segs = [
        (f"{date}の高校野球、試合結果ダイジェストです。", 'narration/00_open.wav', 2),
    ]
    for i, g in enumerate(games):
        win = g['teamA'] if int(g['scoreA']) > int(g['scoreB']) else g['teamB']
        t = f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{win}が勝利しました。"
        segs.append((t, f"narration/{i+1:02d}_game.wav", 4))
    segs.append(("本日も熱戦をお届けしました。チャンネル登録よろしくお願いします。",
                  'narration/99_end.wav', 2))

    ok, wavs = 0, []
    for text, wav, dur in segs:
        print(f"\n生成: {text[:50]}", flush=True)
        try:
            audio = tts(text)
            open(wav, 'wb').write(audio)
            print(f"  ✅ {wav}: {len(audio)} bytes", flush=True)
            ok += 1
        except Exception as e:
            print(f"  ❌ {e}", flush=True)
            open(wav, 'wb').write(silent(dur))
        wavs.append(wav)

    print(f"\n成功: {ok}/{len(segs)}", flush=True)
    open('narration/list.txt', 'w').write(
        '\n'.join(f"file '{w}'" for w in wavs))
    r = subprocess.run(
        'ffmpeg -f concat -safe 0 -i narration/list.txt -c copy narration/combined.wav -y -loglevel quiet',
        shell=True, capture_output=True)
    if r.returncode != 0:
        open('narration/combined.wav', 'wb').write(silent(15))
    sz = os.path.getsize('narration/combined.wav')
    print(f"combined.wav: {sz} bytes", flush=True)

if __name__ == '__main__':
    main()
