#!/usr/bin/env python3
"""
Step1: ゲームテキストをカナに変換してファイルに保存
Step2: bashが各ファイルを読んでVoiceVoxで合成
"""
import json, os, sys

def to_kana(text):
    try:
        import pykakasi
        kks = pykakasi.kakasi()
        return ''.join([item['kana'] for item in kks.convert(text)])
    except Exception:
        return text

with open('game.json', encoding='utf-8') as f:
    d = json.load(f)
games = d.get('games', [])
date = d.get('date', '')

os.makedirs('narration', exist_ok=True)
os.makedirs('/tmp/vv_texts', exist_ok=True)

segments = [
    (f"{date}の高校野球試合結果です", 'narration/00_open.wav', 2),
]
for i, g in enumerate(games):
    win = g['teamA'] if int(g['scoreA']) > int(g['scoreB']) else g['teamB']
    t = f"{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']} {win}が勝利しました"
    segments.append((t, f"narration/{i+1:02d}_game.wav", 4))
segments.append(("チャンネル登録よろしくお願いします", 'narration/99_end.wav', 2))

# カナ変換してbash用テキストファイルに書き出す
for i, (text, wav, dur) in enumerate(segments):
    kana = to_kana(text)
    print(f"[{wav}] {kana[:50]}", flush=True)
    with open(f'/tmp/vv_texts/{i:02d}_kana.txt', 'w') as f2:
        f2.write(kana)
    with open(f'/tmp/vv_texts/{i:02d}_wav.txt', 'w') as f2:
        f2.write(wav)
    with open(f'/tmp/vv_texts/{i:02d}_dur.txt', 'w') as f2:
        f2.write(str(dur))

# segment数を保存
with open('/tmp/vv_texts/count.txt', 'w') as f:
    f.write(str(len(segments)))

print(f"カナ変換完了: {len(segments)}件", flush=True)
