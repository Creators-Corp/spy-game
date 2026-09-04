# -*- coding: utf-8 -*-
"""96 kHz / 24-bit masters -> 48 kHz / 16-bit, in place, for the sealed build.

Everything in the pack is decrypted client-side before the gate opens, so an
extra 13 MB of inaudible headroom is 13 MB the room waits for. 2:1 decimation
is exact at these rates; the only real question is aliasing, so the signal is
low-passed with a binomial kernel before every second sample is taken. What
folds down without it lives above 24 kHz, which is nobody's hearing, but it
folds into the audible band and that is the part that matters.

The masters stay in git history; this rewrites what ships.
"""
import os, wave, numpy as np

ART = r'C:\Users\Vitor\Documents\deux-complices\art'
FILES = ['sfx-step.wav', 'sfx-impact.wav', 'sfx-caught.wav', 'sfx-victory.wav']
KERNEL = np.array([1, 4, 6, 4, 1], dtype=np.float64)
KERNEL /= KERNEL.sum()


def read24(path):
    w = wave.open(path, 'rb')
    ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    raw = w.readframes(n)
    w.close()
    b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, width)
    if width == 3:
        # 24-bit little-endian, sign-extended into int32
        v = (b[:, 0].astype(np.int32)
             | (b[:, 1].astype(np.int32) << 8)
             | (b[:, 2].astype(np.int8).astype(np.int32) << 16))
        peak = float(1 << 23)
    elif width == 2:
        v = raw_i16 = np.frombuffer(raw, dtype='<i2').astype(np.int32)
        peak = float(1 << 15)
    else:
        raise SystemExit('unexpected sample width %d in %s' % (width, path))
    return v.reshape(-1, ch).astype(np.float64) / peak, rate, ch


def halve(x):
    """low-pass, then take every second frame"""
    pad = np.pad(x, ((2, 2), (0, 0)), mode='edge')
    out = np.zeros_like(x)
    for i, k in enumerate(KERNEL):
        out += k * pad[i:i + len(x)]
    return out[::2]


total_before = total_after = 0
for f in FILES:
    p = os.path.join(ART, f)
    before = os.path.getsize(p)
    x, rate, ch = read24(p)
    while rate > 50000:
        x = halve(x)
        rate //= 2
    # to 16-bit, clipped rather than wrapped
    y = np.clip(np.rint(x * 32767.0), -32768, 32767).astype('<i2')
    w = wave.open(p, 'wb')
    w.setnchannels(ch); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(y.tobytes())
    w.close()
    after = os.path.getsize(p)
    total_before += before; total_after += after
    print('%-18s %7.2f MB -> %5.2f MB   %d Hz / 16-bit / %dch   peak %.3f'
          % (f, before / 1e6, after / 1e6, rate, ch, float(np.abs(x).max())))

print('---')
print('total %.2f MB -> %.2f MB  (%.0f%% smaller)'
      % (total_before / 1e6, total_after / 1e6, 100 * (1 - total_after / total_before)))
