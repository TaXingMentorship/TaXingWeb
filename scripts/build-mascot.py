"""Build the feedback-mascot layers from the source illustration.

Removes the "2025 SUMMER" print from the lantern and splits the art into a
body layer and a lantern layer so the two can be animated independently.

Usage: python3 scripts/build-mascot.py <source.webp|png> [out_dir]
Needs: pillow numpy opencv-python-headless scipy
"""
import sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "public/images/mascot"
rgba = np.array(Image.open(src).convert("RGBA"))
h, w = rgba.shape[:2]
rgb, alpha = rgba[..., :3].copy(), rgba[..., 3]

# 1. Remove the lantern text: dark orange pixels inside the globe, inpainted.
yy, xx = np.mgrid[0:h, 0:w]
globe = ((xx - 258) / 158.0) ** 2 + ((yy - 702) / 142.0) ** 2 < 1.0
text = globe & (rgb[..., 2] < 90) & (rgb[..., 1] < 215) & (alpha > 0)
text = ndimage.binary_dilation(text, iterations=3) & globe
rgb = cv2.inpaint(rgb, text.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)

# 2. Lantern mask: globe + caps + handle.
def box(x0, x1, y0, y1):
    return (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)

lantern = (
    (((xx - 258) / 162.0) ** 2 + ((yy - 708) / 150.0) ** 2 < 1.0)
    | box(192, 325, 532, 582)  # top cap
    | box(190, 325, 836, 882)  # bottom cap
    | box(208, 308, 452, 540)  # handle
)
lantern |= box(255, 312, 462, 545) & (xx < 312)  # finger gripping the handle
# grow on the outer side only, so the outline fringe leaves with the lantern
lantern |= ndimage.binary_dilation(lantern, iterations=4) & (xx < 380) & ~box(300, 400, 480, 560)
lantern &= alpha > 0

full = np.dstack([rgb, alpha])

lan = full.copy()
lan[..., 3] = np.where(lantern, alpha, 0)

body = full.copy()
body[..., 3] = np.where(lantern, 0, alpha)
# Fill the part of the body hidden behind the lantern so a swing does not
# reveal a hole: nearest body pixel colour, only where the belly sits.
hole = lantern & (xx > 372) & (xx < 440)
_, (iy, ix) = ndimage.distance_transform_edt(
    body[..., 3] == 0, return_indices=True
)
near = body[iy, ix]
fill = hole & (np.hypot(iy - yy, ix - xx) < 14) & (ix > 400)
body[fill] = near[fill]
body[fill, 3] = 255

# drop stray specks left on either layer
for layer in (body, lan):
    lab, n = ndimage.label(layer[..., 3] > 0)
    sizes = ndimage.sum(layer[..., 3] > 0, lab, range(1, n + 1))
    for i, sz in enumerate(sizes, 1):
        if sz < 600:
            layer[lab == i, 3] = 0

# 3. Crop both layers to the same box so they register by simple stacking.
ys, xs = np.where(full[..., 3] > 0)
pad = 8
box_ = (xs.min() - pad, ys.min() - pad, xs.max() + pad + 1, ys.max() + pad + 1)
import os
os.makedirs(out, exist_ok=True)
for name, arr in (("body", body), ("lantern", lan)):
    im = Image.fromarray(arr.astype(np.uint8)).crop(box_)
    im.save(f"{out}/{name}.webp", quality=92, method=6)
    print(name, im.size)
Image.fromarray(full.astype(np.uint8)).crop(box_).save(f"{out}/preview.png")
print("crop box", box_, "lantern bbox in crop:",
      np.where(lantern)[1].min() - box_[0], np.where(lantern)[0].min() - box_[1],
      np.where(lantern)[1].max() - box_[0], np.where(lantern)[0].max() - box_[1])
