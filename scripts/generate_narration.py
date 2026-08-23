#!/usr/bin/env python3
"""
複数のTTSエンジンでナレーション音声を生成
gTTS → edge-tts → espeak-ng → 無音フォールバック
"""
import json
import subprocess
import os
import asyncio
import sys

def make_silent(filepath, duration=3):
    subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i',
        'anullsrc=r=22050:cl=mono', '-t', str(duration), filepath],
        capture_output=True)
    print(f"  → 無音WAV生成: {duration}秒")

def mp3_to_wav(mp3_path, wav_path):
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', mp3_path, '-ar', '22050', '-ac', '1', wav_path],
        capture_output=True
    )
    return result.returncode == 0

def try_gtts(text, filepath):
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang='ja', slow=False)
        mp3 = filepath + '.mp3'
        tts.save(mp3)
        size = os.path.getsize(mp3)
        print(f"  gTTS mp3: {size} bytes")
        if size < 1000:
            return False
        mp3_to_wav(mp3, filepath)
        wav_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
        return wav_size > 5000
    except Exception as e:
        print(f"  gTTS error: {e}")
        return False

async def _edge_tts_generate(text, mp3_path):
    import edge_tts
    communicate = edge_tts.Communicate(text, "ja-JP-NanamiNeural")
    await communicate.save(mp3_path)

def try_edge_tts(text, filepath):
    try:
        mp3 = filepath + '_edge.mp3'
        asyncio.run(_edge_tts_generate(text, mp3))
        size = os.path.getsize(mp3) if os.path.exists(mp3) else 0
        print(f"  edge-tts mp3: {size} bytes")
        if size < 1000:
            return False
        mp3_to_wav(mp3, filepath)
        wav_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
        return wav_size > 5000
    except Exception as e:
        print(f"  edge-tts error: {e}")
        return False

def try_espeak(text, filepath):
    try:
        with open('/tmp/esp_text.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        result = subprocess.run(
            ['espeak-ng', '-v', 'ja', '-s', '130', '-f', '/tmp/esp_text.txt', '-w', filepath],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"  espeak-ng error: {result.stderr[:100]}")
            return False
        size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
        print(f"  espeak-ng wav: {size} bytes")
        return size > 5000
    except Exception as e:
        print(f"  espeak-ng error: {e}")
        return False

def generate_one(text, outbase, duration=3):
    outfile = outbase + '.wav'
    print(f"\n生成: {text[:40]}...")

    for name, fn in [('gTTS', try_gtts), ('edge-tts', try_edge_tts), ('espeak-ng', try_espeak)]:
        print(f"  試行: {name}")
        try:
            ok = fn(text, outfile)
        except Exception as e:
            print(f"  {name} exception: {e}")
            ok = False
        if ok:
            print(f"  ✅ {name} 成功")
            return True

    print(f"  ⚠️ 全TTS失敗 → 無音フォールバック")
    make_silent(outfile, duration)
    return False

def main():
    os.makedirs('narration', exist_ok=True)

    with open('game.json', encoding='utf-8') as f:
        d = json.load(f)

    games = d.get('games', [])
    date = d.get('date', '')

    print(f"試合数: {len(games)}, 日付: {date}")

    items = [
        (f"{date}の高校野球、試合結果ダイジェストです。", 'narration/opening', 2),
    ]
    for i, g in enumerate(games):
        winner = g['teamA'] if g['scoreA'] > g['scoreB'] else g['teamB']
        t = f"{g['tournament']}。{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。{winner}が勝利しました。"
        items.append((t, f'narration/game{i}', 3))
    items.append(('チャンネル登録よろしくお願いします。', 'narration/ending', 2))

    success = sum(1 for text, base, dur in items if generate_one(text, base, dur))
    print(f"\n結果: {success}/{len(items)} 成功")

    # 結合
    files = [base + '.wav' for _, base, _ in items if os.path.exists(base + '.wav')]
    with open('narration/list.txt', 'w') as f:
        f.write('\n'.join([f"file '{fn}'" for fn in files]))

    result = subprocess.run(
        ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', 'narration/list.txt',
         '-c', 'copy', 'narration/combined.wav', '-y'],
        capture_output=True
    )
    if result.returncode == 0:
        size = os.path.getsize('narration/combined.wav')
        print(f"✅ combined.wav: {size} bytes (TTS成功: {success}/{len(items)})")
    else:
        print(f"❌ 結合失敗: {result.stderr.decode()[:200]}")
        sys.exit(1)

if __name__ == '__main__':
    main()
