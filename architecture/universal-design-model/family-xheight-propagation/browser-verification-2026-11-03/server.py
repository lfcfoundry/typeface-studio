from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, base64, hashlib
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(ROOT),**k)
    def log_message(self,fmt,*args):
        with (OUT/'http-access.log').open('a') as f:f.write(fmt%args+'\n')
    def do_POST(self):
        if self.path!='/collect': self.send_error(404); return
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        png=data.pop('canvas',None)
        for name,payload in [('browser-results.json',json.dumps(data,indent=2)+'\n')]:
            with (OUT/name).open('x') as f:f.write(payload)
        if png:
            raw=base64.b64decode(png.split(',',1)[1])
            with (OUT/'canvas-specimen.png').open('xb') as f:f.write(raw)
            data['canvasEvidence']={'filename':'canvas-specimen.png','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
            with (OUT/'browser-results.json').open('w') as f:json.dump(data,f,indent=2)
        self.send_response(204);self.end_headers()
ThreadingHTTPServer(('0.0.0.0',8795),Handler).serve_forever()
