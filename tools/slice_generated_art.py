from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def slice_atlas(source: Path, cols: int, rows: int, names: list[str], out_dir: Path, max_side: int):
    image = Image.open(source).convert('RGBA')
    cell_w, cell_h = image.width / cols, image.height / rows
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(names):
        col, row = index % cols, index // cols
        box = (round(col * cell_w), round(row * cell_h), round((col + 1) * cell_w), round((row + 1) * cell_h))
        cell = image.crop(box)
        alpha_box = cell.getchannel('A').getbbox()
        if not alpha_box:
            raise RuntimeError(f'empty atlas cell: {name}')
        cell = cell.crop(alpha_box)
        scale = min(1.0, max_side / max(cell.size))
        if scale < 1:
            cell = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
        pad = max(8, round(max(cell.size) * 0.04))
        canvas = Image.new('RGBA', (cell.width + pad * 2, cell.height + pad * 2))
        canvas.alpha_composite(cell, (pad, pad))
        canvas.save(out_dir / f'{name}.png', optimize=True)

flowers = ['rose','sunflower','tulip','daisy','cherry','hibiscus','lavender','babybreath','eucalyptus','fern','camellia','peony','iris','lily','carnation']
vases = [f'vase_{i}' for i in range(1, 7)]
slice_atlas(ROOT/'art/source/flower_atlas.png', 5, 3, flowers, ROOT/'assets/resources/art/flowers', 480)
slice_atlas(ROOT/'art/source/vase_atlas.png', 3, 2, vases, ROOT/'assets/resources/art/vases', 520)

bg = Image.open(ROOT/'assets/resources/art/backgrounds/conservatory.png').convert('RGB')
target_ratio = 750 / 1334
if bg.width / bg.height > target_ratio:
    width = round(bg.height * target_ratio); left = (bg.width - width) // 2; bg = bg.crop((left, 0, left + width, bg.height))
else:
    height = round(bg.width / target_ratio); top = (bg.height - height) // 2; bg = bg.crop((0, top, bg.width, top + height))
bg.resize((750, 1334), Image.Resampling.LANCZOS).save(ROOT/'assets/resources/art/backgrounds/conservatory.png', optimize=True)
print('Generated 15 flower sprites, 6 vase sprites, and a 750x1334 background.')
