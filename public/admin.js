const $ = id => document.getElementById(id);
const money = n => '₦' + Number(n).toLocaleString('en-NG');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = t => { const x = $('toast'); x.textContent = t; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 2000); };
const api = async (url, opts = {}) => {
  const r = await fetch(url, { credentials: 'same-origin', ...opts });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/admin/login') { show(false); throw new Error('Please log in'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
};
let dishes = [];

function show(loggedIn) {
  $('loginView').style.display = loggedIn ? 'none' : 'block';
  $('app').style.display = loggedIn ? 'block' : 'none';
}

$('loginForm').onsubmit = async e => {
  e.preventDefault(); $('loginMsg').textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    $('pw').value = ''; start();
  } catch (err) { $('loginMsg').textContent = err.message; }
};
$('logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); show(false); };

document.querySelector('.tabs').onclick = e => {
  const t = e.target.dataset.t; if (!t) return;
  document.querySelectorAll('.tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === t));
  $('tab-dishes').style.display = t === 'dishes' ? 'block' : 'none';
  $('tab-settings').style.display = t === 'settings' ? 'block' : 'none';
};

function renderList() {
  $('cats').innerHTML = [...new Set(dishes.map(d => d.category))].map(c => `<option value="${esc(c)}">`).join('');
  $('list').innerHTML = dishes.length ? dishes.map(d => `
    <div class="li">
      <div class="th" ${d.image ? `style="background-image:url('${esc(d.image)}')"` : ''}></div>
      <div class="n"><b>${esc(d.name)}${d.soldOut ? '<span class="tag">Sold out</span>' : ''}</b><span>${money(d.price)} · ${esc(d.category)}</span></div>
      <div class="acts"><button class="btn out" data-edit="${d._id}">Edit</button><button class="btn red" data-del="${d._id}">Delete</button></div>
    </div>`).join('') : '<p class="empty">No dishes yet. Add your first one above.</p>';
}

async function load() { dishes = await api('/api/dishes'); renderList(); }

function resetForm() {
  $('dishForm').reset(); $('did').value = ''; $('pv').style.display = 'none';
  $('formTitle').textContent = 'Add a dish'; $('dcancel').style.display = 'none'; $('dmsg').textContent = '';
}
$('dcancel').onclick = resetForm;
$('dimg').onchange = () => {
  const f = $('dimg').files[0];
  if (f) { $('pv').src = URL.createObjectURL(f); $('pv').style.display = 'block'; }
};

$('list').onclick = async e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) {
    const d = dishes.find(x => x._id === ed);
    $('did').value = d._id; $('dname').value = d.name; $('dprice').value = d.price;
    $('dcat').value = d.category; $('ddesc').value = d.description; $('dsold').checked = d.soldOut;
    if (d.image) { $('pv').src = d.image; $('pv').style.display = 'block'; }
    $('formTitle').textContent = 'Edit dish'; $('dcancel').style.display = 'inline-block';
    $('dishForm').scrollIntoView({ behavior: 'smooth' });
  }
  if (del && confirm('Delete this dish?')) {
    try { await api('/api/admin/dishes/' + del, { method: 'DELETE' }); await load(); toast('Dish deleted'); }
    catch (err) { toast(err.message); }
  }
};

$('dishForm').onsubmit = async e => {
  e.preventDefault(); $('dmsg').textContent = '';
  const id = $('did').value, fd = new FormData();
  fd.append('name', $('dname').value); fd.append('price', $('dprice').value);
  fd.append('category', $('dcat').value || 'Main'); fd.append('description', $('ddesc').value);
  fd.append('soldOut', $('dsold').checked);
  if ($('dimg').files[0]) fd.append('image', $('dimg').files[0]);
  $('dsave').disabled = true; $('dsave').textContent = 'Saving...';
  try {
    await api(id ? '/api/admin/dishes/' + id : '/api/admin/dishes', { method: id ? 'PUT' : 'POST', body: fd });
    resetForm(); await load(); toast('Saved');
  } catch (err) { $('dmsg').textContent = err.message; }
  $('dsave').disabled = false; $('dsave').textContent = 'Save dish';
};

$('setForm').onsubmit = async e => {
  e.preventDefault(); $('smsg').textContent = '';
  try {
    await api('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: $('swa').value, address: $('sad').value, hours: $('shr').value }) });
    toast('Saved');
  } catch (err) { $('smsg').textContent = err.message; }
};

async function start() {
  try { await api('/api/admin/me'); } catch { return show(false); }
  show(true);
  const s = await fetch('/api/settings').then(r => r.json());
  $('swa').value = s.whatsapp || ''; $('sad').value = s.address || ''; $('shr').value = s.hours || '';
  load();
}
start();
