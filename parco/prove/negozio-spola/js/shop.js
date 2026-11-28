(() => {
  const weeksText = (n) => (n === 1 ? '1 settimana' : `${n} settimane`);

  const SHOP = {
    name: 'Spola',
    title: document.title,
    ship: 1200,
    freeFrom: 20000,
    payNote: '',
    products: [
      { id: 'tappeto', name: 'Tappeto', sub: '120 × 180 cm, lana', price: 52000, img: 'p1.webp', weeks: 5, size: [120, 180],
        alt: 'Un tappeto di lana chiara con grani rossi e blu in rilievo: alberi, pavoni e un rombo al centro, con la frangia',
        text: ['Il pezzo più grande. Il disegno è tutto a grani: alberi, uccelli e un rombo al centro, dentro un bordo rosso.'],
        specs: [['Misura', '120 × 180 cm'], ['Materiale', 'lana sarda'], ['Tecnica', 'a pibiones'], ['Al telaio', '5 settimane']] },
      { id: 'corsia', name: 'Corsia', sub: '60 × 200 cm, lana', price: 26000, img: 'p2.webp', weeks: 3, size: [60, 200],
        alt: 'Una corsia lunga di lana chiara con una fila di motivi rossi in rilievo e due righe blu alle estremità',
        text: ['Lunga e stretta, per un corridoio o ai piedi del letto. Una sola fila di motivi corre da un capo all’altro.'],
        specs: [['Misura', '60 × 200 cm'], ['Materiale', 'lana sarda'], ['Tecnica', 'a pibiones'], ['Al telaio', '3 settimane']] },
      { id: 'cuscino', name: 'Cuscino', sub: '45 × 45 cm, lana', price: 9000, img: 'p3.webp', weeks: 1, size: [45, 45],
        alt: 'Un cuscino quadrato di lana chiara con un grande rombo rosso in rilievo, appoggiato al muro',
        text: ['Un rombo solo, grande, sul davanti. Il retro è in tela di lana liscia e si apre con una cerniera.'],
        specs: [['Misura', '45 × 45 cm'], ['Materiale', 'lana sarda'], ['Imbottitura', 'compresa'], ['Al telaio', '1 settimana']] },
      { id: 'coperta', name: 'Coperta', sub: '140 × 200 cm, lana', price: 34000, img: 'p4.webp', weeks: 4, size: [140, 200],
        alt: 'Una coperta di lana piegata, a bande blu, col bordo di fiori rossi in rilievo e la frangia',
        text: ['Larghe bande blu e un bordo di fiori a grani. Pesante, per l’inverno.'],
        specs: [['Misura', '140 × 200 cm'], ['Materiale', 'lana sarda'], ['Tecnica', 'a pibiones'], ['Al telaio', '4 settimane']] },
      { id: 'tovagliette', name: 'Tovagliette', sub: '2 pezzi, 35 × 45 cm, lino', price: 4800, img: 'p5.webp', weeks: 1, size: [35, 45],
        alt: 'Due tovagliette di lino color naturale con una fila di piccoli grani rossi, una stesa e una piegata',
        text: ['In lino, con una fila sola di grani rossi. Si lavano in lavatrice a 30 gradi.'],
        specs: [['Misura', '35 × 45 cm'], ['Pezzi', '2'], ['Materiale', 'lino'], ['Al telaio', '1 settimana']] },
    ],
    cardExtra: (p) => `<p class="card-weeks"><span class="loom" aria-hidden="true">${'<i></i>'.repeat(p.weeks)}</span>${weeksText(p.weeks)} al telaio</p>`,
    onCart(t, cart, byId) {
      let w = 0;
      cart.forEach((q, id) => { w += byId[id].weeks * q; });
      document.querySelector('[data-weeks]').textContent = w ? `Si tesse un pezzo dopo l’altro: il tuo ordine è pronto in circa ${weeksText(w)}, poi parte.` : '';
    },
    init() {
      // Every piece drawn at the same scale: 1 unit = 1 cm, bottoms aligned.
      const svg = document.querySelector('[data-scale]');
      const base = 220, gap = 16;
      let x = 6;
      svg.innerHTML = `<defs><pattern id="grani" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.1" fill="#a8322d"/></pattern></defs>` +
        SHOP.products.map((p) => {
          const [w, h] = p.size;
          const g = `<a href="#p-${p.id}" aria-label="${p.name}, ${w} per ${h} centimetri">
            <rect class="piece" x="${x}" y="${base - h}" width="${w}" height="${h}"/>
            <rect class="piece-grains" x="${x + 6}" y="${base - h + 6}" width="${w - 12}" height="${h - 12}"/>
            <text class="piece-name" x="${x + w / 2}" y="${base + 20}">${p.name}</text>
            <text class="piece-size" x="${x + w / 2}" y="${base + 36}">${w} × ${h}</text></a>`;
          x += w + gap;
          return g;
        }).join('');
    },
  };

  // Shop engine: catalogue, product page, cart. SHOP is defined above.
  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const money = (cents) => euro.format(cents / 100);
  const $ = (sel, root = document) => root.querySelector(sel);
  const byId = Object.fromEntries(SHOP.products.map((p) => [p.id, p]));
  const cart = new Map();
  const live = $('[data-live]');
  const say = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const picture = (p) => `<img src="img/${p.img}" width="800" height="600" alt="${esc(p.alt)}" loading="lazy" decoding="async">`;

  // Catalogue
  const grid = $('[data-grid]');
  grid.innerHTML = SHOP.products.map((p) => `
    <li class="card" id="card-${p.id}">
      <a class="card-link" href="#p-${p.id}">
        <span class="card-pic">${picture(p)}</span>
        <span class="card-name">${esc(p.name)}</span>
        <span class="card-sub">${esc(p.sub)}</span>
      </a>
      ${SHOP.cardExtra ? SHOP.cardExtra(p) : ''}
      <p class="card-foot"><span class="card-price">${money(p.price)}</span>
        <button class="card-add" type="button" data-add="${p.id}" aria-label="Aggiungi al carrello: ${esc(p.name)}">Aggiungi</button></p>
    </li>`).join('');

  // Product page
  const detail = $('[data-detail]');
  const home = $('[data-home]');
  let homeScroll = 0;
  function showDetail(id) {
    const p = byId[id];
    if (!p) return hideDetail();
    if (detail.hidden) homeScroll = window.scrollY;
    detail.innerHTML = `
      <a class="detail-back" href="#catalogo">Torna ai prodotti</a>
      <div class="detail-grid">
        <div class="detail-pic">${picture(p).replace(' loading="lazy"', '')}</div>
        <div class="detail-text">
          <h1 class="detail-name" tabindex="-1">${esc(p.name)}</h1>
          <p class="detail-sub">${esc(p.sub)}</p>
          <p class="detail-price">${money(p.price)}</p>
          ${p.text.map((t) => `<p>${esc(t)}</p>`).join('')}
          ${SHOP.detailExtra ? SHOP.detailExtra(p) : ''}
          <dl class="detail-specs">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="detail-buy">
            <div class="qty" role="group" aria-label="Quantità">
              <button type="button" data-step="-1" aria-label="Uno in meno">−</button>
              <output data-qty>1</output>
              <button type="button" data-step="1" aria-label="Uno in più">+</button>
            </div>
            <button class="button detail-add" type="button" data-add="${p.id}" data-from-detail>Aggiungi al carrello</button>
          </div>
        </div>
      </div>`;
    home.hidden = true;
    detail.hidden = false;
    window.scrollTo(0, 0);
    document.title = `${p.name} · ${SHOP.name}`;
    $('.detail-name', detail).focus({ preventScroll: true });
  }
  function hideDetail() {
    if (detail.hidden) return;
    detail.hidden = true;
    home.hidden = false;
    document.title = SHOP.title;
    window.scrollTo(0, homeScroll);
  }
  function route() {
    const m = location.hash.match(/^#p-(.+)$/);
    if (m) showDetail(m[1]); else hideDetail();
  }
  window.addEventListener('hashchange', route);

  // Cart
  const drawer = $('#cart');
  const scrim = $('[data-scrim]');
  const toggle = $('.cart-toggle');
  let opener = null;
  function openCart() {
    opener = document.activeElement;
    drawer.hidden = false; scrim.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    $('[data-cart-close]').focus();
  }
  function closeCart() {
    drawer.hidden = true; scrim.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    resetPay();
    if (opener && opener.focus) opener.focus();
  }
  toggle.addEventListener('click', openCart);
  scrim.addEventListener('click', closeCart);
  $('[data-cart-close]').addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeCart(); });

  function add(id, n = 1) {
    cart.set(id, (cart.get(id) || 0) + n);
    renderCart();
    say(`${byId[id].name} nel carrello. Totale ${money(totals().total)}.`);
    toggle.classList.remove('is-bumped'); void toggle.offsetWidth; toggle.classList.add('is-bumped');
  }
  function setQty(id, n) {
    if (n <= 0) cart.delete(id); else cart.set(id, n);
    renderCart();
  }
  function totals() {
    let items = 0, count = 0;
    cart.forEach((q, id) => { items += byId[id].price * q; count += q; });
    const ship = count === 0 || items >= SHOP.freeFrom ? 0 : SHOP.ship;
    return { items, count, ship, total: items + ship };
  }
  function renderCart() {
    const t = totals();
    $('[data-cart-count]').textContent = t.count;
    $('[data-cart-empty]').hidden = t.count > 0;
    $('[data-cart-foot]').hidden = t.count === 0;
    $('[data-cart-lines]').innerHTML = [...cart].map(([id, q]) => {
      const p = byId[id];
      return `<li class="line">
        <img src="img/${p.img}" width="800" height="600" alt="">
        <div class="line-text"><p class="line-name">${esc(p.name)}</p><p class="line-sub">${esc(p.sub)}</p>
          <div class="qty qty--small" role="group" aria-label="Quantità di ${esc(p.name)}">
            <button type="button" data-line="${id}" data-d="-1" aria-label="Uno in meno">−</button><output>${q}</output>
            <button type="button" data-line="${id}" data-d="1" aria-label="Uno in più">+</button></div></div>
        <p class="line-price">${money(p.price * q)}</p></li>`;
    }).join('');
    $('[data-total-items]').textContent = money(t.items);
    $('[data-total-ship]').textContent = t.ship === 0 ? 'Gratis' : money(t.ship);
    $('[data-total-sum]').textContent = money(t.total);
    const free = $('[data-cart-free]');
    free.textContent = t.items >= SHOP.freeFrom ? 'La spedizione è gratis.' : `Mancano ${money(SHOP.freeFrom - t.items)} alla spedizione gratis.`;
    if (SHOP.onCart) SHOP.onCart(t, cart, byId);
  }

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const n = addBtn.hasAttribute('data-from-detail') ? Number($('[data-qty]').textContent) : 1;
      add(addBtn.dataset.add, n);
      if (addBtn.hasAttribute('data-from-detail')) openCart();
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const out = $('[data-qty]');
      out.textContent = Math.max(1, Math.min(20, Number(out.textContent) + Number(step.dataset.step)));
      return;
    }
    const line = e.target.closest('[data-line]');
    if (line) setQty(line.dataset.line, (cart.get(line.dataset.line) || 0) + Number(line.dataset.d));
  });

  // Payment
  const payBtn = $('[data-cart-pay]');
  const note = $('[data-cart-note]');
  function resetPay() { note.textContent = SHOP.payNote; note.classList.remove('is-error', 'is-done'); }
  payBtn.addEventListener('click', () => {
    const problem = SHOP.beforePay ? SHOP.beforePay() : null;
    if (problem) { note.textContent = problem; note.classList.add('is-error'); say(problem); return; }
    note.textContent = `Ordine ricevuto, grazie: totale ${money(totals().total)}.`;
    note.classList.add('is-done');
    say(note.textContent);
  });

  resetPay();
  renderCart();
  route();
  if (SHOP.init) SHOP.init();
})();
