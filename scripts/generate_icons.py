"""Generate PWA icons for ScanFi."""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors from styles.css
PRIMARY = "#0a3d62"
ACCENT = "#38ada9"
WHITE = "#ffffff"

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_icon(size, output_path):
    """Create a ScanFi icon at the specified size."""
    img = Image.new('RGBA', (size, size), hex_to_rgb(PRIMARY))
    draw = ImageDraw.Draw(img)

    # Draw a rounded rectangle background
    margin = size // 10
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 5,
        fill=hex_to_rgb(PRIMARY)
    )

    # Draw accent circle (representing scan)
    center = size // 2
    circle_radius = size // 3
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        outline=hex_to_rgb(ACCENT),
        width=size // 20
    )

    # Draw inner scan lines
    line_width = size // 25
    gap = size // 8

    # Horizontal scan line
    draw.rectangle(
        [center - circle_radius + gap, center - line_width // 2,
         center + circle_radius - gap, center + line_width // 2],
        fill=hex_to_rgb(ACCENT)
    )

    # Draw "S" letter
    try:
        # Try to use a system font
        font_size = size // 3
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # Draw the S with a slight offset for depth
    text = "S"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2 - size // 20

    draw.text((text_x, text_y), text, fill=hex_to_rgb(WHITE), font=font)

    # Save
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")

def create_favicon(output_path):
    """Create a simple favicon."""
    size = 32
    img = Image.new('RGBA', (size, size), hex_to_rgb(PRIMARY))
    draw = ImageDraw.Draw(img)

    # Simple S in the center
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()

    draw.text((8, 2), "S", fill=hex_to_rgb(WHITE), font=font)
    img.save(output_path, 'ICO')
    print(f"Created: {output_path}")

if __name__ == "__main__":
    icons_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    # Remove placeholder files
    for f in os.listdir(icons_dir):
        if f.endswith('.txt'):
            os.remove(os.path.join(icons_dir, f))

    # Generate icons
    create_icon(192, os.path.join(icons_dir, "icon-192.png"))
    create_icon(512, os.path.join(icons_dir, "icon-512.png"))

    # Generate favicon
    favicon_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "favicon.ico")
    create_favicon(favicon_path)

    print("\nAll icons generated successfully!")
