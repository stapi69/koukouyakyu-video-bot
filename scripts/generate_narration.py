#!/usr/bin/env python3
import json, subprocess, os, sys

print("START", flush=True)

with open('game.json', encoding='utf-8') as f:
    d = json.load(f)
games = d.get('games', [])
date = d.get('date', '')
print(f"date={date} games={len(games)}", flush=True)

os.makedirs('narration', exist_ok=True)

items = [
    (f"{date}の高校野球試合結果です", 'narration/opening', 2),
] + [
    (f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}", f'narration/game{i}', 3)
    for i, g in enumerate(games)
] + [
    ('チャンネル登録お願いします', 'narration/ending', 2)
]

wavs = []
for text, base, dur in items:
    wav = base + '.wav'
    # espeak-ngで試す（閾値を44バイト=WAVヘッダのみに下げる）
    r = subprocess.run(['espeak-ng', '-v', 'ja', text, '-w', wav], capture_output=True)
    sz = os.path.getsize(wav) if os.path.exists(wav) else 0
    print(f"  {base}: espeak={r.returncode} size={sz}bytes", flush=True)
    if sz <= 44:  # WAVヘッダのみ = 音声なし → 無音フォールバック
        subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i',
            'anullsrc=r=22050:cl=mono', '-t', str(dur), wav], capture_output=True)
        print(f"  → silent fallback (espeak produced no audio)", flush=True)
    else:
        print(f"  ✅ espeak audio OK ({sz} bytes)", flush=True)
    wavs.append(wav)

with open('narration/list.txt', 'w') as f:
    f.write('\n'.join([f"file '{w}'" for w in wavs]))

r = subprocess.run(['ffmpeg', '-f', 'concat', '-safe', '0',
    '-i', 'narration/list.txt', '-c', 'copy', 'narration/combined.wav', '-y'],
    capture_output=True)
sz = os.path.getsize('narration/combined.wav') if r.returncode == 0 else 0
print(f"combined.wav: sz={sz} rc={r.returncode}", flush=True)
if r.returncode != 0:
    print(r.stderr.decode()[:200], flush=True)
    sys.exit(1)
