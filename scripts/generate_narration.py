#!/usr/bin/env python3
import json, os, subprocess, sys

try:
    import requests
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'requests',
                    '--break-system-packages', '-q'])
    import requests

VOICEVOX = "http://localhost:50021"
SPEAKER = 3

def synthesize(text, output_file):
    print(f"  [audio_query] {text[:40]}", flush=True)
    r = requests.post(
        f"{VOICEVOX}/audio_query",
        params={"text": text, "speaker": SPEAKER},
        timeout=60
    )
    r.raise_for_status()
    query = r.json()
    print(f"  [synthesis] ...", flush=True)
    r2 = requests.post(
        f"{VOICEVOX}/synthesis",
        params={"speaker": SPEAKER},
        json=query,
        timeout=600  # CPU版は最大10分待機
    )
    r2.raise_for_status()
    ct = r2.headers.get("content-type", "")
    size = len(r2.content)
    print(f"  ct={ct} size={size}", flush=True)
    if "audio" not in ct and size < 1000:
        raise RuntimeError(f"synthesis returned non-audio: {r2.content[:100]}")
    with open(output_file, 'wb') as f:
        f.write(r2.content)
    print(f"  ✅ {output_file}: {size} bytes", flush=True)
    return size

def silent(output_file, duration=3):
    subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i',
                    'anullsrc=r=22050:cl=mono', '-t', str(duration), output_file],
                   capture_output=True)

def main():
    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date = d.get('date', '')
    print(f"date={date} games={len(games)}", flush=True)

    os.makedirs('narration', exist_ok=True)

    items = [
        (f"{date}の高校野球、試合結果ダイジェストです。", 'narration/opening.wav', 2),
    ]
    for i, g in enumerate(games):
        winner = g['teamA'] if g['scoreA'] > g['scoreB'] else g['teamB']
        t = f"{g['tournament']}。{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{winner}が勝利しました。"
        items.append((t, f"narration/game{i}.wav", 4))
    items.append(("本日も熱戦をお届けしました。チャンネル登録よろしくお願いします。", "narration/ending.wav", 2))

    wavs = []
    ok_count = 0
    for text, wav, dur in items:
        print(f"\n生成: {text[:50]}", flush=True)
        try:
            synthesize(text, wav)
            ok_count += 1
        except Exception as e:
            print(f"  ❌ {e}", flush=True)
            silent(wav, dur)
            print(f"  → 無音フォールバック", flush=True)
        wavs.append(wav)

    print(f"\n成功: {ok_count}/{len(items)}", flush=True)

    with open('narration/list.txt', 'w') as f:
        f.write('\n'.join([f"file '{w}'" for w in wavs]))

    r = subprocess.run(
        ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', 'narration/list.txt',
         '-c', 'copy', 'narration/combined.wav', '-y'],
        capture_output=True
    )
    if r.returncode != 0:
        print(f"concat失敗: {r.stderr.decode()[:200]}", flush=True)
        sys.exit(1)
    sz = os.path.getsize('narration/combined.wav')
    print(f"✅ combined.wav: {sz} bytes (narration={ok_count}/{len(items)})", flush=True)

if __name__ == '__main__':
    main()
