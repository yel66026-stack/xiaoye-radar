"""Render the existing Daylight layers brand mark as a multi-size Windows icon."""
from pathlib import Path
from PIL import Image, ImageDraw

scale = 4
image = Image.new('RGBA', (256*scale,256*scale), (0,0,0,0))
draw = ImageDraw.Draw(image)
def box(points):
    return tuple(int(value*scale) for value in points)
draw.rounded_rectangle(box((12,12,244,244)), radius=58*scale, fill='#5b81de')
for points in [[(64,96),(128,64),(192,96),(128,128),(64,96)],[(64,133),(128,165),(192,133)],[(64,170),(128,202),(192,170)]]:
    draw.line([box(point) for point in points],fill='white',width=9*scale,joint='curve')
    for x,y in (points[0],points[-1]):
        draw.ellipse(box((x-4,y-4,x+4,y+4)),fill='white')
target=Path(__file__).parent/'ui'/'app.ico'
image.resize((256,256),Image.Resampling.LANCZOS).save(target,format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(target)
public=Path(__file__).parent.parent/'web'/'public'/'app.ico'
public.write_bytes(target.read_bytes())
