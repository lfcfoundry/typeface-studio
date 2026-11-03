"""Local-only evidence collector. Never replaces evidence files."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json,base64
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent/'browser-evidence'
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def do_POST(self):
  if self.path!='/family-xheight-evidence':self.send_error(404);return
  payload=self.rfile.read(int(self.headers['Content-Length']));data=json.loads(payload)
  OUT.mkdir(exist_ok=True)
  with (OUT/'results.json').open('xb') as f:f.write(payload)
  if data.get('canvasPng'):
   with (OUT/'canvas.png').open('xb') as f:f.write(base64.b64decode(data['canvasPng'].split(',')[1]))
  self.send_response(204);self.end_headers()
ThreadingHTTPServer(('127.0.0.1',8793),Handler).serve_forever()
