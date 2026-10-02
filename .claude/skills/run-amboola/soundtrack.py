#!/usr/bin/env python3
# Synthesize the Amboola trailer soundtrack from the director's timeline (needs numpy, e.g. Blender's bundled python).
#   python soundtrack.py timeline.json out.wav
# Music: a 128 BPM electronic track in A minor (Am F C G) that drops on the title card - kick, clap, hats, side-chained
# bass, pad and an arpeggio - with a drone + riser over the cold open. Sound effects hit on the director's frames:
# whoosh (cuts), beep (drag-tree ambers), launch (green light: beep + engine roar), impact, cash, siren.
import sys, json, wave, math
import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1])); FPS, TOTAL = tl['fps'], tl['total']
DUR = TOTAL / FPS + 1.0
N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
T = lambda d: np.arange(int(d * SR)) / SR

def put(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    s = sig[:N - i0] * gain
    L[i0:i0 + len(s)] += s * math.cos((pan + 1) * math.pi / 4) * 1.414
    R[i0:i0 + len(s)] += s * math.sin((pan + 1) * math.pi / 4) * 1.414

def lowpass(x, fc):
    """one-pole lowpass; fc may be a scalar or an array (time-varying cutoff)"""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y

def saw(f, t): return 2 * ((f * t) % 1) - 1
def noise(n): return rng.uniform(-1, 1, n)

# ---------------------------------------------------------------- instruments
def kick():
    t = T(.42); f = 44 + 120 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6.5) + noise(len(t)) * np.exp(-t * 300) * .3
def clap():
    t = T(.25); n = noise(len(t)); env = np.exp(-t * 22)
    for d in (.0, .011, .023): env = env + (t >= d) * np.exp(-np.maximum(t - d, 0) * 160) * .7
    hp = np.diff(n, prepend=0); return lowpass(hp * env, 5000) * .9
def hat(open_=False):
    t = T(.22 if open_ else .05); n = np.diff(np.diff(noise(len(t)), prepend=0), prepend=0)
    return n * np.exp(-t * (14 if open_ else 70)) * .35
def bass(f, d):
    t = T(d); x = saw(f, t) * .7 + np.sin(2 * np.pi * f * t) * .6
    env = np.minimum(1, t / .004) * np.exp(-t * 5)
    return np.tanh(lowpass(x, 300 + 1400 * np.exp(-t * 18)) * 2) * env * .55
def pad(freqs, d):
    t = T(d); x = sum(saw(f * dt, t) for f in freqs for dt in (.997, 1.003)) / (2 * len(freqs))
    env = np.minimum(1, t / .35) * np.minimum(1, (d - t) / .3)
    return lowpass(x, 1500) * env * .5
def pluck(f, d=.16):
    t = T(d); x = np.sign(np.sin(2 * np.pi * f * t)) * .6 + saw(f * 2, t) * .3
    return lowpass(x, 900 + 3500 * np.exp(-t * 25)) * np.exp(-t * 14) * .3
def whoosh():
    t = T(.7); env = np.sin(np.pi * np.minimum(1, t / .7)) ** 2
    return lowpass(noise(len(t)), 300 + 5200 * env) * env * .9
def impact():
    t = T(2.2); boom = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 9)) * t) * np.exp(-t * 2.2)
    return boom * 1.1 + lowpass(noise(len(t)), 900) * np.exp(-t * 5) * .8
def beep(f=880, d=.17):
    t = T(d); return np.sin(2 * np.pi * f * t) * np.minimum(1, (d - t) / .02) * .32
def roar(d=2.8):
    """launch: engine pulses whose firing frequency climbs through two gearshifts, distorted, with intake noise"""
    t = T(d); f = np.where(t < 1.1, 32 + 170 * (t / 1.1) ** .8, np.where(t < 2.0, 120 + 110 * (np.maximum(t - 1.1, 0) / .9) ** .8, 150 + 90 * (t - 2.0) / .8))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(ph * h) / h for h in (1, 2, 3, 4, 6)) + noise(len(t)) * .25
    env = np.minimum(1, t / .03) * np.minimum(1, (d - t) / .6)
    return lowpass(np.tanh(x * 2.4), 2600) * env * .75
def cash():
    t = T(.6); x = (np.sin(2 * np.pi * 1318.5 * t) + .7 * np.sin(2 * np.pi * 1760 * t) * (t > .07)) * np.exp(-t * 7)
    return x * .28 + np.diff(noise(len(t)), prepend=0) * np.exp(-t * 60) * .25
def siren(d=2.6):
    t = T(d); f = np.where((t * 1.6) % 1 < .5, 720, 960); ph = 2 * np.pi * np.cumsum(f) / SR
    return lowpass(np.tanh(np.sin(ph) * 3), 2500) * np.minimum(1, t / .2) * np.minimum(1, (d - t) / .4) * .22

# ---------------------------------------------------------------- music
BPM = 128; BEAT = 60 / BPM; BAR = 4 * BEAT; SIX = BEAT / 4
t0 = tl['title'] / FPS; tend = TOTAL / FPS
CHORDS = [  # (bass root Hz, pad/arp chord tones Hz)
    (55.00, [220.0, 261.6, 329.6]), (43.65, [174.6, 220.0, 261.6]), (65.41, [261.6, 329.6, 392.0]), (49.00, [196.0, 246.9, 293.7])]
music_L = np.zeros(N); music_R = np.zeros(N); kick_times = []
def mput(sig, t, gain=1.0, pan=0.0):
    i0 = int(t * SR)
    if i0 >= N or i0 < 0: return
    s = sig[:N - i0] * gain
    music_L[i0:i0 + len(s)] += s * math.cos((pan + 1) * math.pi / 4) * 1.414
    music_R[i0:i0 + len(s)] += s * math.sin((pan + 1) * math.pi / 4) * 1.414
# cold open: A drone and a noise riser into the drop
td = T(t0); drone = lowpass(saw(55, td) + saw(55.3, td) + .5 * saw(110.2, td), 380) * np.minimum(1, td / 1.0) * .22
riser = lowpass(noise(len(td)), 200 + 6000 * (td / t0) ** 3) * (td / t0) ** 2 * .35
put(drone + riser, 0)
K, CL, HC, HO, WH = kick(), clap(), hat(), hat(True), whoosh()
bass_cache, pad_cache, pluck_cache = {}, {}, {}
nbars = int((tend - t0) / BAR) + 2
for b in range(nbars):
    root, tones = CHORDS[b % 4]; tb = t0 + b * BAR
    if tb > tend + 1: break
    for beat in range(4):
        tk = tb + beat * BEAT; kick_times.append(tk); put(K, tk, .95)
        if beat in (1, 3): put(CL, tk, .55)
        put(HC, tk + BEAT / 2, .8, .3); put(HO, tk + BEAT / 2, .35, -.3)
        put(HC, tk + BEAT * .25, .4, .25); put(HC, tk + BEAT * .75, .4, .25)
    for s in range(16):   # off-beat rolling bass: the 16ths after each kick
        if s % 4 == 0: continue
        f = root * (2 if s % 4 == 2 else 1)
        if f not in bass_cache: bass_cache[f] = bass(f, SIX * .95)
        mput(bass_cache[f], tb + s * SIX, .9)
    key = tuple(tones)
    if key not in pad_cache: pad_cache[key] = pad(tones, BAR)
    mput(pad_cache[key], tb, .55)
    if b >= 2:   # arpeggio enters after the first two bars
        for s in range(16):
            f = tones[[0, 1, 2, 1, 2, 0, 1, 2][s % 8]] * (2 if s % 8 >= 4 else 1)
            if f not in pluck_cache: pluck_cache[f] = pluck(f)
            mput(pluck_cache[f], tb + s * SIX, .55, .35 if s % 2 else -.35)
# side-chain the bass/pad/arp to the kick for the pumping sound, then mix it in
duck = np.ones(N); dk = 1 - .65 * np.exp(-T(BEAT) * 14)
for tk in kick_times:
    i0 = int(tk * SR)
    if i0 < N: duck[i0:i0 + len(dk)] = np.minimum(duck[i0:i0 + len(dk)], dk[:N - i0])
L += music_L * duck; R += music_R * duck
# fade the music out at the very end
fo = np.clip((tend - np.arange(N) / SR) / 2.5, 0, 1); L *= fo; R *= fo

# ---------------------------------------------------------------- sound effects on the director's frames
FX = {'whoosh': (WH, .55), 'impact': (impact(), .9), 'beep': (beep(), 1.0), 'cash': (cash(), .8), 'siren': (siren(), .8)}
ROAR = roar()
for e in tl['events']:
    t = e['f'] / FPS
    if e['type'] == 'launch': put(beep(1320, .3), t, 1.0); put(ROAR, t, .75)
    elif e['type'] == 'whoosh': put(WH, t - .25, .5, rng.uniform(-.6, .6))   # peaks on the cut
    elif e['type'] in FX: sig, g = FX[e['type']]; put(sig, t, g)
for t in tl['scenes'][1:]:   # a soft whoosh on every other cut too, so montage cuts land
    t /= FPS
    if not any(abs(e['f'] / FPS - t) < .05 for e in tl['events']): put(WH, t - .25, .22, rng.uniform(-.5, .5))

# ---------------------------------------------------------------- master
st = np.stack([L, R], 1)[:int(tend * SR) + SR // 2]
st = np.tanh(st * 1.1); st /= np.max(np.abs(st)) / .9
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'soundtrack: {len(st) / SR:.1f} s, {len(tl["events"])} sound effects -> {sys.argv[2]}')
