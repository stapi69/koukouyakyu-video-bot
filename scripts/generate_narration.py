#!/usr/bin/env python3
import json, subprocess, os, sys

print("=== ナレーション生成スクリプト開始 ===", flush=True)

# game.json確認
try:
    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)
    games = d.get('games', [])
    date = d.get('date', '')
    print(f"game.json OK: {date}, {len(games)}試合", flush=True)
except Exception as e:
    print(f"game.json エラー: {e}", flush=True)
    sys.exit(1)

os.makedirs('narration', exist_ok=True)

# まずgTTSを試す（シンプルなテスト）
print("=== gTTS テスト ===", flush=True)
try:
    from gtts import gTTS
    print("gTTS インポート OK", flush=True)
    tts = gTTS(text="テスト", lang='ja')
    tts.save('/tmp/gtts_test.mp3')
    size = os.path.getsize('/tmp/gtts_test.mp3')
    print(f"gTTS テスト mp3: {size} bytes", flush=True)
    GTTS_OK = size > 1000
except Exception as e:
    print(f"gTTS エラー: {e}", flush=True)
    GTTS_OK = False

print(f"gTTS 利用可能: {GTTS_OK}", flush=True)

# テキストリスト
texts = [(f"{date}の高校野球、試合結果ダイジェストです。", 'narration/opening', 2)]
for i, g in enumerate(games):
    winner = g['teamA'] if g['scoreA'] > g['scoreB'] else g['teamB']
    t = f"{g['tournament']}。{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{winner}が勝利しました。"
    texts.append((t, f'narration/game{i}', 3))
texts.append(('チャンネル登録よろしくお願いします。', 'narration/ending', 2))

success = 0
for text, base, dur in texts:
    outfile = base + '.wav'
    print(f"\n生成: {text[:40]}", flush=True)
    ok = False
    
    if GTTS_OK:
        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang='ja')
            mp3 = outfile + '.mp3'
            tts.save(mp3)
            size = os.path.getsize(mp3)
            print(f"  gTTS mp3: {size} bytes", flush=True)
            if size > 1000:
                subprocess.run(['ffmpeg', '-y', '-i', mp3, '-ar', '22050', '-ac', '1', outfile], capture_output=True)
                wav_size = os.path.getsize(outfile) if os.path.exists(outfile) else 0
                if wav_size > 5000:
                    print(f"  ✅ gTTS WAV: {wav_size} bytes", flush=True)
                    ok = True
        except Exception as e:
            print(f"  gTTS error: {e}", flush=True)
    
    if not ok:
        print(f"  → フォールバック（無音）", flush=True)
        subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono',
            '-t', str(dur), outfile], capture_output=True)
    else:
        success += 1

print(f"\n=== 結果: {success}/{len(texts)} 成功 ===", flush=True)

# 結合
files = [t[1] + '.wav' for t in texts if os.path.exists(t[1] + '.wav')]
with open('narration/list.txt', 'w') as f:
    f.write('\n'.join([f"file '{fn}'" for fn in files]))

result = subprocess.run(
    ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', 'narration/list.txt',
     '-c', 'copy', 'narration/combined.wav', '-y'],
    capture_output=True
)
if result.returncode == 0:
    size = os.path.getsize('narration/combined.wav')
    print(f"✅ combined.wav: {size} bytes", flush=True)
else:
    print(f"❌ 結合失敗: {result.stderr.decode()[:200]}", flush=True)
    sys.exit(1)

print("=== スクリプト完了 ===", flush=True)
