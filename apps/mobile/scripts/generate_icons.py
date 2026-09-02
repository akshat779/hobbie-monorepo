import zlib
import struct
import math
import os

def create_png(width, height, draw_func, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])

    def chunk(tag, data):
        return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw_data), 9))
    png += chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename}")

# Minimalist Nocturnal Pulse Icon Drawing Logic
def draw_app_icon(x, y, w, h):
    # Background: #0D0B14
    bg_r, bg_g, bg_b = 0x0D, 0x0B, 0x14
    
    # Normalized coords from center [-1, 1]
    cx, cy = w / 2.0, h / 2.0
    nx = (x - cx) / (w / 2.0)
    ny = (y - cy) / (h / 2.0)
    dist = math.sqrt(nx * nx + ny * ny)

    # Subtle circular container background
    card_dist = max(abs(nx), abs(ny)) # Rounded box
    
    # Outer pulse ring (Radius 0.65 to 0.72)
    if 0.64 <= dist <= 0.70:
        alpha = 0.4 * (1.0 - abs(dist - 0.67) / 0.03)
        return (0xC7, 0x7D, 0xFF, int(255 * alpha))
    
    # Inner pulse ring (Radius 0.42 to 0.47)
    if 0.42 <= dist <= 0.47:
        alpha = 0.7 * (1.0 - abs(dist - 0.445) / 0.025)
        return (0x7B, 0x2F, 0xF7, int(255 * alpha))

    # Center diamond/spark
    d_x = abs(nx)
    d_y = abs(ny)
    diamond = d_x + d_y
    if diamond <= 0.28:
        # Gradient from Signal Violet to Pulse Lilac
        t = (ny + 0.28) / 0.56
        r = int(0x7B + (0xC7 - 0x7B) * (1 - t))
        g = int(0x2F + (0x7D - 0x2F) * (1 - t))
        b = int(0xF7 + (0xFF - 0xF7) * (1 - t))
        return (r, g, b, 255)
    
    # Central dot
    if dist <= 0.08:
        return (0xF5, 0xF0, 0xFF, 255)

    return (bg_r, bg_g, bg_b, 255)

def draw_transparent_icon(x, y, w, h):
    cx, cy = w / 2.0, h / 2.0
    nx = (x - cx) / (w / 2.0)
    ny = (y - cy) / (h / 2.0)
    dist = math.sqrt(nx * nx + ny * ny)

    if 0.64 <= dist <= 0.70:
        alpha = 0.5 * (1.0 - abs(dist - 0.67) / 0.03)
        return (0xC7, 0x7D, 0xFF, int(255 * alpha))
    
    if 0.42 <= dist <= 0.47:
        alpha = 0.8 * (1.0 - abs(dist - 0.445) / 0.025)
        return (0x7B, 0x2F, 0xF7, int(255 * alpha))

    diamond = abs(nx) + abs(ny)
    if diamond <= 0.28:
        t = (ny + 0.28) / 0.56
        r = int(0x7B + (0xC7 - 0x7B) * (1 - t))
        g = int(0x2F + (0x7D - 0x2F) * (1 - t))
        b = int(0xF7 + (0xFF - 0xF7) * (1 - t))
        return (r, g, b, 255)
    
    if dist <= 0.08:
        return (0xF5, 0xF0, 0xFF, 255)

    return (0, 0, 0, 0)

target_dir = "/Users/akshatsharma/Vscode/hobbie/apps/mobile/assets"
create_png(512, 512, draw_app_icon, f"{target_dir}/icon.png")
create_png(512, 512, draw_transparent_icon, f"{target_dir}/adaptive-icon.png")
create_png(512, 512, draw_transparent_icon, f"{target_dir}/splash-icon.png")
create_png(48, 48, draw_app_icon, f"{target_dir}/favicon.png")
