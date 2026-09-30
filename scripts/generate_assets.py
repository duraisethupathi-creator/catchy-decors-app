"""Generate Catchy Decors app assets: icon, adaptive icon, splash screens."""
from PIL import Image, ImageDraw, ImageFont
import os

NAVY = (16, 29, 74)
GOLD = (255, 193, 7)
ORANGE = (255, 122, 0)
RED = (237, 28, 36)
WHITE = (255, 255, 255)

OUT = '/home/user/catchy-decors/assets/images'
os.makedirs(OUT, exist_ok=True)

# Find a bold font
FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]

def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def draw_logo(canvas_size, with_text=False, text_lines=None):
    """CD monogram on navy, with gold/orange gradient accent bar."""
    img = Image.new('RGB', (canvas_size, canvas_size), NAVY)
    d = ImageDraw.Draw(img)
    s = canvas_size

    # Gradient accent bar at bottom third
    bar_y = int(s * 0.78)
    bar_h = max(4, int(s * 0.045))
    for x in range(s):
        t = x / s
        if t < 0.5:
            ratio = t / 0.5
            col = tuple(int(RED[i] + (ORANGE[i] - RED[i]) * ratio) for i in range(3))
        else:
            ratio = (t - 0.5) / 0.5
            col = tuple(int(ORANGE[i] + (GOLD[i] - ORANGE[i]) * ratio) for i in range(3))
        d.line([(x, bar_y), (x, bar_y + bar_h)], fill=col)

    # CD monogram
    f = load_font(int(s * 0.34))
    text = 'CD'
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((s - tw) / 2 - bbox[0], (s - th) / 2 - bbox[1] - s * 0.04), text, font=f, fill=GOLD)

    if with_text and text_lines:
        f_small = load_font(int(s * 0.055))
        y = int(s * 0.82)
        for line in text_lines:
            bbox = d.textbbox((0, 0), line, font=f_small)
            tw = bbox[2] - bbox[0]
            color = WHITE if line.isupper() and 'CATCHY' in line else ORANGE
            d.text(((s - tw) / 2, y), line, font=f_small, fill=color)
            y += int(s * 0.07)
    return img

# 1. App icon 1024x1024
icon = draw_logo(1024)
icon.save(f'{OUT}/icon.png')

# 2. Adaptive icon foreground 1024 (with safe-zone padding: logo smaller, transparent bg)
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
logo_core = draw_logo(560)
mask = Image.new('L', (560, 560), 255)
fg.paste(logo_core, ((1024 - 560) // 2, (1024 - 560) // 2), mask)
fg.save(f'{OUT}/adaptive-icon.png')

# 3. Adaptive icon background (navy solid)
Image.new('RGB', (1024, 1024), NAVY).save(f'{OUT}/adaptive-icon-bg.png')

# 4. Splash screen 1284x2778 (Portrait, navy with centered brand)
W, H = 1284, 2778
splash = Image.new('RGB', (W, H), NAVY)
d = ImageDraw.Draw(splash)
# Logo block
logo = draw_logo(560)
splash.paste(logo, ((W - 560) // 2, int(H * 0.28)))
# Company name
f_name = load_font(120)
f_tag = load_font(44)
name = 'CATCHY DECORS'
bbox = d.textbbox((0, 0), name, font=f_name)
d.text(((W - bbox[2] + bbox[0]) / 2, int(H * 0.52)), name, font=f_name, fill=WHITE)
tag = 'TRANSFORM YOUR SPACE BEAUTIFULLY'
bbox = d.textbbox((0, 0), tag, font=f_tag)
d.text(((W - bbox[2] + bbox[0]) / 2, int(H * 0.52) + 160), tag, font=f_tag, fill=GOLD)
# Gradient accent
for x in range(W):
    t = x / W
    if t < 0.5:
        r = t / 0.5
        col = tuple(int(RED[i] + (ORANGE[i] - RED[i]) * r) for i in range(3))
    else:
        r = (t - 0.5) / 0.5
        col = tuple(int(ORANGE[i] + (GOLD[i] - ORANGE[i]) * r) for i in range(3))
    d.line([(x, int(H * 0.62)), (x, int(H * 0.62) + 10)], fill=col)
splash.save(f'{OUT}/splash.png')

# 5. splash-logo for expo-splash-screen plugin (contained logo)
draw_logo(1024, with_text=True, text_lines=['CATCHY DECORS', 'TRANSFORM YOUR SPACE BEAUTIFULLY']).save(f'{OUT}/splash-logo.png')

# 6. Favicon 48
draw_logo(48).save(f'{OUT}/favicon.png')

print('Assets generated:')
for f in sorted(os.listdir(OUT)):
    print(' -', f, os.path.getsize(f'{OUT}/{f}'), 'bytes')
