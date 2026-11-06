"""Makes the drawings in drawn/ ready in flat/ (python3 -I art/sprites/succubus/prep.py, from the repo root).

death: drawn level, her lowest edge is a long flat run under the middle of her, facing straight down, where the
silhouette's ink is thickest, and it reached under the floor. Tipped a few degrees, her head end is lowest and
faces the light, so the ink there is thin.
"""
from PIL import Image

src = Image.open('art/sprites/succubus/drawn/death.png').convert('RGB')
src.rotate(4, resample=Image.BICUBIC, fillcolor=(255, 255, 255)).save('art/sprites/succubus/flat/death.png')
