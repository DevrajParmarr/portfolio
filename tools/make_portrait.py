"""Turn a portrait photo into the particle density map used by the hero scene.

    python tools/make_portrait.py path/to/photo.jpg [--preview preview.png]

Writes assets/js/portrait-data.js: a 128x160 density grid + luminance grid (base64).
Only this derived map is published — keep the source photo out of the repo.
Works best with a plain, light background (passport-style).
"""
import argparse, base64, json, os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter, ImageOps

GW, GH = 128, 160            # grid size (aspect 0.8)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def background_mask(lum, sat):
    """Flood-fill near-white, low-saturation pixels connected to the image border."""
    cand = (lum > 0.82) & (sat < 0.14)
    h, w = cand.shape
    bg = np.zeros_like(cand)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg


def head_ellipse(fg):
    """Rough head ellipse (normalised u,v in -0.5..0.5) from the silhouette's row widths."""
    h, w = fg.shape
    rows = [np.flatnonzero(fg[y]) for y in range(h)]
    widths = np.array([r[-1] - r[0] if len(r) else 0 for r in rows])
    top = int(np.argmax(widths > 0))
    head_w = widths[top:top + int(h * 0.45)].max()
    bottom = top + 1
    while bottom < h - 1 and widths[bottom] < head_w * 1.45:
        bottom += 1
    head_rows = [r for r in rows[top:bottom] if len(r)]
    cx = np.mean([(r[0] + r[-1]) / 2 for r in head_rows]) / w - 0.5
    cy = ((top + bottom) / 2) / h - 0.5
    return {'cx': round(float(cx), 3), 'cy': round(float(cy), 3),
            'rx': round(float(head_w / w / 2 * 1.05), 3), 'ry': round(float((bottom - top) / h / 2), 3)}


def build(src):
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w, h = im.size
    crop_h = min(h, int(w / 0.8))                       # head & shoulders at 4:5
    im = im.crop((0, 0, w, crop_h)).resize((GW * 2, GH * 2), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    sat = a.max(-1) - a.min(-1)

    fg = ~background_mask(lum, sat)
    fg_img = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    fg = np.asarray(fg_img) > 127

    # equalise brightness inside the subject: the lit face takes most of the particles,
    # darker features (eyes, brows, hair, shirt) read as gaps
    vals = lum[fg]
    ranks = np.empty(vals.size); ranks[np.argsort(vals, kind='stable')] = np.arange(vals.size)
    lum_n = np.zeros_like(lum); lum_n[fg] = ranks / max(vals.size - 1, 1)
    # local contrast: features darker than their surroundings (eyes, brows, mustache) dig in
    local = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255
    lum_n = np.clip(lum_n + 2.2 * (lum - local), 0, 1)
    # warm skin tones carry the image; the grey shirt is dimmed
    skin = 0.35 + 0.65 * np.clip((a[..., 0] - a[..., 2]) / 0.12, 0, 1)
    tone = lum_n ** 2.4 * skin
    # taper below the chin so the face, not the neck, is the brightest area
    hd = head_ellipse(fg)
    v = (np.arange(fg.shape[0])[:, None] + 0.5) / fg.shape[0] - 0.5
    tone = tone * (1 - 0.6 * np.clip((v - (hd['cy'] + hd['ry'])) / 0.25, 0, 1))

    # soft feature edges (blur hides fabric texture) + a crisp silhouette outline
    blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32) / 255
    gx = np.zeros_like(blur); gy = np.zeros_like(blur)
    gx[:, 1:-1] = blur[:, 2:] - blur[:, :-2]
    gy[1:-1, :] = blur[2:, :] - blur[:-2, :]
    edge = np.hypot(gx, gy)
    edge = np.clip(edge / max(np.percentile(edge[fg], 99), 1e-3), 0, 1) ** 1.5
    inner = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 127
    outline = (fg & ~inner).astype(np.float32)

    dens = fg * (0.03 + tone + 0.3 * edge) + 0.9 * outline

    def down(x):  # 2x2 average → grid
        return x.reshape(GH, 2, GW, 2).mean(axis=(1, 3))

    d = down(dens); f = down(fg.astype(np.float32))
    l = down(tone * fg); l = np.clip(l / max(np.percentile(l[f > 0.5], 99), 1e-3), 0, 1) ** 0.6
    d = (d / d.max() * 255).astype(np.uint8)
    l = (l * 255).astype(np.uint8)
    return d, l, head_ellipse(f > 0.5), ascii_art(tone * fg, fg)


def ascii_art(tone, fg, cols=84, ramp=' .:-=+*#%@'):
    """Character portrait: JetBrains Mono cells are ~0.6 wide per 1.0 tall."""
    rows = round(cols * fg.shape[0] / fg.shape[1] * 0.6)
    tn = np.clip(tone / max(np.percentile(tone[fg], 99), 1e-3), 0, 1) ** 0.7
    t = np.asarray(Image.fromarray((tn * 255).astype(np.uint8)).resize((cols, rows), Image.BOX)) / 255
    m = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).resize((cols, rows), Image.BOX)) > 110
    lines = []
    for y in range(rows):
        lines.append(''.join(ramp[1 + int(round(t[y, x] * (len(ramp) - 2)))] if m[y, x] else ' ' for x in range(cols)).rstrip())
    return chr(10).join(lines)


def preview(d, path, n=14000, seed=1):
    rng = np.random.default_rng(seed)
    p = d.astype(np.float64).ravel(); p /= p.sum()
    idx = rng.choice(p.size, n, p=p)
    xs = (idx % GW + rng.random(n)) * 4; ys = (idx // GW + rng.random(n)) * 4
    img = Image.new('L', (GW * 4, GH * 4), 0)
    px = img.load()
    for x, y in zip(xs.astype(int), ys.astype(int)):
        for dx in (0, 1):
            for dy in (0, 1):
                px[x + dx if x + dx < GW * 4 else x, y + dy if y + dy < GH * 4 else y] = min(255, px[x, y] + 90)
    img.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('photo')
    ap.add_argument('--preview')
    args = ap.parse_args()
    d, l, head, art = build(args.photo)
    out = os.path.join(ROOT, 'assets', 'js', 'portrait-data.js')
    payload = {'w': GW, 'h': GH, 'head': head,
               'd': base64.b64encode(d.tobytes()).decode(), 'l': base64.b64encode(l.tobytes()).decode(),
               'a': art}
    with open(out, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('/* Generated by tools/make_portrait.py: particle density map for the hero portrait. */\n')
        fh.write('window.__PORTRAIT=' + json.dumps(payload, separators=(',', ':')) + ';\n')
    print(f'wrote {out} ({os.path.getsize(out) // 1024} KB) head={head}')
    if args.preview:
        preview(d, args.preview)
        print('preview:', args.preview)


if __name__ == '__main__':
    main()
