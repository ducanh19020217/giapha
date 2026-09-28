"""Sinh hình nền Long Phượng (kiểu tranh cắt giấy) cho cây gia phả.

Chạy: python3 scripts/gen_bg_long_phuong.py  -> ghi đè public/bg-long-phuong.svg
"""
import math
import os

C = "#B87333"      # đồng
BG = "#FBF7F0"     # nền kem (dùng để "cắt" chi tiết)
out = []


def f(v):
    return f"{v:.1f}"


def catmull(points, samples=12, closed=False):
    pts = list(points)
    n = len(pts)
    res = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            res.append((x, y))
    if not closed:
        res.append(pts[-1])
    return res


def resample(pts, n):
    d = [0.0]
    for a, b in zip(pts, pts[1:]):
        d.append(d[-1] + math.dist(a, b))
    total = d[-1]
    res, j = [], 0
    for i in range(n):
        target = total * i / (n - 1)
        while j < len(d) - 2 and d[j + 1] < target:
            j += 1
        seg = d[j + 1] - d[j] or 1
        t = (target - d[j]) / seg
        a, b = pts[j], pts[j + 1]
        res.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return res


def frames(pts):
    """Tiếp tuyến & pháp tuyến tại mỗi điểm."""
    res = []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        tx, ty = dx / l, dy / l
        res.append(((tx, ty), (-ty, tx)))
    return res


def poly(pts, fill=C, extra=""):
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts) + "Z"
    out.append(f'<path d="{d}" fill="{fill}" {extra}/>')


def line(pts, color=BG, width=2, extra=""):
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts)
    out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')


def ribbon(spine, wfunc, n=60, fill=C):
    """Dải thuôn theo đường cong: wfunc(t) = nửa bề rộng tại t."""
    pts = resample(catmull(spine), n)
    fr = frames(pts)
    left, right = [], []
    for i, (p, (_, nrm)) in enumerate(zip(pts, fr)):
        w = wfunc(i / (n - 1))
        left.append((p[0] + nrm[0] * w, p[1] + nrm[1] * w))
        right.append((p[0] - nrm[0] * w, p[1] - nrm[1] * w))
    poly(left + right[::-1], fill)
    return pts, fr


def taper(a=1.0, b=0.0):
    return lambda t: a + (b - a) * t


def leaf(max_w, start=0.15, end=0.0):
    return lambda t: max_w * (math.sin(math.pi * min(t * 1.15, 1)) * (1 - t * 0.3)) + start * (1 - t) * max_w + end


def transform(pts, ox, oy, ang, s=1.0, mirror=False):
    ca, sa = math.cos(ang), math.sin(ang)
    res = []
    for x, y in pts:
        if mirror:
            x = -x
        x, y = x * s, y * s
        res.append((ox + x * ca - y * sa, oy + x * sa + y * ca))
    return res


# ======================================================================
# MÂY TƯỜNG VÂN (tô đặc, cắt xoắn)
# ======================================================================
def cloud(cx, cy, s):
    blob = [(-70, 10), (-60, -12), (-35, -18), (-22, -38), (5, -44), (28, -30), (45, -36), (68, -20), (72, 5), (40, 14), (0, 12)]
    poly(transform(catmull(blob, 10, closed=True), cx, cy, 0, s))
    for (sx, sy, r) in [(-35, -8, 12), (8, -22, 14), (45, -10, 11)]:
        spiral = []
        for k in range(40):
            a = k / 40 * 4.2
            rr = r * (1 - k / 46)
            spiral.append((sx + rr * math.cos(a + 2), sy + rr * math.sin(a + 2)))
        line(transform(spiral, cx, cy, 0, s), BG, 2.2 * s)
    # dải mây mỏng bên dưới
    band = [(-95, 20), (-40, 24), (20, 22), (95, 16)]
    ribbon(transform(band, cx, cy, 0, s), lambda t: s * 4.5 * math.sin(math.pi * t) + 0.5, 30)


for (x, y, s) in [(150, 110, 1.1), (760, 90, 0.8), (1420, 110, 1.0), (700, 600, 1.2), (930, 820, 0.9),
                  (90, 540, 0.75), (1500, 560, 0.8), (520, 900, 0.85), (1250, 930, 0.75), (1000, 160, 0.6)]:
    cloud(x, y, s)

# ======================================================================
# RỒNG
# ======================================================================
spine_pts = [(575, 330), (500, 290), (410, 300), (350, 370), (360, 470), (430, 540), (455, 630),
             (410, 720), (310, 760), (215, 720), (175, 630), (205, 560), (265, 545)]
N = 160
body = resample(catmull(spine_pts, 16), N)
fr = frames(body)


def body_w(t):
    if t < 0.08:
        return 22 + t / 0.08 * 10
    if t < 0.35:
        return 32
    return 32 - (t - 0.35) / 0.65 * 29


left, right = [], []
for i, (p, (_, nrm)) in enumerate(zip(body, fr)):
    w = body_w(i / (N - 1))
    left.append((p[0] + nrm[0] * w, p[1] + nrm[1] * w))
    right.append((p[0] - nrm[0] * w, p[1] - nrm[1] * w))

# Vây lưng (phía "left"), vuốt ngược về đuôi
for i in range(6, N - 12, 5):
    t = i / (N - 1)
    w = body_w(t)
    (tx, ty), (nx, ny) = fr[i]
    a = left[i]
    b = left[i + 4]
    tip = (a[0] + nx * w * 0.75 + tx * w * 0.9, a[1] + ny * w * 0.75 + ty * w * 0.9)
    poly([a, tip, b])

# Chân + vuốt (phía bụng "right")
def leg(i, bend=1):
    t = i / (N - 1)
    w = body_w(t)
    (tx, ty), (nx, ny) = fr[i]
    base = right[i]
    ang = math.atan2(-ny, -nx)
    upper = [(0, 0), (30, 6 * bend), (55, 20 * bend)]
    fore = [(55, 20 * bend), (70, -5 * bend), (90, -15 * bend)]
    ribbon(transform(upper, base[0], base[1], ang), taper(w * 0.55, w * 0.38), 20)
    ribbon(transform(fore, base[0], base[1], ang), taper(w * 0.38, w * 0.28), 20)
    # lửa khuỷu tay
    for k in range(3):
        fl = [(55, 20 * bend), (45 - k * 8, 34 * bend + k * 4), (28 - k * 10, 40 * bend + k * 6)]
        ribbon(transform(fl, base[0], base[1], ang), taper(4, 0.3), 16)
    # 4 móng
    foot = transform([(90, -15 * bend)], base[0], base[1], ang)[0]
    for k, da in enumerate([-0.9, -0.3, 0.3, 0.9]):
        a2 = ang + da * 0.8
        claw = [(0, 0), (20, 0), (31, 9 * bend), (30, 19 * bend)]
        ribbon(transform(claw, foot[0], foot[1], a2), taper(4.8, 0.4), 14)


for i, b in [(28, 1), (58, -1), (100, 1), (128, -1)]:
    leg(i, b)

# Thân
poly(left + right[::-1])

# Vảy: các cung "cắt" màu nền, so le
for i in range(3, N - 8, 3):
    t = i / (N - 1)
    w = body_w(t)
    (tx, ty), (nx, ny) = fr[i]
    r = max(w * 0.22, 2.2)
    rows = [-0.55, 0, 0.55] if (i // 3) % 2 == 0 else [-0.28, 0.28]
    for j in rows:
        cx, cy = body[i][0] + nx * w * j, body[i][1] + ny * w * j
        arc = []
        for k in range(9):
            a = -math.pi / 2 + math.pi * k / 8
            ox, oy = math.cos(a) * r, math.sin(a) * r
            arc.append((cx + tx * ox + nx * oy, cy + ty * ox + ny * oy))
        line(arc, BG, max(1.1, w * 0.07))
# đường sống lưng / bụng
line([(p[0] + n[0] * body_w(i / (N - 1)) * 0.82, p[1] + n[1] * body_w(i / (N - 1)) * 0.82) for i, (p, (_, n)) in enumerate(zip(body, fr))][2:-6], BG, 1.4)
line([(p[0] - n[0] * body_w(i / (N - 1)) * 0.82, p[1] - n[1] * body_w(i / (N - 1)) * 0.82) for i, (p, (_, n)) in enumerate(zip(body, fr))][2:-6], BG, 1.4)

# Đuôi lửa
end = body[-1]
(tx, ty), (nx, ny) = fr[-1]
ang_tail = math.atan2(ty, tx)
for k, da in enumerate([-0.9, -0.45, 0, 0.45, 0.9]):
    fl = [(-6, 0), (30, da * 26), (62, da * 50 + 8), (78, da * 56 - 10)]
    ribbon(transform(fl, end[0], end[1], ang_tail), taper(9 - abs(da) * 3, 0.4), 24)

# Đầu rồng (hướng ngược tiếp tuyến tại cổ)
(tx, ty), _ = fr[0]
hang = math.atan2(-ty, -tx) - 0.15
hx, hy = body[0][0] - tx * 5, body[0][1] - ty * 5
S = 1.05
H = lambda pts: transform(pts, hx, hy, hang, S)

# bờm lửa phía sau đầu
for k in range(7):
    a = -1.2 + k * 0.4
    base = (5, -14 + k * 5)
    m = [base, (base[0] - 30, base[1] + math.sin(a) * 30 - 8), (base[0] - 55, base[1] + math.sin(a) * 42 - 22), (base[0] - 50, base[1] + math.sin(a) * 42 - 36)]
    ribbon(H(m), taper(9, 0.4), 20)
# sừng
for dy, ln in [(0, 1.0), (10, 0.85)]:
    horn = [(38, -30 + dy), (15, -60 + dy), (-15, -82 + dy * 1.2), (-45 * ln, -88 + dy * 1.4)]
    ribbon(H(horn), taper(6.5, 1.2), 30)
    br = [(8, -66 + dy), (-2, -92 + dy), (10, -108 + dy)]
    ribbon(H(br), taper(4, 0.6), 16)
head = [(0, -24), (22, -34), (40, -38), (58, -33), (80, -27), (100, -26), (116, -30), (128, -20), (130, -6),
        (100, -2), (76, 4), (108, 12), (118, 20), (104, 30), (70, 32), (40, 30), (10, 28), (-4, 10)]
poly(H(catmull(head, 8, closed=True)))
# chi tiết mặt (cắt màu nền)
eye = [(56 + 8 * math.cos(a / 12 * 2 * math.pi), -18 + 5.5 * math.sin(a / 12 * 2 * math.pi)) for a in range(13)]
poly(H(eye), BG)
poly(H([(56 + 3 * math.cos(a / 8 * 2 * math.pi), -18 + 3 * math.sin(a / 8 * 2 * math.pi)) for a in range(9)]), C)
line(H([(40, -27), (58, -31), (76, -24)]), BG, 2.4)                       # lông mày
line(H([(112, -22), (118, -16), (114, -11), (109, -14)]), BG, 2)          # lỗ mũi
line(H([(126, -8), (100, -4), (76, 3)]), BG, 2.2)                         # miệng
for k in range(5):                                                         # răng
    x = 82 + k * 8
    poly(H([(x, 1 - k * 0.7), (x + 3, 7 - k * 0.5), (x + 6, 0 - k * 0.7)]), BG)
line(H([(20, 8), (40, 14), (62, 16)]), BG, 1.6)
line(H([(18, -14), (30, -6), (26, 6)]), BG, 1.6)
# râu dài
wh1 = [(126, -18), (160, -30), (190, -18), (205, 8), (196, 26), (184, 18)]
wh2 = [(122, 0), (150, 20), (160, 55), (148, 80), (132, 76)]
ribbon(H(wh1), taper(3.2, 0.5), 50)
ribbon(H(wh2), taper(3.2, 0.5), 50)
# râu cằm
for k in range(4):
    b = [(60 + k * 12, 30), (54 + k * 12, 50 + k * 3), (40 + k * 12, 62 + k * 4)]
    ribbon(H(b), taper(4, 0.3), 16)

# ======================================================================
# NGỌC CHÂU
# ======================================================================
px, py = 800, 300
for k in range(10):
    a = k / 10 * 2 * math.pi
    fl = [(math.cos(a) * 30, math.sin(a) * 30), (math.cos(a + 0.2) * 48, math.sin(a + 0.2) * 48), (math.cos(a + 0.45) * 62, math.sin(a + 0.45) * 62)]
    ribbon([(px + x, py + y) for x, y in fl], taper(6, 0.3), 16)
poly([(px + 30 * math.cos(a / 30 * 2 * math.pi), py + 30 * math.sin(a / 30 * 2 * math.pi)) for a in range(31)])
sp = [(px + (22 - k * 0.45) * math.cos(k / 48 * 5.5 + 1), py + (22 - k * 0.45) * math.sin(k / 48 * 5.5 + 1)) for k in range(48)]
line(sp, BG, 2.4)

# ======================================================================
# PHƯỢNG (vẽ hướng sang phải rồi lật gương, đặt bên phải, nhìn về ngọc)
# ======================================================================
PX, PY = 1130, 400
P = lambda pts: transform(pts, PX, PY, 0, 1.0, mirror=True)

# đuôi: 3 lông chính + 4 sợi mảnh có "mắt"
plumes = [
    [(-70, 10), (-150, 80), (-190, 200), (-280, 300), (-400, 330), (-440, 300)],
    [(-70, 14), (-130, 120), (-150, 260), (-230, 390), (-330, 450), (-360, 430)],
    [(-65, 18), (-90, 150), (-60, 290), (-110, 420), (-200, 520), (-230, 505)],
]
for pl in plumes:
    pts, pfr = ribbon(P(pl), lambda t: 5 + 16 * math.sin(math.pi * min(t * 1.1, 1)) * (1 - t * 0.5), 90)
    # rachis + tơ lông (cắt)
    line(pts[4:-6], BG, 1.6)
    for i in range(8, len(pts) - 8, 3):
        (tx, ty), (nx, ny) = pfr[i]
        w = 5 + 16 * math.sin(math.pi * min(i / 89 * 1.1, 1)) * (1 - i / 89 * 0.5)
        for side in (1, -1):
            a = (pts[i][0] + nx * side * 2, pts[i][1] + ny * side * 2)
            b = (pts[i][0] + nx * side * w * 0.85 - tx * w * 0.5, pts[i][1] + ny * side * w * 0.85 - ty * w * 0.5)
            line([a, b], BG, 1.1)
streamers = [
    [(-70, 8), (-170, 40), (-260, 130), (-380, 180), (-470, 170)],
    [(-66, 20), (-110, 200), (-170, 330), (-150, 470), (-90, 540)],
    [(-72, 12), (-200, 110), (-300, 250), (-420, 280)],
    [(-60, 22), (-40, 170), (-10, 300), (20, 400)],
]
for st in streamers:
    pts, _ = ribbon(P(st), taper(3, 1.2), 60)
    ex, ey = pts[-1]
    for r, col in [(14, C), (9, BG), (5, C)]:
        poly([(ex + r * 1.3 * math.cos(a / 16 * 2 * math.pi), ey + r * math.sin(a / 16 * 2 * math.pi)) for a in range(17)], col)

# cánh sau (thấp, nhỏ)
for k in range(7):
    a = math.radians(-150 + k * 11)
    ln = 120 + 25 * math.sin(k / 6 * math.pi)
    fe = [(-10, -10), (-10 + math.cos(a) * ln * 0.5, -10 + math.sin(a) * ln * 0.5 - 8), (-10 + math.cos(a) * ln, -10 + math.sin(a) * ln)]
    ribbon(P(fe), leaf(13), 24)

# thân
bodyp = [(48, -8), (38, 22), (5, 36), (-40, 28), (-78, 10), (-50, -14), (-5, -24), (30, -24)]
poly(P(catmull(bodyp, 10, closed=True)))
for k in range(4):   # vảy lông ngực
    for j in range(3 - k // 2):
        cx, cy = 22 - k * 16 - j * 4, -6 + j * 12 + k * 3
        arc = [(cx + 6 * math.cos(a), cy + 6 * math.sin(a)) for a in [math.pi * (0.5 + i / 8) for i in range(9)]]
        line(P(arc), BG, 1.3)

# cánh trước (giơ cao) — lông cánh chính
for k in range(9):
    a = math.radians(-172 + k * 14)
    ln = 160 + 110 * math.sin(k / 8 * math.pi * 0.9)
    base = (-5, -18)
    fe = [base, (base[0] + math.cos(a) * ln * 0.5, base[1] + math.sin(a) * ln * 0.5 - 12), (base[0] + math.cos(a + 0.12) * ln, base[1] + math.sin(a + 0.12) * ln)]
    pts, _ = ribbon(P(fe), leaf(17), 30)
    line(pts[3:-4], BG, 1.2)
# lông bao cánh (hàng ngắn, viền nền để tách lớp)
for k in range(9):
    a = math.radians(-165 + k * 13)
    ln = 70 + 30 * math.sin(k / 8 * math.pi)
    base = (-5, -18)
    fe = [base, (base[0] + math.cos(a) * ln * 0.6, base[1] + math.sin(a) * ln * 0.6 - 6), (base[0] + math.cos(a) * ln, base[1] + math.sin(a) * ln)]
    pts, fr2 = ribbon(P(fe), leaf(21), 24)
    line([(p[0] + n[0] * 17 * math.sin(math.pi * i / 23), p[1] + n[1] * 12 * math.sin(math.pi * i / 23)) for i, (p, (_, n)) in enumerate(zip(pts, fr2))], BG, 1.4)

# cổ + đầu
neck = [(30, -18), (58, -50), (56, -88), (72, -118)]
ribbon(P(neck), taper(15, 8), 40)
headp = [(70, -130), (84, -136), (96, -128), (96, -114), (84, -106), (70, -110), (64, -120)]
poly(P(catmull(headp, 8, closed=True)))
poly(P([(94, -126), (122, -118), (112, -113), (95, -114)]))           # mỏ
poly(P([(84 + 3.6 * math.cos(a / 10 * 2 * math.pi), -123 + 3.6 * math.sin(a / 10 * 2 * math.pi)) for a in range(11)]), BG)
ribbon(P([(92, -110), (96, -96), (90, -86)]), taper(4, 0.5), 14)       # yếm
for k, (dx, h) in enumerate([(0, 1.0), (8, 0.85), (-8, 0.8)]):          # mào
    cr = [(78 + dx, -134), (70 + dx, -165 * h), (84 + dx, -190 * h), (100 + dx, -184 * h), (96 + dx, -172 * h)]
    ribbon(P(cr), taper(4.5, 0.8), 30)
for k in range(4):   # lông cổ rủ
    nk = [(62 - k * 3, -96 + k * 12), (44 - k * 6, -84 + k * 14), (34 - k * 6, -66 + k * 14)]
    ribbon(P(nk), taper(5, 0.3), 16)

# ======================================================================
# VIỀN GÓC HỒI VĂN
# ======================================================================
corner = [(20, 150), (20, 20), (150, 20), (150, 45), (45, 45), (45, 110), (100, 110), (100, 80), (75, 80)]
for sx, sy, ox, oy in [(1, 1, 0, 0), (-1, 1, 1600, 0), (1, -1, 0, 1000), (-1, -1, 1600, 1000)]:
    line([(ox + sx * x, oy + sy * y) for x, y in corner], C, 5)

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">\n'
    '<!-- Hình nền "Long Phượng tranh châu" kiểu tranh cắt giấy, sinh tự động bởi script; dùng làm watermark mờ phía sau cây gia phả. -->\n'
    + "\n".join(out) + "\n</svg>\n"
)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "bg-long-phuong.svg"), "w", encoding="utf-8").write(svg)
print(len(svg))
