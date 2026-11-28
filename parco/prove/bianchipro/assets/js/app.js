(() => {
  const VAT_RATE = 22;

  const models = [
    {
      id: 'AB1203', code: 'G-AB1203', ref: 'FORAB1203', trays: 3, photo: 'assets/img/ab1203.jpg',
      price: 175834, listPrice: 308480, chillKg: 12, freezeKg: 8,
      power: 'Monofase 230 V, 770 W', litres: 140, outside: [80, 82.5, 94.5], inside: [66, 40, 33], weight: 80,
    },
    {
      id: 'AB1805', code: 'G-AB1805', ref: 'FORAB1805', trays: 5, photo: 'assets/img/ab1805.jpg',
      price: 207474, listPrice: 363990, chillKg: 18, freezeKg: 14,
      power: 'Monofase 230 V, 720 W', litres: 169, outside: [80, 82.5, 101.5], inside: [66, 40, 40], weight: 95,
    },
    {
      id: 'AB4010', code: 'G-AB4010', ref: 'FORAB4010', trays: 10, photo: 'assets/img/ab4010.jpg',
      price: 265683, listPrice: 466111, chillKg: 40, freezeKg: 28,
      power: 'Monofase 230 V, 900 W', litres: 241, outside: [80, 82.5, 164.5], inside: [66, 40, 87], weight: 150,
    },
    {
      id: 'AB5514', code: 'G-AB5514', ref: 'FORAB5514', trays: 14, photo: 'assets/img/ab5514.jpg',
      price: 406495, listPrice: 713149, chillKg: 40, freezeKg: 28,
      power: 'Trifase 400 V, 2500 W', litres: 319, outside: [80, 82.5, 217], inside: [66, 40, 117], weight: 210,
    },
  ];

  const extras = [
    { id: 'gn11', name: 'Bacinella Gastronorm GN 1/1 inox', detail: '530×325 mm', price: 1285, img: 'assets/img/acc-bacinella-gn11.jpg' },
    { id: 'av4940', name: 'Teglia alluminata 60×40', detail: 'AV4940', price: 1182, img: 'assets/img/acc-av4940.jpg' },
    { id: 'av4937', name: 'Teglia Blurex 60×40', detail: 'AV4937', price: 1028, img: 'assets/img/acc-av4937.jpg' },
    { id: 'gri11', name: 'Griglia GN 1/1', detail: 'GRI11', price: 1902, img: 'assets/img/acc-gri11.jpg' },
  ];

  const cycles = {
    chill: { end: 3, minutes: 90, kgKey: 'chillKg' },
    freeze: { end: -18, minutes: 240, kgKey: 'freezeKg' },
  };

  const state = {
    model: models[3],
    extras: Object.fromEntries(extras.map((e) => [e.id, 0])),
    qty: 1,
    cycle: 'chill',
    cart: [],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const euro = (cents) => `€ ${groupThousands(String(Math.floor(cents / 100)))},${String(cents % 100).padStart(2, '0')}`;
  const vatOf = (net) => Math.round((net * VAT_RATE) / 100);
  const decimal = (n) => String(n).replace('.', ',');
  const signed = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

  const extrasNet = (picked) => extras.reduce((sum, e) => sum + e.price * (picked[e.id] || 0), 0);
  const unitNet = (model, picked) => model.price + extrasNet(picked);

  const bind = (key, value) => $$(`[data-bind="${key}"]`).forEach((el) => { el.textContent = value; });

  function renderSizes() {
    const box = $('[data-sizes]');
    const tallest = Math.max(...models.map((m) => m.outside[2]));
    box.innerHTML = models.map((m) => `
      <label class="size">
        <input type="radio" name="size" value="${m.id}" ${m === state.model ? 'checked' : ''}>
        <span class="size__cab" style="--h:${(m.outside[2] / tallest).toFixed(3)}" aria-hidden="true"><span class="size__door"></span></span>
        <span class="size__trays">${m.trays} teglie</span>
        <span class="size__height">${decimal(m.outside[2])} cm</span>
        <span class="size__price">${euro(m.price)}</span>
      </label>`).join('');
    box.addEventListener('change', (event) => {
      state.model = models.find((m) => m.id === event.target.value);
      update();
    });
  }

  function renderExtras() {
    const list = $('[data-extras]');
    list.innerHTML = extras.map((e) => `
      <li class="extra">
        <img src="${e.img}" width="400" height="400" alt="" loading="lazy">
        <span class="extra__text"><span class="extra__name">${e.name}</span><span class="extra__meta">${e.detail} · ${euro(e.price)} + IVA</span></span>
        <span class="stepper stepper--small" role="group" aria-label="${e.name}">
          <button type="button" data-extra="${e.id}" data-step="-1" aria-label="Una in meno">−</button>
          <output data-extra-qty="${e.id}">0</output>
          <button type="button" data-extra="${e.id}" data-step="1" aria-label="Una in più">+</button>
        </span>
      </li>`).join('');
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-extra]');
      if (!button) return;
      const id = button.dataset.extra;
      state.extras[id] = Math.max(0, state.extras[id] + Number(button.dataset.step));
      update();
    });
  }

  function renderRack() {
    const slots = state.model.trays;
    const used = Object.values(state.extras).reduce((a, b) => a + b, 0);
    $('[data-rack]').innerHTML = Array.from({ length: slots }, (_, i) => `<span class="rack__slot${i < used ? ' is-full' : ''}"></span>`).join('');
    const spare = used - slots;
    $('[data-rack-text]').textContent = spare > 0
      ? `Guide occupate ${slots} su ${slots}, più ${spare} di scorta`
      : `Guide occupate ${used} su ${slots}`;
  }

  function renderSpecs() {
    const m = state.model;
    const rows = [
      ['Capacità teglie', `${m.trays} teglie GN 1/1 o 60×40 cm`],
      ['Abbattimento', `da +90 °C a +3 °C, fino a ${m.chillKg} kg in circa 90 min`],
      ['Surgelazione', `da +90 °C a −18 °C, fino a ${m.freezeKg} kg in circa 240 min`],
      ['Capacità interna', `${m.litres} L`],
      ['Alimentazione', m.power],
      ['Gas refrigerante', 'R290'],
      ['Refrigerazione', 'Ventilata'],
      ['Controllo temperatura', 'Elettronico'],
      ['Strato isolante', '70 mm'],
      ['Struttura', 'Acciaio inox AISI 304'],
      ['Dimensioni esterne', `${m.outside.map(decimal).join(' × ')} cm`],
      ['Dimensioni interne', `${m.inside.map(decimal).join(' × ')} cm`],
      ['Peso netto', `${m.weight} kg`],
      ['Porte', 'Singola porta, senza luce interna'],
      ['Ambiente massimo', '+43 °C, 60% di umidità relativa'],
    ];
    $('[data-specs]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  function renderElevation() {
    const [w, , h] = state.model.outside;
    const tallest = Math.max(...models.map((x) => x.outside[2]));
    const scale = 260 / tallest;
    const cw = w * scale;
    const ch = h * scale;
    const top = 20 + (260 - ch);
    const x = 60;
    const base = top + ch;
    const doorEnd = top + ch * 0.78;
    $('[data-elevation]').innerHTML = `
      <svg viewBox="0 0 230 340" role="img" aria-label="Ingombro frontale ${decimal(w)} per ${decimal(h)} centimetri">
        <rect class="el-body" x="${x}" y="${top}" width="${cw}" height="${ch}" rx="2"/>
        <line class="el-split" x1="${x}" x2="${x + cw}" y1="${doorEnd}" y2="${doorEnd}"/>
        <line class="el-dim" x1="${x}" x2="${x + cw}" y1="${base + 22}" y2="${base + 22}"/>
        <line class="el-tick" x1="${x}" x2="${x}" y1="${base + 16}" y2="${base + 28}"/>
        <line class="el-tick" x1="${x + cw}" x2="${x + cw}" y1="${base + 16}" y2="${base + 28}"/>
        <text class="el-text" x="${x + cw / 2}" y="${base + 16}" text-anchor="middle">${decimal(w)} cm</text>
        <line class="el-dim" x1="${x - 18}" x2="${x - 18}" y1="${top}" y2="${base}"/>
        <line class="el-tick" x1="${x - 24}" x2="${x - 12}" y1="${top}" y2="${top}"/>
        <line class="el-tick" x1="${x - 24}" x2="${x - 12}" y1="${base}" y2="${base}"/>
        <text class="el-text" x="${x - 26}" y="${top + ch / 2}" text-anchor="middle" transform="rotate(-90 ${x - 26} ${top + ch / 2})">${decimal(h)} cm</text>
        <text class="el-text el-text--muted" x="${x + cw / 2}" y="${base + 50}" text-anchor="middle">profondità ${decimal(state.model.outside[1])} cm</text>
      </svg>`;
  }

  function renderChart(animate) {
    const box = $('[data-chart]');
    const width = box.clientWidth;
    if (!width) return;
    const narrow = width < 560;
    const height = narrow ? 300 : 420;
    const pad = { l: narrow ? 52 : 84, r: narrow ? 20 : 40, t: 28, b: 44 };
    const maxT = 95;
    const minT = -25;
    const maxMin = 240;
    const px = (min) => pad.l + (min / maxMin) * (width - pad.l - pad.r);
    const py = (t) => pad.t + ((maxT - t) / (maxT - minT)) * (height - pad.t - pad.b);
    const active = state.cycle;
    const line = (key) => {
      const c = cycles[key];
      return { x1: px(0), y1: py(90), x2: px(c.minutes), y2: py(c.end), on: key === active };
    };
    const lines = ['chill', 'freeze'].map(line);
    const refs = [90, 3, -18];
    const ticks = [0, 90, 240];
    box.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"
        aria-label="Da +90 °C a +3 °C in circa 90 minuti; da +90 °C a −18 °C in circa 240 minuti">
        ${refs.map((t) => `
          <line class="ch-ref" x1="${pad.l}" x2="${width - pad.r}" y1="${py(t)}" y2="${py(t)}"/>
          <text class="ch-axis" x="${pad.l - 12}" y="${py(t) + 5}" text-anchor="end">${signed(t)}°</text>`).join('')}
        ${ticks.map((m) => `
          <text class="ch-axis" x="${px(m)}" y="${height - 14}" text-anchor="${m === 0 ? 'start' : m === maxMin ? 'end' : 'middle'}">${m} min</text>`).join('')}
        ${lines.filter((l) => !l.on).map((l) => `<line class="ch-line" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`).join('')}
        ${lines.filter((l) => l.on).map((l) => `
          <line class="ch-line ch-line--on${animate ? ' is-drawing' : ''}" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" pathLength="1"/>
          <circle class="ch-dot ch-dot--hot" cx="${l.x1}" cy="${l.y1}" r="6"/>
          <circle class="ch-dot" cx="${l.x2}" cy="${l.y2}" r="6"/>`).join('')}
      </svg>`;
  }

  function renderCycleText() {
    const c = cycles[state.cycle];
    $('[data-cycle-end]').textContent = `${signed(c.end)} °C`;
    $('[data-cycle-desc]').textContent = `da +90 °C in circa ${c.minutes} minuti, fino a ${state.model[c.kgKey]} kg`;
    $$('[data-cycle]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cycle === state.cycle)));
  }

  function update() {
    const m = state.model;
    const unit = unitNet(m, state.extras);
    const net = unit * state.qty;
    bind('model', m.id);
    bind('code', m.code);
    bind('ref', m.ref);
    bind('trays', m.trays);
    bind('chillKg', m.chillKg);
    bind('price', euro(m.price));
    bind('priceGross', euro(m.price + vatOf(m.price)));
    bind('listPrice', euro(m.listPrice));
    bind('qty', state.qty);
    bind('configNet', euro(net));
    bind('configGross', euro(net + vatOf(net)));
    const photo = $('[data-bind-src="photo"]');
    if (!photo.src.endsWith(m.photo)) {
      photo.src = m.photo;
      photo.alt = `Abbattitore Forcar ${m.id} in acciaio inox`;
    }
    document.title = `Abbattitore Forcar ${m.id} ${m.trays} teglie · Bianchi Professional Solutions`;
    extras.forEach((e) => { $(`[data-extra-qty="${e.id}"]`).textContent = state.extras[e.id]; });
    renderRack();
    renderSpecs();
    renderElevation();
    renderCycleText();
    renderChart(false);
  }

  function lineKey(item) {
    return `${item.model.id}|${extras.map((e) => item.extras[e.id] || 0).join(',')}`;
  }

  function addToCart() {
    const item = { model: state.model, extras: { ...state.extras }, qty: state.qty };
    const same = state.cart.find((x) => lineKey(x) === lineKey(item));
    if (same) same.qty += item.qty;
    else state.cart.push(item);
    renderCart();
    openCart();
  }

  function renderCart() {
    const list = $('[data-lines]');
    list.innerHTML = state.cart.map((item, i) => {
      const unit = unitNet(item.model, item.extras);
      const picked = extras.filter((e) => item.extras[e.id] > 0);
      return `
        <li class="line">
          <img src="${item.model.photo}" alt="">
          <div class="line__main">
            <p class="line__name">Abbattitore Forcar ${item.model.id}</p>
            <p class="line__meta">${item.model.trays} teglie · Sonda al cuore inclusa · ${euro(item.model.price)}</p>
            ${picked.length ? `<ul class="line__extras">${picked.map((e) => `<li><span>${item.extras[e.id]} × ${e.name}</span><span>${euro(e.price * item.extras[e.id])}</span></li>`).join('')}</ul>` : ''}
            <div class="line__row">
              <span class="stepper stepper--small" role="group" aria-label="Quantità">
                <button type="button" data-line="${i}" data-step="-1" aria-label="Uno in meno">−</button>
                <output>${item.qty}</output>
                <button type="button" data-line="${i}" data-step="1" aria-label="Uno in più">+</button>
              </span>
              <button type="button" class="line__remove" data-remove="${i}">Rimuovi</button>
              <span class="line__total">${euro(unit * item.qty)} <span class="price__vat">+ IVA</span></span>
            </div>
          </div>
        </li>`;
    }).join('');
    const net = state.cart.reduce((sum, item) => sum + unitNet(item.model, item.extras) * item.qty, 0);
    const vat = vatOf(net);
    bind('cartNet', euro(net));
    bind('cartVat', euro(vat));
    bind('cartGross', euro(net + vat));
    const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
    $('[data-cart-count]').textContent = count;
    $('[data-empty]').hidden = state.cart.length > 0;
    $('[data-totals]').hidden = state.cart.length === 0;
  }

  const sheet = $('[data-sheet]');
  const scrim = $('[data-scrim]');
  let lastFocus = null;

  function openCart() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    scrim.hidden = false;
    $('[data-checkout-note]').hidden = true;
    sheet.getBoundingClientRect();
    document.body.classList.add('has-sheet');
    $('[data-close-cart]').focus({ preventScroll: true });
  }

  function closeCart() {
    document.body.classList.remove('has-sheet');
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;
    setTimeout(() => {
      if (document.body.classList.contains('has-sheet')) return;
      sheet.hidden = true;
      scrim.hidden = true;
    }, delay);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  $('[data-lines]').addEventListener('click', (event) => {
    const step = event.target.closest('[data-line]');
    const remove = event.target.closest('[data-remove]');
    if (step) {
      const item = state.cart[Number(step.dataset.line)];
      item.qty = Math.max(1, item.qty + Number(step.dataset.step));
    } else if (remove) {
      state.cart.splice(Number(remove.dataset.remove), 1);
    } else return;
    renderCart();
  });

  $$('[data-qty]').forEach((b) => b.addEventListener('click', () => {
    state.qty = Math.max(1, state.qty + Number(b.dataset.qty));
    update();
  }));
  $$('[data-add]').forEach((b) => b.addEventListener('click', addToCart));
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
  $('[data-close-cart]').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) closeCart();
  });
  $('[data-checkout]').addEventListener('click', () => { $('[data-checkout-note]').hidden = false; });

  $$('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
    state.cycle = b.dataset.cycle;
    renderCycleText();
    renderChart(true);
  }));

  renderSizes();
  renderExtras();
  update();
  renderCart();

  const chartBox = $('[data-chart]');
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    renderChart(true);
    observer.disconnect();
  }, { threshold: 0.35 }).observe(chartBox);
  let lastWidth = chartBox.clientWidth;
  new ResizeObserver(() => {
    if (chartBox.clientWidth === lastWidth) return;
    lastWidth = chartBox.clientWidth;
    renderChart(false);
  }).observe(chartBox);
})();
