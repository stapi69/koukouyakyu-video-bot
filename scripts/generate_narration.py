#!/usr/bin/env python3
import json, os, subprocess, sys
from urllib.parse import quote

SPEAKER = 3

def run_curl(args, input_data=None):
    r = subprocess.run(['curl', '-s'] + args,
        input=input_data, capture_output=True)
    return r.stdout, r.returncode

def synthesize(text, output_file):
    print(f"  audio_query: {text[:40]}...", flush=True)
    encoded = quote(text)
    body, rc = run_curl(['-X', 'POST',
        f'http://localhost:50021/audio_query?text={encoded}&speaker={SPEAKER}'])
    print(f"  audio_query rc={rc} len={len(body)}", flush=True)
    if rc != 0 or len(body) < 100:
        raise RuntimeError(f"audio_query failed rc={rc}")
    try:
        query = json.loads(body)
    except Exception as e:
        raise RuntimeError(f"audio_query JSON parse error: {e}")

    print(f"  synthesis...", flush=True)
    with open('/tmp/vv_query.json', 'wb') as f:
        f.write(body)
    audio, rc = run_curl(['-X', 'POST',
        f'http://localhost:50021/synthesis?speaker={SPEAKER}',
        '-H', 'Content-Type: application/json',
        '-d', '@/tmp/vv_query.json'])
    print(f"  synthesis rc={rc} len={len(audio)}", flush=True)
    if rc != 0 or len(audio) < 1000:
        # エラー内容を表示
        try: print(f"  synthesis response: {audio[:200]}", flush=True)
        except: pass
        raise RuntimeError(f"synthesis failed rc={rc} size={len(audio)}")
    with open(output_file, 'wb') as f:
        f.write(audio)
    print(f"  ✅ {output_file}: {len(audio)} bytes", flush=True)

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
    ] + [
        (f"{g['tournament']}。{g['teamA']} {g['scoreA']}対{g['scoreB']} {g['teamB']}。"
         f"{'　'.join([g['teamA'] if g['scoreA'] > g['scoreB'] else g['teamB']])}が勝利しました。",
         f"narration/game{i}.wav", 4)
        for i, g in enumerate(games)
    ] + [
        ("本日も熱戦をお届けしました。チャンネル登録よろしくお願いします。", "narration/ending.wav", 2)
    ]

    wavs, ok = [], 0
    for text, wav, dur in items:
        print(f"\n生成: {text[:50]}", flush=True)
        try:
            synthesize(text, wav)
            ok += 1
        except Exception as e:
            print(f"  ❌ {e}", flush=True)
            silent(wav, dur)
        wavs.append(wav)

    print(f"\n成功: {ok}/{len(items)}", flush=True)
    with open('narration/list.txt', 'w') as f:
        f.write('\n'.join([f"file '{w}'" for w in wavs]))
    r = subprocess.run(['ffmpeg', '-f', 'concat', '-safe', '0',
        '-i', 'narration/list.txt', '-c', 'copy', 'narration/combined.wav', '-y'],
        capture_output=True)
    if r.returncode != 0:
        print(f"concat失敗: {r.stderr.decode()[:200]}", flush=True)
        sys.exit(1)
    sz = os.path.getsize('narration/combined.wav')
    print(f"✅ combined.wav: {sz} bytes (ok={ok}/{len(items)})", flush=True)

if __name__ == '__main__':
    main()
