#!/usr/bin/env python3
"""Rebuild index.html's HD_PHOTOS list from the photos in media/hd-cars/ (<id>-<set>.jpg, set = studio|sunset|neon),
and check every photo has its thumbnail in media/hd-cars/thumbs/. Run from anywhere: python3 .claude/skills/run-amboola/hd-photos.py"""
import os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D, SETS = os.path.join(ROOT, 'media/hd-cars'), ('studio', 'sunset', 'neon')
photos = {}
for f in sorted(os.listdir(D)):
    m = re.fullmatch(r'(.+)-(studio|sunset|neon)\.jpg', f)
    if not m: continue
    if not os.path.exists(os.path.join(D, 'thumbs', f)): raise SystemExit(f'missing thumbnail: thumbs/{f}')
    photos.setdefault(m[1], []).append(m[2])
body = ', '.join(f"{k if re.fullmatch(r'[a-z_][a-z0-9_]*', k) else repr(k)}: [{', '.join(repr(s) for s in SETS if s in v)}]" for k, v in photos.items())
lines, line = [], ''
for part in body.split(', '):                                     # wrap at ~150 columns like the rest of index.html
    if len(line) + len(part) > 150: lines.append(line.rstrip()); line = '  '
    line += part + ', '
lines.append(line.rstrip(', '))
new = 'const HD_PHOTOS = { ' + '\n'.join(lines).lstrip() + ' };'
p = os.path.join(ROOT, 'index.html'); s = open(p, encoding='utf8').read()
s2, n = re.subn(r'const HD_PHOTOS = \{.*?\};', lambda _: new, s, count=1, flags=re.S)
if n != 1: raise SystemExit('HD_PHOTOS not found in index.html')
open(p, 'w', encoding='utf8').write(s2)
print(f'HD_PHOTOS: {len(photos)} cars, {sum(map(len, photos.values()))} photos')
