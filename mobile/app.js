const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
let source;
let cover = false;

function relayUrl() { return $('#relay').value.trim().replace(/\/$/, ''); }
function setStatus(value) { $('#connection').textContent = value; }
function show(frame) {
  if (!frame) return;
  $('#join').classList.add('hidden'); $('#viewer').classList.remove('hidden');
  $('#frameName').textContent = frame.name; $('#frameSize').textContent = `${frame.width} × ${frame.height} PX`;
  $('#frame').src = `data:image/png;base64,${frame.image}`; setStatus('● 已实时连接');
}
async function connect() {
  const relay = relayUrl(), session = $('#session').value.trim().toUpperCase(), key = $('#key').value.trim();
  if (!relay || !session || !key) { setStatus('请填写完整的会话信息'); return; }
  localStorage.setItem('framewise', JSON.stringify({ relay, session, key }));
  const current = await fetch(`${relay}/api/sessions/${session}?key=${encodeURIComponent(key)}`).then(r => r.ok ? r.json() : Promise.reject());
  show(current.frame);
  source?.close(); source = new EventSource(`${relay}/api/sessions/${session}/events?key=${encodeURIComponent(key)}`);
  source.addEventListener('frame', e => show(JSON.parse(e.data))); source.onerror = () => setStatus('正在重连…');
}
$('#connect').onclick = () => connect().catch(() => setStatus('连接失败，请检查会话信息'));
$('#fit').onclick = () => { cover=!cover; $('.stage').classList.toggle('fill',cover); $('#fit').textContent=cover?'填满屏幕':'完整显示'; };
const saved = JSON.parse(localStorage.getItem('framewise') || 'null'); const supplied = { relay: params.get('relay'), session: params.get('session'), key: params.get('key') };
const initial = supplied.relay ? supplied : saved;
if (initial) { $('#relay').value=initial.relay; $('#session').value=initial.session; $('#key').value=initial.key; connect().catch(()=>{}); }
