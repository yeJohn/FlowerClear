from collections import deque
from pathlib import Path
from PIL import Image


def clean(path: Path) -> tuple[str, int]:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx] or pixels[x, y] <= 12:
                continue
            visited[idx] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    for ny in range(max(0, cy - 1), min(height, cy + 2)):
                        nidx = ny * width + nx
                        if not visited[nidx] and pixels[nx, ny] > 12:
                            visited[nidx] = 1
                            queue.append((nx, ny))
            components.append(component)
    if len(components) <= 1:
        return path.name, 0
    components.sort(key=len, reverse=True)
    keep = set(components[0])
    removed = 0
    rgba = image.load()
    for component in components[1:]:
        for x, y in component:
            rgba[x, y] = (0, 0, 0, 0)
            removed += 1
    if removed:
        image.save(path)
    return path.name, removed


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "assets" / "resources" / "art" / "flowers"
    for item in sorted(root.glob("*.png")):
        name, removed = clean(item)
        print(f"{name}: removed {removed} stray pixels")
