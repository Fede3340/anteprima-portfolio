"use strict";

(() => {
  const FRAMES = [
    { id: "pupilla", name: "Pupilla", shape: "tonda", material: "acetato", colorName: "rosso ciliegia", color: "#a8232f", lens: 46, bridge: 22, temple: 145, height: 42, price: 12900 },
    { id: "iride", name: "Iride", shape: "tonda", material: "metallo", colorName: "oro", color: "#a77d2c", lens: 49, bridge: 21, temple: 145, height: 45, price: 13900 },
    { id: "brace", name: "Brace", shape: "panto", material: "acetato", colorName: "arancio", color: "#c95518", lens: 48, bridge: 20, temple: 140, height: 41, price: 11900 },
    { id: "pianta", name: "Pianta", shape: "squadrata", material: "acetato", colorName: "verde bottiglia", color: "#2c5a3b", lens: 52, bridge: 19, temple: 145, height: 40, price: 14500 },
    { id: "lacrima", name: "Lacrima", shape: "goccia", material: "metallo", colorName: "blu acciaio", color: "#2f4e79", lens: 57, bridge: 15, temple: 140, height: 50, price: 13600 },
    { id: "farfalla", name: "Farfalla", shape: "farfalla", material: "acetato", colorName: "rosa", color: "#c24a6a", lens: 51, bridge: 18, temple: 140, height: 40, price: 14800 },
    { id: "lastra", name: "Lastra", shape: "squadrata", material: "acetato", colorName: "miele", color: "#b9781d", lens: 54, bridge: 18, temple: 150, height: 42, price: 15800 },
    { id: "falena", name: "Falena", shape: "farfalla", material: "acetato", colorName: "prugna", color: "#5a2448", lens: 53, bridge: 17, temple: 140, height: 41, price: 16400 },
  ];

  const SHAPE_LABEL = { tonda: "tonda", panto: "panto", squadrata: "squadrata", goccia: "a goccia", farfalla: "a farfalla" };
  const SHIPPING = 690;
  const FREE_FROM = 25000;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  const money = (cents) => euro.format(cents / 100);
  const frontWidth = (f) => 2 * f.lens + f.bridge;
  const fitOf = (f) => (frontWidth(f) <= 117 ? "stretto" : frontWidth(f) >= 125 ? "largo" : "medio");

  // ---------- drawing ----------

  // Round, panto and square lenses are superellipses; the drop and the cat eye are drawn by key points.
  const SHAPES = {
    tonda: { top: 2, bottom: 2 },
    panto: { top: 3.2, bottom: 2.1 },
    squadrata: { top: 5, bottom: 4.4 },
    goccia: { keys: [[0.02, 0.16], [0.12, 0.03], [0.35, 0], [0.65, 0], [0.88, 0.03], [0.99, 0.14], [1, 0.32], [0.97, 0.52], [0.9, 0.74], [0.78, 0.92], [0.6, 1], [0.4, 0.98], [0.2, 0.86], [0.07, 0.64], [0, 0.4]] },
    farfalla: { keys: [[0, 0], [0, 0], [0.2, 0.06], [0.48, 0.1], [0.76, 0.12], [0.93, 0.18], [1, 0.34], [0.98, 0.6], [0.88, 0.84], [0.7, 0.97], [0.48, 1], [0.27, 0.93], [0.12, 0.74], [0.05, 0.48], [0.02, 0.2]] },
  };

  const catmull = (keys, steps) => keys.flatMap((p1, i) => {
    const n = keys.length;
    const [p0, p2, p3] = [keys[(i - 1 + n) % n], keys[(i + 1) % n], keys[(i + 2) % n]];
    return Array.from({ length: steps }, (_, k) => {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      return [0, 1].map((a) => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3));
    });
  });

  // Outline of the left lens (nose side on the right) fitted exactly into a w x h box.
  const lensPoints = (shape, w, h) => {
    const s = SHAPES[shape];
    const pts = s.keys ? catmull(s.keys, 7) : Array.from({ length: 96 }, (_, i) => {
      const t = (i / 96) * Math.PI * 2;
      const n = Math.sin(t) < 0 ? s.top : s.bottom;
      const e = (v) => Math.sign(v) * Math.abs(v) ** (2 / n);
      return [e(Math.cos(t)), e(Math.sin(t))];
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return pts.map(([x, y]) => [((x - x0) / (x1 - x0)) * w, ((y - y0) / (y1 - y0)) * h]);
  };

  const smoothPath = (pts) => {
    const n = pts.length;
    const f = (v) => v.toFixed(2);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + "Z";
  };

  const darken = (hex, k) => {
    const v = parseInt(hex.slice(1), 16);
    const ch = [v >> 16, (v >> 8) & 255, v & 255].map((c) => Math.round(c * (1 - k)));
    return `rgb(${ch.join(" ")})`;
  };

  // Geometry in millimetres: 1 unit of the viewBox is 1 mm of the real frame.
  const geometry = (f) => {
    const acetate = f.material === "acetato";
    const rim = acetate ? 4.2 : 1.3;
    const end = acetate ? 7 : 5;
    const pad = rim / 2 + (acetate ? 1 : 5);
    const width = 2 * f.lens + f.bridge + 2 * end + rim;
    const height = f.height + 2 * pad;
    const x0 = width / 2 - f.bridge / 2 - f.lens;
    return { acetate, rim, end, pad, width, height, x0, y0: pad };
  };

  const frameMarkup = (f) => {
    const g = geometry(f);
    const { rim, x0, y0, width } = g;
    const h = f.height;
    const pts = lensPoints(f.shape, f.lens, h).map(([x, y]) => [x + x0, y + y0]);
    const lens = smoothPath(pts);
    // point of the outline near one side (nose or temple) closest to a given height
    const edge = (nasal, y) => pts
      .filter(([px]) => (nasal ? px > x0 + f.lens * 0.75 : px < x0 + f.lens * 0.25))
      .reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a));
    const nose = x0 + f.lens;
    const [nx, noseY] = edge(true, y0 + h * (f.shape === "goccia" ? 0.2 : 0.3));
    const [ox, outerY] = edge(false, y0 + h * (f.shape === "farfalla" ? 0.06 : 0.24));
    const parts = [lens, `M${nx} ${noseY}Q${width / 2} ${noseY - h * 0.2} ${width - nx} ${noseY}`, `M${ox + 0.5} ${outerY}L${x0 - g.end} ${outerY - 0.6}`];
    if (f.shape === "goccia") parts.push(`M${x0 + f.lens * 0.55} ${y0 + 0.4}L${width - x0 - f.lens * 0.55} ${y0 + 0.4}`);
    const mirror = `translate(${width} 0) scale(-1 1)`;
    const dark = darken(f.color, 0.38);
    const side = (body) => `<g>${body}</g><g transform="${mirror}">${body}</g>`;
    const glass = side(`<path d="${lens}" fill="#fff" fill-opacity=".5"/><path d="M${x0 + f.lens * 0.2} ${y0 + h * 0.3}q${f.lens * 0.12} ${-h * 0.14} ${f.lens * 0.3} ${-h * 0.12}" fill="none" stroke="${dark}" stroke-opacity=".28" stroke-width=".5" stroke-linecap="round"/>`);
    let extra = "";
    if (g.acetate) {
      extra = side(`<circle cx="${ox - 1.8}" cy="${outerY - 0.2}" r=".65" fill="#efe9dc"/><circle cx="${ox + 0.9}" cy="${outerY - 0.1}" r=".65" fill="#efe9dc"/>`);
    } else {
      extra = side(`<path d="M${nose - 1} ${y0 + h * 0.42}q-1.6 2 -2.6 5" fill="none" stroke="${dark}" stroke-width=".6" stroke-linecap="round"/><ellipse cx="${nose - 4}" cy="${y0 + h * 0.6}" rx="2" ry="3.4" fill="#fff" fill-opacity=".6" stroke="${dark}" stroke-width=".5"/>`);
    }
    // the bridge is drawn once across the middle, the rest is mirrored
    const bridgeOnly = (w, c) => `<path d="${parts[1]}" fill="none" stroke="${c}" stroke-width="${g.acetate ? w : w * 0.9}" stroke-linecap="round"/>`;
    const sideParts = (w, c) => parts.filter((_, i) => i !== 1).map((d) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const inner = g.acetate ? rim - 0.7 : rim - 0.5;
    return glass + side(sideParts(rim, dark)) + bridgeOnly(rim, dark) + side(sideParts(inner, f.color)) + bridgeOnly(inner, f.color) + extra;
  };

  const svg = (attrs, inner) => {
    const el = document.createElementNS(SVG_NS, "svg");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.innerHTML = inner;
    return el;
  };

  const sprite = svg({ width: 0, height: 0, style: "position:absolute", "aria-hidden": "true" }, FRAMES.map((f) => {
    const g = geometry(f);
    return `<symbol id="f-${f.id}" viewBox="0 0 ${g.width.toFixed(2)} ${g.height.toFixed(2)}">${frameMarkup(f)}</symbol>`;
  }).join(""));
  document.body.prepend(sprite);

  const useFrame = (f, cls) => {
    const g = geometry(f);
    return svg({ class: cls, viewBox: `0 0 ${g.width.toFixed(2)} ${g.height.toFixed(2)}`, "aria-hidden": "true", focusable: "false" }, `<use href="#f-${f.id}"/>`);
  };

  // Technical drawing for the product sheet: front with lens and bridge, and the temple straightened.
  const drawingMarkup = (f) => {
    const g = geometry(f);
    const left = g.x0;
    const right = g.x0 + f.lens;
    const bR = g.width - g.x0 - f.lens;
    const top = -9;
    const below = g.height + 9;
    const templeY = g.height + 30;
    const startX = (g.width - f.temple) / 2;
    const dim = (x1, x2, y, label) => `
      <path d="M${x1} ${y}H${x2}M${x1} ${y - 2.2}v4.4M${x2} ${y - 2.2}v4.4" stroke="#000" stroke-width=".35" fill="none"/>
      <text x="${(x1 + x2) / 2}" y="${y - 2.6}" text-anchor="middle">${label}</text>`;
    const guide = (x, y1, y2) => `<path d="M${x} ${y1}V${y2}" stroke="#000" stroke-width=".25" stroke-dasharray="1 1.2"/>`;
    const vbTop = -17;
    const vbH = templeY + 12 - vbTop;
    return `<svg viewBox="-4 ${vbTop} ${(g.width + 8).toFixed(2)} ${vbH.toFixed(2)}" role="img" aria-label="Disegno quotato di ${f.name}: calibro ${f.lens} millimetri, ponte ${f.bridge}, asta ${f.temple}" font-family="Lexend, sans-serif" font-size="5.2" font-weight="500">
      <use href="#f-${f.id}" width="${g.width}" height="${g.height}"/>
      <rect x="${left}" y="${g.y0}" width="${f.lens}" height="${f.height}" fill="none" stroke="#000" stroke-width=".25" stroke-dasharray="1 1.2"/>
      ${guide(left, top, g.y0)}${guide(right, top, g.y0)}
      ${dim(left, right, top, `calibro ${f.lens}`)}
      ${guide(right, g.y0 + f.height, below)}${guide(bR, g.y0 + f.height * 0.5, below)}
      ${dim(right, bR, below, "")}
      <text x="${(right + bR) / 2}" y="${below + 6.5}" text-anchor="middle">ponte ${f.bridge}</text>
      <path d="M${startX} ${templeY}H${startX + f.temple - 2}" stroke="${f.color}" stroke-width="${g.acetate ? 3.2 : 1.4}" stroke-linecap="round"/>
      <rect x="${startX - 1}" y="${templeY - 2.4}" width="5" height="4.8" rx="1" fill="${darken(f.color, 0.38)}"/>
      ${dim(startX, startX + f.temple, templeY - 5, `asta ${f.temple}, con la curva raddrizzata`)}
    </svg>`;
  };

  const templePrint = (f) =>
    `<span class="temple-print" style="--c:${f.color}" role="img" aria-label="calibro ${f.lens}, ponte ${f.bridge}, asta ${f.temple} millimetri"><span>${f.lens}</span><span class="sq"></span><span>${f.bridge}</span><span class="gap"></span><span>${f.temple}</span></span>`;

  const kind = (f) => `${SHAPE_LABEL[f.shape]}, ${f.material}, ${f.colorName}`;

  // ---------- catalogue ----------

  const list = document.querySelector(".frames");
  const items = new Map();
  for (const f of FRAMES) {
    const li = document.createElement("li");
    li.className = "frame";
    li.dataset.fit = fitOf(f);
    li.innerHTML = `
      <button class="frame-art" type="button" aria-label="Scheda e misure di ${f.name}" style="--w:${geometry(f).width.toFixed(2)}"></button>
      <div class="frame-info">
        <h3>${f.name}</h3>
        <p class="price">${money(f.price)}</p>
        <p class="frame-kind">${kind(f)}</p>
        <p class="temple">${templePrint(f)}</p>
        <div class="frame-actions">
          <button class="link-btn" type="button" data-sheet>Scheda e misure</button>
          <button class="btn" type="button" data-add>Aggiungi</button>
        </div>
      </div>`;
    li.querySelector(".frame-art").append(useFrame(f, "soft"), useFrame(f, "sharp"));
    li.querySelector(".frame-art").addEventListener("click", () => openSheet(f));
    li.querySelector("[data-sheet]").addEventListener("click", () => openSheet(f));
    li.querySelector("[data-add]").addEventListener("click", () => addToCart(f));
    list.append(li);
    items.set(li, f);
  }

  const empty = document.querySelector(".frames-empty");
  document.querySelector(".fit").addEventListener("change", (e) => {
    const value = e.target.value;
    let shown = 0;
    for (const li of items.keys()) {
      li.hidden = value !== "tutte" && li.dataset.fit !== value;
      if (!li.hidden) shown++;
    }
    empty.hidden = shown > 0;
  });

  // ---------- focus: the frame in the middle of the screen, or under the pointer ----------

  if (!reduced) {
    let centred = null;
    let pointed = null;
    const apply = () => {
      const target = pointed || centred;
      for (const li of items.keys()) li.classList.toggle("is-focus", li === target);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) centred = e.target;
      apply();
    }, { rootMargin: "-42% 0px -42% 0px" });
    for (const li of items.keys()) io.observe(li);

    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const ring = document.querySelector(".ring");
      const rack = document.querySelector(".rack");
      for (const li of items.keys()) {
        li.addEventListener("pointerenter", () => { pointed = li; apply(); });
        li.addEventListener("pointerleave", () => { pointed = null; apply(); });
      }
      rack.addEventListener("pointermove", (e) => {
        ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        ring.classList.add("on");
      });
      rack.addEventListener("pointerleave", () => ring.classList.remove("on"));
    }
  }

  // ---------- hero lenses ----------

  const hero = document.querySelector(".hero");
  const chart = hero.querySelector(".chart");
  const lenses = [...hero.querySelectorAll(".lens")];

  if (reduced) {
    lenses.forEach((l) => l.remove());
  } else {
    for (const lens of lenses) {
      const copy = chart.cloneNode(true);
      copy.querySelector("[id]")?.removeAttribute("id");
      lens.querySelector(".lens-view").append(copy);
    }
    let d = 0, gap = 0, rest = { x: 0, y: 0 }, pos = { x: 0, y: 0 }, target = { x: 0, y: 0 }, origin = { x: 0, y: 0 }, raf = 0;

    const place = () => {
      lenses.forEach((lens, i) => {
        const x = pos.x - gap / 2 - d + i * (d + gap);
        const y = pos.y - d / 2;
        lens.style.transform = `translate(${x}px, ${y}px)`;
        lens.firstElementChild.style.transform = `translate(${origin.x - x}px, ${origin.y - y}px)`;
      });
    };
    const measure = () => {
      d = lenses[0].offsetWidth;
      gap = Math.max(12, d * 0.14);
      for (const lens of lenses) lens.querySelector(".chart").style.width = `${chart.offsetWidth}px`;
      origin = { x: chart.offsetLeft, y: chart.offsetTop };
      const words = chart.querySelector(".l1");
      rest = { x: hero.clientWidth / 2, y: words.offsetTop + chart.offsetTop + words.offsetHeight * 0.62 };
      pos = { ...rest };
      target = { ...rest };
      place();
    };
    const tick = () => {
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      place();
      raf = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const go = (x, y) => {
      target = { x, y };
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const local = (e) => {
      const r = hero.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      hero.addEventListener("pointermove", (e) => { const p = local(e); go(p.x, p.y); });
      hero.addEventListener("pointerleave", () => go(rest.x, rest.y));
    } else {
      let grab = null;
      for (const lens of lenses) {
        lens.addEventListener("pointerdown", (e) => {
          const p = local(e);
          grab = { dx: pos.x - p.x, dy: pos.y - p.y };
          lens.setPointerCapture(e.pointerId);
        });
        lens.addEventListener("pointermove", (e) => {
          if (!grab) return;
          const p = local(e);
          pos = { x: p.x + grab.dx, y: p.y + grab.dy };
          target = { ...pos };
          place();
        });
        lens.addEventListener("pointerup", () => { grab = null; });
        lens.addEventListener("pointercancel", () => { grab = null; });
      }
    }
    document.fonts.ready.then(measure);
    measure();
    new ResizeObserver(measure).observe(hero);
  }

  // ---------- dialogs ----------

  const sheet = document.getElementById("sheet");
  const cartDialog = document.getElementById("cart");
  for (const dlg of [sheet, cartDialog]) {
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }

  let sheetFrame = null;
  const openSheet = (f) => {
    sheetFrame = f;
    sheet.querySelector(".sheet-kind").textContent = kind(f);
    sheet.querySelector("h2").textContent = f.name;
    sheet.querySelector(".sheet-price").textContent = money(f.price);
    sheet.querySelector(".drawing").innerHTML = drawingMarkup(f);
    sheet.querySelector(".measures").innerHTML = `
      <div><dt><b>${f.lens}</b>calibro</dt><dd>La larghezza di una lente: la distanza tra i lati verticali del rettangolo che contiene la sua forma.</dd></div>
      <div><dt><b>${f.bridge}</b>ponte</dt><dd>La distanza tra le due lenti, presa tra i loro lati verso il naso. È il tratto che poggia sul naso.</dd></div>
      <div><dt><b>${f.temple}</b>asta</dt><dd>La lunghezza della stanghetta, dalla cerniera alla punta, con la curva dietro l’orecchio raddrizzata.</dd></div>`;
    sheet.querySelector(".sheet-fit").textContent = `Frontale stimato: ${frontWidth(f)} mm più le cerniere, viso ${fitOf(f)}. Tutte le misure sono in millimetri.`;
    if (!sheet.open) sheet.showModal();
  };
  sheet.querySelector(".sheet-add").addEventListener("click", () => { sheet.close(); addToCart(sheetFrame); });

  // ---------- cart ----------

  const cart = new Map();
  const count = document.querySelector(".cart-count");
  const lines = cartDialog.querySelector(".cart-lines");
  const payNote = cartDialog.querySelector(".pay-note");

  const totals = () => {
    let goods = 0, pieces = 0;
    for (const [f, q] of cart) { goods += f.price * q; pieces += q; }
    const ship = goods === 0 || goods >= FREE_FROM ? 0 : SHIPPING;
    return { items: goods, pieces, ship, all: goods + ship };
  };

  const renderCart = () => {
    const t = totals();
    count.textContent = t.pieces;
    lines.replaceChildren();
    for (const [f, q] of cart) {
      const li = document.createElement("li");
      li.className = "cart-line";
      li.innerHTML = `
        <h3>${f.name}</h3>
        <p class="line-total">${money(f.price * q)}</p>
        <div class="qty">
          <button type="button" data-step="-1" aria-label="Una ${f.name} in meno">−</button>
          <output aria-live="polite">${q}</output>
          <button type="button" data-step="1" aria-label="Una ${f.name} in più">+</button>
        </div>
        <button class="link-btn remove" type="button">Rimuovi</button>`;
      li.prepend(useFrame(f, ""));
      li.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
        const next = cart.get(f) + Number(b.dataset.step);
        if (next > 0) cart.set(f, next); else cart.delete(f);
        payNote.textContent = "";
        renderCart();
      }));
      li.querySelector(".remove").addEventListener("click", () => { cart.delete(f); payNote.textContent = ""; renderCart(); });
      lines.append(li);
    }
    cartDialog.querySelector(".cart-empty").hidden = t.pieces > 0;
    cartDialog.querySelector(".sums").hidden = t.pieces === 0;
    cartDialog.querySelector(".pay").hidden = t.pieces === 0;
    cartDialog.querySelector(".sum-items").textContent = money(t.items);
    cartDialog.querySelector(".sum-ship").textContent = t.ship ? money(t.ship) : "gratuita";
    cartDialog.querySelector(".sum-all").textContent = money(t.all);
    cartDialog.querySelector(".ship-note").textContent = t.pieces === 0 ? "" : t.items >= FREE_FROM
      ? "Spedizione gratuita da 250 €."
      : `Mancano ${money(FREE_FROM - t.items)} alla spedizione gratuita.`;
  };

  const addToCart = (f) => {
    cart.set(f, (cart.get(f) || 0) + 1);
    payNote.textContent = "";
    renderCart();
    count.classList.remove("bump");
    void count.offsetWidth;
    count.classList.add("bump");
    if (!cartDialog.open) cartDialog.showModal();
  };

  cartDialog.querySelector(".pay").addEventListener("click", () => {
    payNote.textContent = `Pagamento finto: questo negozio è un concept, quindi non parte nessun ordine e non si paga niente. Il totale sarebbe ${money(totals().all)}.`;
  });
  document.querySelector(".cart-toggle").addEventListener("click", () => cartDialog.showModal());

  renderCart();
})();
