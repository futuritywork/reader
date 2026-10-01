from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import time

PARAGRAPH = 'Reader memory investigation uses controlled content with stable expected text. Links, Unicode café 東京, paragraphs, and tables exercise extraction without loading third-party resources. '
def paragraphs(count):
    return ''.join(f'<p id="p{i}">{PARAGRAPH * 3}<a href="/reference/{i}">Reference {i}</a></p>' for i in range(count))
BODY = paragraphs(1800)
SMALL_BODY = paragraphs(30)
def pdf_fixture():
    text = 'Reader PDF fixture preserves this substantive paragraph and the expected value 48291.'
    stream = ('BT /F1 12 Tf 60 740 Td (' + text + ') Tj ET').encode()
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
    result = b'%PDF-1.4\n'
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    xref = len(result)
    result += b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    return result+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
PDF = pdf_fixture()
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/paper.pdf'):
            self.send_response(200); self.send_header('Content-Type','application/pdf'); self.send_header('Content-Length',str(len(PDF))); self.end_headers(); self.wfile.write(PDF)
            return
        if self.path.startswith('/slow'):
            time.sleep(8)
        query = parse_qs(urlparse(self.path).query)
        case = query.get('case',['baseline'])[0][:80]
        dynamic = 'dynamic' in urlparse(self.path).path
        body = SMALL_BODY if self.path.startswith('/small-') else BODY
        content = f'<main><h1>Reader fixture {case}</h1>{body}<table><tr><th>Key</th><th>Value</th></tr><tr><td>Expected</td><td>48291</td></tr></table></main>'
        if dynamic:
            content = '<div id="mount"></div><script>setTimeout(()=>{document.querySelector("#mount").innerHTML='+json.dumps(content)+';document.querySelector("main").className="ready";},30)</script>'
        html = ('<!doctype html><html><head><title>Reader stress fixture</title></head><body>'+content+'</body></html>').encode()
        self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(html))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(html)
    def log_message(self,*args): pass
ThreadingHTTPServer(('0.0.0.0',18891),Handler).serve_forever()
