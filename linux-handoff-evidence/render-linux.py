"""Render saved TTFs using an existing Pillow/FreeType installation; installs nothing."""
import argparse, hashlib, json, platform
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features, __version__ as pillow_version
ROOT=Path(__file__).resolve().parents[1]
FONTS=[('xheight500-width90','architecture/universal-design-model/family-xheight-propagation/artifacts-final/source.ttf','44aac2c744b2607037ce0445bdde7c1d9a2c1dd45e465d8e878f76c76e1f5efb'),('xheight520-width90','architecture/universal-design-model/family-xheight-propagation/artifacts-final/candidate.ttf','43310f5c97481f0c802d02f16e56ac29f5dba67c7aea3c0f9a4a5b3f9d0fdd8f'),('xheight520-width100','linux-handoff-evidence/stroke-width-artifacts/primary-width-100.ttf','0d64f58cef5d61f33d1e59abbe1e9cbd6bbeaf62dd0371a7fc9742f5a242f769')]
p=argparse.ArgumentParser();p.add_argument('--output',default='linux-render-evidence');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=False)
assert features.check_module('freetype2'), 'Pillow lacks FreeType support'
rows=['o n H a h','oo nn aa hh Hh','Hanna noon anon'];sizes=[12,16,24,32,48,96]
report={'platform':platform.platform(),'Pillow':pillow_version,'FreeType':features.version_module('freetype2'),'sizeUnit':'pixels; no point/DPI conversion','antialiasing':'8-bit grayscale, ImageDraw.fontmode=L','hinting':'Pillow/FreeType defaults; load flags not exposed by this script','layout':'Pillow BASIC; no GSUB/GPOS claim','browserEquivalent':False,'visualApproval':'pending','fonts':[],'measurements':[]}
for name,path,sha in FONTS:
 actual=hashlib.sha256((ROOT/path).read_bytes()).hexdigest();assert actual==sha,(path,actual)
 report['fonts'].append({'name':name,'path':path,'sha256':actual})
for size in sizes:
 loaded=[(name,ImageFont.truetype(str(ROOT/path),size,layout_engine=ImageFont.Layout.BASIC)) for name,path,_ in FONTS]
 width=max(900,int(max(font.getlength(text) for _,font in loaded for text in rows))+80);line=size+20;panel=30+len(rows)*line
 image=Image.new('RGB',(width,panel*len(loaded)), 'white');draw=ImageDraw.Draw(image);draw.fontmode='L'
 for index,(name,font) in enumerate(loaded):
  draw.text((10,index*panel+3),name+' / '+str(size)+' px',fill='black')
  for row,text in enumerate(rows):
   baseline=index*panel+30+(row+1)*line-10
   draw.line((5,baseline,width-5,baseline),fill=(220,220,220))
   draw.text((20,baseline),text,font=font,anchor='ls',fill='black')
   report['measurements'].append({'font':name,'sizePx':size,'text':text,'advancePx':font.getlength(text),'bboxRelativeToBaseline':font.getbbox(text,anchor='ls')})
  for glyph in 'onHah':
   small=Image.new('RGB',(size+40,size*2+40),'white');d=ImageDraw.Draw(small);d.fontmode='L';d.text((20,size+20),glyph,font=font,anchor='ls',fill='black');small.save(out/(name+'-'+glyph+'-'+str(size)+'.png'))
 image.save(out/('comparison-'+str(size)+'.png'))
report['artifacts']=[{'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size} for f in sorted(out.glob('*.png'))]
(out/'results.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><h1>FreeType specimens; visual approval pending</h1>'+''.join('<h2>'+str(s)+' px</h2><img style="max-width:100%" src="comparison-'+str(s)+'.png">' for s in sizes))
print('Rendered',len(report['artifacts']),'PNGs; visual inspection remains required')
