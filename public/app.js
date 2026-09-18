'use strict';
const $ = (id) => document.getElementById(id);
let selected = new Set();
let history = [];
let revision = -1;
let canEdit = false;
let busy = false;
let refreshing = false;
let connected = false;
let password = '';
try { password = sessionStorage.getItem('rifa-admin') || ''; } catch { /* Memory-only session. */ }
let toastTimer;
function validNumbers(value) {
  return Array.isArray(value) && value.length <= 100 && value.every(n => Number.isInteger(n) && n >= 1 && n <= 100);
}
const ball = new Image();
ball.src = 'balon.svg';
const posterImage = $('poster-image');
const buttons = [];
const targets = [];
// Coordinates measured on the supplied 1024 × 1536 poster.
const columns = [47, 142, 238, 332, 424, 517, 610, 705, 800, 895];
const rows = [746, 818, 889, 961, 1032, 1104, 1176, 1247, 1318, 1389];
function cell(n) {
  return { x: columns[(n - 1) % 10], y: rows[Math.floor((n - 1) / 10)], w: 87, h: 64 };
}
function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
}
function render() {
  for (let n = 1; n <= 100; n++) {
    const active = selected.has(n);
    for (const button of [buttons[n - 1], targets[n - 1]]) {
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `Número ${n}, ${active ? 'marcado; tocar para liberar' : 'disponible; tocar para marcar'}`);
    }
    buttons[n - 1].innerHTML = active ? `<img class="ball" src="balon.svg" alt=""><span class="number-label">${n}</span>` : String(n);
    targets[n - 1].innerHTML = active ? '<img src="balon.svg" alt="">' : '';
  }
  $('marked-count').textContent = selected.size;
  $('available-count').textContent = 100 - selected.size;
  $('selection-summary').textContent = selected.size ? `${selected.size} de 100 números marcados` : '¡Elige el primer número!';
  const editable = canEdit && connected && !busy;
  buttons.forEach(button => { button.disabled = !editable; });
  targets.forEach(button => { button.disabled = !editable; });
  $('clear').disabled = !editable || selected.size === 0;
  $('undo').disabled = !editable || history.length === 0;
  $('restore').disabled = !editable;
  $('backup').disabled = revision < 0 || busy;
  $('access').disabled = busy;
  $('access').textContent = canEdit ? 'Cerrar edición' : 'Habilitar edición';
  $('save-state').textContent = busy ? 'Guardando cambios…' : connected ? (canEdit ? 'Guardado en la nube · Edición habilitada' : 'Sincronizado · Solo lectura') : 'Sin conexión: pulsa Actualizar para volver a conectar';
}
async function request(method = 'GET', body, key = password) {
  const response = await fetch('/api/numbers', {
    method, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { ...(key ? { Authorization: `Bearer ${encodeURIComponent(key)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('El servidor no respondió. Revisa la conexión e intenta de nuevo.'); }
  if (!response.ok) { const error = new Error(data.error || 'No se pudo guardar.'); error.status = response.status; error.data = data; throw error; }
  return data;
}
function applyState(data, remote = false) {
  if (!validNumbers(data.numbers) || !Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('Respuesta inválida del servidor.');
  if (data.revision < revision) return;
  if (remote && revision !== data.revision) history = [];
  selected = new Set(data.numbers); revision = data.revision;
  canEdit = data.canEdit === true; connected = true;
}
function forgetPassword() {
  password = ''; canEdit = false;
  try { sessionStorage.removeItem('rifa-admin'); } catch { /* Memory-only session. */ }
}
async function refresh(showError = false) {
  if (busy || refreshing) return;
  refreshing = true;
  try {
    const data = await request();
    if (!busy) applyState(data, true);
  } catch (error) {
    if (error.status === 401) forgetPassword();
    connected = false;
    if (showError) notify(error.message);
  } finally { refreshing = false; render(); }
}
async function change(next, undo = false) {
  if (busy || !canEdit || !connected) return false;
  const before = [...selected];
  busy = true; render();
  try {
    const data = await request('PUT', { numbers: [...next], revision });
    applyState(data);
    if (undo) history.pop(); else history.push(before);
    if (history.length > 100) history.shift();
    return true;
  } catch (error) {
    if (error.status === 409) { applyState(error.data, true); history = []; }
    else { connected = false; if (error.status === 401) forgetPassword(); }
    notify(error.status ? error.message : 'No se pudo confirmar el guardado. Pulsa Actualizar antes de volver a editar.');
    return false;
  } finally { busy = false; render(); }
}
async function toggle(n) {
  const next = new Set(selected);
  next.has(n) ? next.delete(n) : next.add(n);
  await change(next);
}
for (let n = 1; n <= 100; n++) {
  const button = document.createElement('button');
  button.className = 'number';
  button.type = 'button';
  button.addEventListener('click', () => toggle(n));
  $('number-grid').append(button);
  buttons.push(button);
  const target = document.createElement('button');
  const rect = cell(n);
  target.type = 'button';
  target.className = 'poster-target';
  target.title = `Número ${n}`;
  target.style.cssText = `left:${rect.x / 1024 * 100}%;top:${rect.y / 1536 * 100}%;width:${rect.w / 1024 * 100}%;height:${rect.h / 1536 * 100}%`;
  target.addEventListener('click', () => toggle(n));
  $('poster-targets').append(target);
  targets.push(target);
}
$('undo').addEventListener('click', async () => {
  if (!history.length) return;
  await change(new Set(history[history.length - 1]), true);
});
$('clear').addEventListener('click', () => $('clear-dialog').showModal());
$('clear-dialog').addEventListener('close', async () => {
  if ($('clear-dialog').returnValue === 'confirm' && await change(new Set())) notify('Selección limpia y guardada. Puedes deshacer el cambio.');
});
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$('backup').addEventListener('click', () => {
  const data = { app: 'rifa-juanca', version: 1, numbers: [...selected].sort((a,b) => a-b) };
  saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'rifa-juanca-respaldo.json');
  notify('Respaldo descargado.');
});
$('restore').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20000) throw new Error('size');
    const data = JSON.parse(await file.text());
    if (data.app !== 'rifa-juanca' || data.version !== 1 || !validNumbers(data.numbers)) throw new Error('invalid');
    if (await change(new Set(data.numbers))) notify('Respaldo guardado en la nube. Puedes deshacer el cambio.');
  } catch { notify('Ese archivo no es un respaldo válido de esta rifa.'); }
  event.target.value = '';
});
async function exportPoster() {
  await Promise.all([posterImage.decode(), ball.decode()]);
  const canvas = document.createElement('canvas');
  canvas.width = posterImage.naturalWidth; canvas.height = posterImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(posterImage, 0, 0);
  ctx.save(); ctx.scale(canvas.width / 1024, canvas.height / 1536);
  for (const n of selected) {
    const rect = cell(n);
    // Same size and alignment as the live preview: 65% of the cell width.
    const size = Math.min(rect.w * .65, rect.h * .88);
    ctx.save(); ctx.shadowColor = '#16392755'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.drawImage(ball, rect.x + (rect.w - size) / 2, rect.y + (rect.h - size) / 2, size, size);
    ctx.restore();
  }
  ctx.restore();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG failed')), 'image/png'));
}
$('download').addEventListener('click', async () => {
  const button = $('download');
  button.disabled = true; button.textContent = 'Preparando tu afiche…';
  try {
    await refresh();
    if (!connected || busy) throw new Error('Unavailable');
    saveFile(await exportPoster(), 'rifa-juanca.png');
    notify('¡Afiche listo! Compártelo con tu equipo.');
  } catch { notify('No se pudo descargar una selección actualizada. Pulsa Actualizar e intenta de nuevo.'); }
  finally { button.disabled = false; button.textContent = '↓ Descargar imagen'; }
});
Promise.all([posterImage.decode(), ball.decode()]).then(() => { $('download').disabled = false; }).catch(() => notify('No se pudo cargar el afiche. Recarga la página.'));
$('access').addEventListener('click', () => {
  if (canEdit) { forgetPassword(); history = []; render(); return; }
  $('login-error').textContent = ''; $('login-dialog').showModal();
});
$('cancel-login').addEventListener('click', () => $('login-dialog').close());
$('login-dialog').addEventListener('close', () => { $('admin-password').value = ''; });
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.submitter; submit.disabled = true;
  const key = $('admin-password').value;
  try {
    const data = await request('GET', undefined, key);
    if (!data.canEdit) throw new Error('La clave de edición no es correcta.');
    password = key;
    try { sessionStorage.setItem('rifa-admin', key); } catch { /* Memory-only session. */ }
    applyState(data, true); render(); $('login-dialog').close();
  } catch (error) { $('login-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
$('refresh').addEventListener('click', () => refresh(true));
setInterval(() => { if (!document.hidden) refresh(); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', () => refresh());
render();
refresh(true);
