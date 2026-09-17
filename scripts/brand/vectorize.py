# Trace the transparent mark to SVG with vtracer (colour, stacked layers).
#   python scripts/brand/vectorize.py
import vtracer, os
os.makedirs('brand-kit/logo', exist_ok=True)
vtracer.convert_image_to_svg_py(
    'assets-src/logo/mark.png', 'brand-kit/logo/mark.svg',
    colormode='color', hierarchical='stacked', mode='spline',
    filter_speckle=8, color_precision=6, layer_difference=24,
    corner_threshold=60, length_threshold=4.0, max_iterations=10,
    splice_threshold=45, path_precision=2)
print('svg', os.path.getsize('brand-kit/logo/mark.svg') // 1024, 'KB')
