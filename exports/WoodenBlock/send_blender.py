import socket,json
from pathlib import Path
code=Path(__file__).with_name('setup_render.py').read_text()
s=socket.create_connection(('127.0.0.1',9876),timeout=10);s.settimeout(50)
s.sendall(json.dumps({'type':'execute_code','params':{'code':code}}).encode())
data=b''
while True:
 data+=s.recv(65536)
 try:r=json.loads(data);break
 except json.JSONDecodeError:pass
print(json.dumps(r));s.close()
