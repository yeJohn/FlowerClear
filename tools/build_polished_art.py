from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "assets" / "resources" / "art" / "ui"
VASES = ROOT / "assets" / "resources" / "art" / "vases"
TMP = ROOT / "tmp" / "imagegen"


def trim_fit(source: Path, target: Path, size: tuple[int, int], padding: int = 8) -> None:
    image = Image.open(source).convert("RGBA")
    box = image.getchannel("A").getbbox()
    if not box:
        raise RuntimeError(f"empty image: {source}")
    subject = image.crop(box)
    limit = (size[0] - padding * 2, size[1] - padding * 2)
    subject.thumbnail(limit, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", size)
    output.alpha_composite(subject, ((size[0] - subject.width) // 2, (size[1] - subject.height) // 2))
    output.save(target)


def build_vase_occluders() -> None:
    palette = ["#efe5d3", "#c5d7ec", "#f0c5c5", "#cfd8b5", "#ebcb75", "#d3d2d0"]
    for index, color in enumerate(palette, 1):
        front = Image.open(VASES / f"modern_vase_front_{index}.png").convert("RGBA")
        alpha = front.getchannel("A").point(lambda value: 255 if value > 28 else value)
        mask = Image.new("RGBA", front.size, color)
        mask.putalpha(alpha)
        mask.save(VASES / f"vase_opaque_{index}.png")


def build_buttons() -> None:
    labels = {
        "button_start": "开始整理",
        "button_video_unlock": "观看视频解锁",
        "button_collect_stars": "继续收集星星",
        "button_continue": "继续整理",
        "button_level_select": "返回选关",
        "button_restart": "重新挑战",
        "button_shuffle": "打乱花朵继续",
        "button_next": "下一关",
        "button_revive": "复活并加 30 秒",
        "button_collection": "返回藏品",
        "button_replay": "重新开始",
    }
    video_keys = {"button_video_unlock", "button_shuffle", "button_revive"}
    base = Image.open(UI / "button_primary.png").convert("RGBA").resize((800, 160), Image.Resampling.LANCZOS)
    video = Image.open(UI / "lock_video.png").convert("RGBA")
    video.thumbnail((70, 70), Image.Resampling.LANCZOS)
    font_path = Path("C:/Windows/Fonts/msyhbd.ttc")
    if not font_path.exists():
        font_path = Path("C:/Windows/Fonts/msyh.ttc")
    font = ImageFont.truetype(str(font_path), 56)
    for key, label in labels.items():
        output = base.copy()
        draw = ImageDraw.Draw(output)
        box = draw.textbbox((0, 0), label, font=font)
        width, height = box[2] - box[0], box[3] - box[1]
        x = (output.width - width) // 2 + (34 if key == "button_revive" else -25 if key in video_keys else 0)
        y = (output.height - height) // 2 - box[1] - 2
        draw.text((x, y), label, font=font, fill="#385148", stroke_width=1, stroke_fill="#fffaf0")
        if key == "button_revive":
            output.alpha_composite(video, (42, (output.height - video.height) // 2))
        elif key in video_keys:
            output.alpha_composite(video, (output.width - video.width - 34, 14))
        output.save(UI / f"{key}.png")


if __name__ == "__main__":
    trim_fit(TMP / "prop_skip_v2.png", UI / "prop_skip.png", (320, 320), 14)
    trim_fit(TMP / "lock_count_v2.png", UI / "lock_count.png", (280, 360), 12)
    time_icon = Image.open(UI / "prop_time.png").convert("RGBA")
    time_icon.paste((0, 0, 0, 0), (0, 0, 135, time_icon.height))
    cleaned_time = TMP / "prop_time_clean.png"
    time_icon.save(cleaned_time)
    trim_fit(cleaned_time, UI / "prop_time.png", (384, 384), 14)
    build_vase_occluders()
    build_buttons()
    print("polished art assets generated")
