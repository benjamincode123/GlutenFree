"""Generate Expo icon / splash / adaptive assets from AltUten logo source."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SRC = Path(
    r"C:\Users\benja\.cursor\projects\c-Users-benja-Documents\assets"
    r"\c__Users_benja_AppData_Roaming_Cursor_User_workspaceStorage_03f42d6b1de17adce6d27ac6a0708824"
    r"_images_AltUten_logo_zoom_2x-da866e15-c9df-4087-8150-4aee3aa786d6.png"
)


def fit_on_canvas(
    src: Image.Image,
    size: int,
    *,
    scale: float = 1.0,
    background: tuple[int, int, int, int] = (0, 0, 0, 255),
) -> Image.Image:
    """Place logo centered on a square canvas. scale=1 fills canvas."""
    logo = src.convert("RGBA")
    # Trim near-black margins so zoomed mark fills better if needed
    canvas = Image.new("RGBA", (size, size), background)
    target = max(1, int(size * scale))
    fitted = logo.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def to_monochrome_transparent(src: Image.Image, size: int, scale: float = 0.72) -> Image.Image:
    """White mark on transparent for Android monochrome adaptive icon."""
    rgba = fit_on_canvas(src, size, scale=scale, background=(0, 0, 0, 0))
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Keep light pixels as white; drop dark background
            lum = (r + g + b) / 3
            if lum < 40:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (255, 255, 255, a if a else 255)
    return rgba


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source logo: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    ASSETS.mkdir(parents=True, exist_ok=True)

    # Master source copy
    src.save(ASSETS / "altuten-logo.png", optimize=True)

    # iOS / general icon (full bleed black)
    icon = fit_on_canvas(src, 1024, scale=1.0)
    icon.save(ASSETS / "icon.png", optimize=True)
    icon.save(ASSETS / "adaptive-icon.png", optimize=True)
    icon.save(ASSETS / "favicon.png", optimize=True)

    # Splash: slightly inset so mark isn't edge-clipped
    splash = fit_on_canvas(src, 1024, scale=0.88)
    splash.save(ASSETS / "splash-icon.png", optimize=True)

    # Android adaptive: keep mark inside safe zone (~66–72%)
    fg = fit_on_canvas(src, 1024, scale=0.72)
    fg.save(ASSETS / "android-icon-foreground.png", optimize=True)

    bg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255))
    bg.save(ASSETS / "android-icon-background.png", optimize=True)

    mono = to_monochrome_transparent(src, 1024, scale=0.72)
    mono.save(ASSETS / "android-icon-monochrome.png", optimize=True)

    print("Wrote icons from", SRC.name)
    for name in [
        "altuten-logo.png",
        "icon.png",
        "splash-icon.png",
        "adaptive-icon.png",
        "favicon.png",
        "android-icon-foreground.png",
        "android-icon-background.png",
        "android-icon-monochrome.png",
    ]:
        p = ASSETS / name
        print(f"  {name}: {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
