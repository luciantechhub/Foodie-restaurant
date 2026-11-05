const $ = id => document.getElementById(id);
const money = n => '₦' + Number(n).toLocaleString('en-NG');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let dishes = [], settings = {}, cat = 'All';
let cart = {};
try { cart = JSON.parse(localStorage.getItem('cart') || '{}'); } catch (e) {}

const toast = t => { const x = $('toast'); x.textContent = t; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 2200); };
const waLink = text => 'https://wa.me/' + (settings.whatsapp || '') + '?text=' + encodeURIComponent(text);
const openWA = text => {
  if (!settings.whatsapp) return toast('Ordering is not set up yet. Please check back soon.');
  window.open(waLink(text), '_blank');
};

$('theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
};
$('yr').textContent = new Date().getFullYear();

function renderMenu() {
  const cats = ['All', ...new Set(dishes.map(d => d.category))];
  $('chips').innerHTML = dishes.length > 0 && cats.length > 2
    ? cats.map(c => `<button class="chip${c === cat ? ' on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('') : '';
  const list = dishes.filter(d => cat === 'All' || d.category === cat);
  $('grid').innerHTML = list.length ? list.map(d => `
    <div class="dish">
      <div class="ph" ${d.image ? `style="background-image:url('${esc(d.image)}')"` : ''}>${d.image ? '' : 'No photo'}</div>
      <h3>${esc(d.name)}</h3>
      <div class="d">${esc(d.description)}</div>
      <div class="p">${money(d.price)}</div>
      <button class="btn" data-id="${d._id}" ${d.soldOut ? 'disabled' : ''}>${d.soldOut ? 'Sold out' : 'Add to order'}</button>
    </div>`).join('') : '<p class="empty">The menu is being updated. Please check back shortly.</p>';
}

function renderHero() {
  const d = dishes.find(x => x.image);
  if (d) {
    $('heroImg').style.backgroundImage = `url('${d.image}')`;
    $('heroImg').textContent = '';
    $('hn').textContent = d.name; $('hp').textContent = money(d.price);
    $('heroCard').style.display = 'block';
  }
}

function renderCart() {
  let count = 0, total = 0;
  const ids = Object.keys(cart).filter(id => dishes.some(d => d._id === id));
  $('items').innerHTML = ids.length ? ids.map(id => {
    const d = dishes.find(x => x._id === id), q = cart[id];
    count += q; total += q * d.price;
    return `<div class="it"><div class="th" ${d.image ? `style="background-image:url('${esc(d.image)}')"` : ''}></div>
      <div class="n">${esc(d.name)}<br><small>${money(d.price)}</small></div>
      <div class="q"><button data-m="${id}" aria-label="Less">−</button>${q}<button data-a="${id}" aria-label="More">+</button></div></div>`;
  }).join('') : '<p class="empty">Nothing here yet. Add a dish from the menu.</p>';
  $('cnt').textContent = count; $('total').textContent = money(total);
  try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {}
}

$('chips').onclick = e => { if (e.target.dataset.c) { cat = e.target.dataset.c; renderMenu(); } };
$('grid').onclick = e => {
  const id = e.target.dataset.id; if (!id) return;
  cart[id] = (cart[id] || 0) + 1; renderCart();
  toast(dishes.find(d => d._id === id).name + ' added');
};
$('items').onclick = e => {
  const a = e.target.dataset.a, m = e.target.dataset.m;
  if (a) cart[a]++;
  if (m) { cart[m]--; if (cart[m] <= 0) delete cart[m]; }
  renderCart();
};
$('cartBtn').onclick = () => $('drawer').classList.add('show');
$('close').onclick = $('bk').onclick = () => $('drawer').classList.remove('show');

$('send').onclick = () => {
  const ids = Object.keys(cart).filter(id => dishes.some(d => d._id === id));
  if (!ids.length) return toast('Add something to your order first');
  let total = 0;
  const lines = ids.map(id => { const d = dishes.find(x => x._id === id); total += d.price * cart[id]; return `- ${cart[id]} x ${d.name} (${money(d.price * cart[id])})`; });
  openWA(`Hello Foodie, I would like to order:\n\n${lines.join('\n')}\n\nTotal: ${money(total)}\nName: ${$('cname').value || '-'}\nAddress: ${$('caddr').value || '-'}`);
};

$('rsv').onclick = () => {
  if (!$('rn').value || !$('rd').value || !$('rt').value) return toast('Please fill in your name, date and time');
  openWA(`Hello Foodie, I would like to reserve a table.\n\nName: ${$('rn').value}\nDate: ${$('rd').value}\nTime: ${$('rt').value}\nGuests: ${$('rg').value}\nNote: ${$('rm').value || '-'}`);
};

$('chat').onclick = e => { e.preventDefault(); openWA('Hello Foodie, I have a question.'); };

(async () => {
  try {
    [dishes, settings] = await Promise.all([fetch('/api/dishes').then(r => r.json()), fetch('/api/settings').then(r => r.json())]);
  } catch (e) { toast('Could not load the menu. Refresh to try again.'); }
  $('openTxt').textContent = settings.hours ? 'Open: ' + settings.hours : '';
  $('hrs').textContent = settings.hours ? 'Open daily, ' + settings.hours : '';
  $('addr').textContent = settings.address || '';
  renderMenu(); renderHero(); renderCart();
})();
