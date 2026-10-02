/* The Discovery Stack — narrative sections. */
(function () {
  const ST = window.STORY;
  const css = getComputedStyle(document.documentElement);
  const v = name => css.getPropertyValue(name).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const srcLink = s => `<a href="${s.url}" target="_blank" rel="noopener">Source ↗</a>`;
  const onVisible = (el, fn, threshold = 0.25) => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } }), { threshold });
    io.observe(el);
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Hero fade + jump pill ───────────────── */
  Net.drawBackground(document.getElementById("hero-bg"));
  const heroInner = document.querySelector(".hero_inner"), jump = document.getElementById("jump"), explore = document.getElementById("explore");
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const p = Math.min(1, scrollY / (0.45 * innerHeight));
      heroInner.style.opacity = 1 - p;
      heroInner.style.filter = `blur(${p * 24}px)`;
      const mapTop = explore.getBoundingClientRect().top;
      jump.hidden = scrollY < innerHeight * 0.9 || mapTop < innerHeight * 0.2;
      ticking = false;
    });
  }, { passive: true });

  /* ── History: era strip + milestone cards ── */
  (function history() {
    const eras = ST.eras, ms = ST.milestones.slice().sort((a, b) => a.y - b.y);
    const svg = d3.select("#hist-strip"), W = 1200, bandW = (W - 40) / eras.length, base = 112;
    const xOf = y => { const i = eras.findIndex(e => y >= e.from && y < e.to); const e = eras[i < 0 ? eras.length - 1 : i];
      return 20 + (i < 0 ? eras.length - 1 : i) * bandW + Math.min(1, (y - e.from) / (e.to - e.from)) * bandW; };
    const band = svg.append("g").selectAll("g").data(eras).join("g").attr("class", "era_band").attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", e => `${e.name}, ${e.span}`);
    band.append("rect").attr("x", (_, i) => 20 + i * bandW + 2).attr("y", 18).attr("width", bandW - 4).attr("height", 128).attr("rx", 10);
    band.append("text").attr("class", "era_lbl").attr("x", (_, i) => 20 + i * bandW + 12).attr("y", 38).text(e => e.name);
    band.append("text").attr("class", "era_span").attr("x", (_, i) => 20 + i * bandW + 12).attr("y", 55).text(e => e.span);
    svg.append("line").attr("class", "hist_axis").attr("x1", 20).attr("x2", W - 20).attr("y1", base + 14).attr("y2", base + 14);
    // stack dots that would overlap
    const placed = [];
    ms.forEach(m => { m.x = xOf(m.y); let lane = 0; while (placed.some(p => p.lane === lane && Math.abs(p.x - m.x) < 13)) lane++; m.lane = lane; placed.push(m); m.cy = base - lane * 14; });
    const dots = svg.append("g").selectAll("g").data(ms).join("g").attr("class", m => `ms_dot ${m.kind || "m"}`)
      .attr("transform", m => `translate(${m.x},${m.cy})`).attr("tabindex", 0).attr("role", "button").attr("aria-label", m => `${Math.floor(m.y)}: ${m.t}`);
    dots.append("circle").attr("r", m => (m.kind === "claude" ? 6.5 : 5.5));
    const tabs = document.getElementById("era-tabs"), head = document.getElementById("era-head"), row = document.getElementById("ms-row");
    tabs.innerHTML = eras.map((e, i) => `<button data-i="${i}">${esc(e.name)}<small>${esc(e.span)}</small></button>`).join("");
    let cur = -1;
    function showEra(i, focusIdx) {
      const e = eras[i];
      if (cur !== i) {
        cur = i;
        tabs.querySelectorAll("button").forEach((b, j) => b.classList.toggle("active", j === i));
        band.classed("active", (_, j) => j === i);
        dots.classed("dim", m => m.era !== e.id);
        head.innerHTML = `<p class="era_theme">${esc(e.theme)}</p><p class="era_thread"><img src="img/spark.svg" alt="" width="16" height="16"><span><b>Thread to Claude</b> ${esc(e.thread)}</span></p>`;
        const list = ms.filter(m => m.era === e.id);
        row.innerHTML = list.map(m => `<article class="ms_card ${m.kind || "m"}" data-y="${m.y}">
          <span class="ms_year">${Math.floor(m.y)}${m.kind === "lesson" ? " · Lesson learned" : m.kind === "claude" ? " · Claude" : ""}</span>
          <h4>${esc(m.t)}</h4><p class="ms_who">${esc(m.who)}</p><p>${esc(m.what)}</p><p class="ms_why">${esc(m.why)}</p>${srcLink(m.src)}</article>`).join("");
        row.scrollLeft = 0;
      }
      dots.classed("sel", m => focusIdx != null && m === focusIdx);
      if (focusIdx) {
        const card = row.querySelector(`[data-y="${focusIdx.y}"]`);
        row.querySelectorAll(".ms_card").forEach(c => c.classList.toggle("sel", c === card));
        if (card) row.scrollTo({ left: card.offsetLeft - row.offsetLeft - 8, behavior: reduced ? "auto" : "smooth" });
      }
    }
    tabs.querySelectorAll("button").forEach(b => b.onclick = () => showEra(+b.dataset.i));
    band.on("click", (_, e) => showEra(eras.indexOf(e))).on("keydown", (ev, e) => { if (ev.key === "Enter") showEra(eras.indexOf(e)); });
    dots.on("click", (ev, m) => { ev.stopPropagation(); showEra(eras.findIndex(e => e.id === m.era), m); })
      .on("keydown", (ev, m) => { if (ev.key === "Enter") showEra(eras.findIndex(e => e.id === m.era), m); });
    const tip = d3.select("#hist-tip");
    dots.on("mouseenter", (ev, m) => {
      const r = svg.node().getBoundingClientRect(), sc = r.width / W;
      tip.html(`<b>${Math.floor(m.y)}</b> ${esc(m.t)}`).style("left", `${m.x * sc}px`).style("top", `${(m.cy - 14) * sc}px`).attr("hidden", null);
    }).on("mouseleave", () => tip.attr("hidden", true));
    document.getElementById("ms-prev").onclick = () => row.scrollBy({ left: -row.clientWidth * 0.8, behavior: "smooth" });
    document.getElementById("ms-next").onclick = () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: "smooth" });
    showEra(0);
  })();

  /* ── Explorers across time ───────────────── */
  (function explorers() {
    const svg = d3.select("#explorers-svg"), card = document.getElementById("explorer-card");
    const xOf = d3.scaleLinear().domain([1960, 2010, 2027]).range([70, 360, 930]);
    const nodes = ST.explorers.nodes, byId = new Map(nodes.map(n => [n.id, n]));
    nodes.forEach(n => { n.x = xOf(n.year); n.y = 60 + n.lane * 470; });
    const axisY = 600;
    const ax = svg.append("g").attr("class", "ex_axis");
    ax.append("line").attr("x1", 40).attr("x2", 970).attr("y1", axisY).attr("y2", axisY);
    [1960, 1970, 1980, 1990, 2000, 2010, 2015, 2020, 2025].forEach(y => {
      ax.append("line").attr("x1", xOf(y)).attr("x2", xOf(y)).attr("y1", axisY - 4).attr("y2", axisY + 4);
      ax.append("text").attr("x", xOf(y)).attr("y", axisY + 20).text(y);
    });
    const links = ST.explorers.links.map(([a, b]) => ({ s: byId.get(a), t: byId.get(b) }));
    const linkSel = svg.append("g").selectAll("path").data(links).join("path").attr("class", "ex_link")
      .attr("d", l => { const mx = (l.s.x + l.t.x) / 2; return `M${l.s.x},${l.s.y} C${mx},${l.s.y} ${mx},${l.t.y} ${l.t.x},${l.t.y}`; });
    const g = svg.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", n => `ex_node ${n.kind || "person"}${n.id === "claude" ? " anth" : ""}`)
      .attr("transform", n => `translate(${n.x},${n.y})`).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", n => `${n.name}, ${n.role}`);
    const R = n => (n.id === "claude" ? 30 : 22);
    g.append("circle").attr("class", "ring").attr("r", R);
    g.filter(n => n.id !== "claude").append("text").attr("class", "mono")
      .text(n => n.initials || n.name.split(" ").map(w => w[0]).filter(c => /[A-ZÉ]/.test(c)).slice(0, 2).join(""));
    g.filter(n => n.id === "claude").append("image").attr("href", "img/spark-white.svg").attr("x", -16).attr("y", -16).attr("width", 32).attr("height", 32);
    g.append("text").attr("class", "nm").attr("y", n => R(n) + 15).text(n => n.name);
    g.append("text").attr("class", "rl").attr("y", n => R(n) + 29).text(n => n.role);

    function focus(n) {
      const lit = new Set(n ? [n, ...links.filter(l => l.s === n || l.t === n).flatMap(l => [l.s, l.t])] : []);
      svg.classed("focus", !!n);
      g.classed("lit", m => lit.has(m)).classed("sel", m => m === n);
      linkSel.classed("on", l => n && (l.s === n || l.t === n));
    }
    let sel = null;
    function open(n) {
      sel = n; focus(n);
      card.querySelector(".explorer_card_body").innerHTML = `<h3>${esc(n.name)}</h3><p class="sub">${esc(n.role)}</p>` +
        n.sections.map(([h, items]) => `<h5>${esc(h)}</h5><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("");
      card.classList.toggle("left", n.x > 500);
      card.hidden = false;
    }
    function close() { sel = null; card.hidden = true; focus(null); }
    new IntersectionObserver(es => { if (!es[0].isIntersecting && sel) close(); }).observe(document.getElementById("explorers"));
    g.on("mouseenter", (_, n) => { if (!sel) focus(n); }).on("mouseleave", () => { if (!sel) focus(null); })
      .on("click", (ev, n) => { ev.stopPropagation(); sel === n ? close() : open(n); })
      .on("keydown", (ev, n) => { if (ev.key === "Enter") open(n); });
    card.querySelector(".close").onclick = close;
    svg.on("click", close);
  })();

  /* ── AI-discovered medicines: pipeline ───── */
  (function pipeline() {
    const P = ST.pipeline, el = document.getElementById("pipeline");
    const colors = { gen: v("--e-uses"), phys: v("--e-data"), pheno: v("--e-builds"), repo: v("--e-research") };
    const nameOf = id => P.approaches.find(a => a.id === id).name;
    document.getElementById("pipe-legend").innerHTML = P.approaches.map(a => `<span><i style="background:${colors[a.id]}"></i>${esc(a.name)}</span>`).join("") +
      `<span><i class="stop"></i>Discontinued</span>`;
    el.innerHTML = `<div class="pipe_head"><span></span>${P.stages.map(st => `<span>${esc(st)}</span>`).join("")}</div>` +
      P.drugs.map((d, i) => `<div class="pipe_row${d.stopped ? " stopped" : ""}" data-i="${i}">
        <button class="pipe_name" aria-expanded="false"><b>${esc(d.name)}</b><small>${esc(d.org)}</small></button>
        <div class="pipe_track"><div class="pipe_bar" style="--w:${((d.stage + 0.5) / P.stages.length) * 100}%;--c:${d.stopped ? "var(--line)" : colors[d.approach]}"><i></i></div></div>
        <div class="pipe_more"><span class="pipe_tag" style="--c:${colors[d.approach]}">${esc(nameOf(d.approach))}</span> ${esc(d.note)} ${srcLink(d.src)}</div>
      </div>`).join("");
    el.querySelectorAll(".pipe_row").forEach(r => {
      const b = r.querySelector(".pipe_name");
      const toggle = () => { const o = r.classList.toggle("open"); b.setAttribute("aria-expanded", o); };
      b.onclick = toggle; r.querySelector(".pipe_track").onclick = toggle;
    });
    if (!reduced) { el.classList.add("pre"); onVisible(el, () => setTimeout(() => el.classList.remove("pre"), 100), 0.2); }
    document.getElementById("pipe-stats").innerHTML = P.stats.map(st => `<div class="stat"><b>${esc(st.value)}</b><span>${esc(st.label)}</span></div>`).join("");
    document.getElementById("pipe-src").innerHTML = "Sources: " + P.statSrc.map(x => `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(" · ");
  })();

  /* ── From weeks to minutes ───────────────── */
  (function accelerations() {
    const list = document.getElementById("accel-list");
    ST.accelerations.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "accel_row";
      row.innerHTML = `
        <div class="accel_end before"><div class="accel_badge">${esc(a.before)}</div><small>Before</small></div>
        <div class="accel_mid">
          <svg viewBox="0 0 400 70"><path class="arc" d="M8,60 Q200,-10 392,60"/><path class="head" d="M392,60 l-12,-3 l5,-8z"/><circle class="runner" r="7" cx="8" cy="60"/></svg>
          <p class="accel_who">${esc(a.who)}</p>
          <p class="accel_task">${esc(a.task)}</p>
          <p class="accel_note">${esc(a.note)} ${srcLink(a.src)}</p>
        </div>
        <div class="accel_end after"><div class="accel_badge">${esc(a.after)}</div><small>With Claude</small></div>`;
      list.appendChild(row);
      const after = row.querySelector(".after .accel_badge"), runner = row.querySelector(".runner"), path = row.querySelector(".arc");
      if (reduced) return;
      after.style.transform = "scale(.4)"; after.style.opacity = "0";
      onVisible(row, () => {
        const L = path.getTotalLength(), t0 = performance.now() + i * 120, dur = 1800;
        (function step(now) {
          const p = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3), pt = path.getPointAtLength(e * L);
          runner.setAttribute("cx", pt.x); runner.setAttribute("cy", pt.y);
          if (p < 1) requestAnimationFrame(step);
          else { after.style.transition = "transform .5s cubic-bezier(.3,1.6,.5,1), opacity .3s"; after.style.transform = "none"; after.style.opacity = "1"; }
        })(performance.now());
      }, 0.4);
    });
  })();

  /* ── Research loop ───────────────────────── */
  (function loop() {
    const svg = d3.select("#loop-svg"), detail = document.getElementById("loop-detail");
    const C = 280, R = 190, steps = ST.loop, n = steps.length;
    const pos = i => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [C + R * Math.cos(a), C + R * Math.sin(a)]; };
    svg.append("defs").append("marker").attr("id", "loop-arr").attr("viewBox", "0 -4 8 8").attr("refX", 6).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", v("--line"));
    steps.forEach((_, i) => {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / n + 0.3, a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / n - 0.3;
      svg.append("path").attr("class", "loop_arc").attr("marker-end", "url(#loop-arr)")
        .attr("d", `M${C + R * Math.cos(a0)},${C + R * Math.sin(a0)} A${R},${R} 0 0 1 ${C + R * Math.cos(a1)},${C + R * Math.sin(a1)}`);
    });
    svg.append("image").attr("href", "img/spark.svg").attr("x", C - 26).attr("y", C - 60).attr("width", 52).attr("height", 52);
    svg.append("text").attr("class", "loop_center").attr("x", C).attr("y", C + 22).text("Claude at every step");
    svg.append("text").attr("class", "loop_center").attr("x", C).attr("y", C + 48).style("font-size", "14px").style("fill", v("--muted")).text("scientists at the bench");
    const g = svg.selectAll(".loop_step").data(steps).join("g").attr("class", d => `loop_step${d.id === "test" ? " human" : ""}`)
      .attr("transform", (_, i) => `translate(${pos(i)})`).attr("tabindex", 0).attr("role", "button");
    g.append("circle").attr("r", 52);
    g.append("text").attr("class", "num").attr("y", -16).text((_, i) => `0${i + 1}`);
    g.append("text").attr("y", 6).text(d => d.name);
    let idx = 0, timer = null;
    function show(i) {
      idx = i; g.classed("active", (_, j) => j === i);
      detail.innerHTML = `<span class="n">Step 0${i + 1} of 0${n}</span><h3>${esc(steps[i].name)}</h3><p>${esc(steps[i].text)}</p>`;
    }
    const start = () => { if (!reduced && !timer) timer = setInterval(() => show((idx + 1) % n), 3200); };
    const stop = () => { clearInterval(timer); timer = null; };
    g.on("click", (_, d) => { stop(); show(steps.indexOf(d)); }).on("keydown", (ev, d) => { if (ev.key === "Enter") { stop(); show(steps.indexOf(d)); } });
    show(0);
    onVisible(document.getElementById("loop"), start, 0.3);
  })();

  /* ── Connected lab flow ──────────────────── */
  (function flow() {
    const F = ST.flow, svg = d3.select("#flow-svg"), colX = [260, 480, 700, 890];
    const fills = [v("--z-labs"), v("--z-research"), v("--clay"), v("--z-pharma")];
    F.columns.forEach((c, i) => svg.append("text").attr("class", "flow_col").attr("x", i === 0 ? colX[i] - 60 : i === 3 ? colX[i] + 70 : colX[i]).attr("y", 22).text(c));
    const cols = F.columns.map((_, i) => F.nodes.filter(n => n.col === i));
    cols.forEach(list => list.forEach((n, j) => { n.x = colX[n.col]; n.y = 80 + (j + 0.5) * (460 / list.length); }));
    const byId = new Map(F.nodes.map(n => [n.id, n]));
    const links = F.links.map(([a, b]) => ({ s: byId.get(a), t: byId.get(b) }));
    const linkSel = svg.append("g").selectAll("path").data(links).join("path").attr("class", "flow_link")
      .attr("d", l => { const mx = (l.s.x + l.t.x) / 2; return `M${l.s.x},${l.s.y} C${mx},${l.s.y} ${mx},${l.t.y} ${l.t.x},${l.t.y}`; });
    const g = svg.append("g").selectAll("g").data(F.nodes).join("g").attr("class", "flow_node")
      .attr("transform", n => `translate(${n.x},${n.y})`).attr("tabindex", 0);
    g.append("circle").attr("r", n => (n.col === 2 ? 22 : 16)).attr("fill", n => fills[n.col]);
    const r = n => (n.col === 2 ? 22 : 16);
    const lx = n => (n.col === 0 ? -r(n) - 10 : n.col === 3 ? r(n) + 10 : 0);
    const ly = n => (n.col === 0 || n.col === 3 ? -3 : -r(n) - 22);
    const anchor = n => (n.col === 0 ? "end" : n.col === 3 ? "start" : "middle");
    g.append("text").attr("class", "t").attr("x", lx).attr("y", ly).attr("text-anchor", anchor).text(n => n.name);
    g.append("text").attr("class", "s").attr("x", lx).attr("y", n => ly(n) + 16).attr("text-anchor", anchor).text(n => n.sub);
    // trace up- and downstream
    function trace(n) {
      if (!n) { svg.classed("focus", false); g.classed("lit", false); linkSel.classed("lit", false); return; }
      const lit = new Set([n]), litL = new Set();
      const walk = (m, dir) => links.forEach(l => { const [a, b] = dir > 0 ? [l.s, l.t] : [l.t, l.s]; if (a === m && !litL.has(l)) { litL.add(l); lit.add(b); walk(b, dir); } });
      walk(n, 1); walk(n, -1);
      svg.classed("focus", true); g.classed("lit", m => lit.has(m)); linkSel.classed("lit", l => litL.has(l));
    }
    let pinned = null;
    g.on("mouseenter", (_, n) => { if (!pinned) trace(n); }).on("mouseleave", () => { if (!pinned) trace(null); })
      .on("click", (ev, n) => { ev.stopPropagation(); pinned = pinned === n ? null : n; trace(pinned); })
      .on("focus", (_, n) => trace(n)).on("blur", () => trace(pinned));
    svg.on("click", () => { pinned = null; trace(null); });

    const stats = document.getElementById("stats");
    stats.innerHTML = F.stats.map(s => `<div class="stat"><b data-v="${esc(s.value)}">${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("");
    if (!reduced) onVisible(stats, () => stats.querySelectorAll("b").forEach(b => {
      const raw = b.dataset.v, num = parseFloat(raw.replace(/,/g, "")), suffix = raw.replace(/[\d,]/g, ""), t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(num * e).toLocaleString("en-US") + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }));
  })();

  /* ── Five frontiers ──────────────────────── */
  (function frontiers() {
    const svg = d3.select("#frontiers-illus"), cards = document.getElementById("frontier-cards");
    const fill = { design: v("--z-biotech"), cell: v("--z-research"), genome: v("--z-labs"), agents: "#EBC9A0", clinic: v("--z-pharma") };
    const ink = v("--slate"), clay = v("--clay");
    svg.append("path").attr("d", "M0,470 C300,440 600,500 1200,455 L1200,520 L0,520Z").attr("fill", v("--pampas"));
    const st = sel => sel.attr("stroke", ink).attr("stroke-width", 2);
    const art = {
      genome(g) { // DNA helix + lens
        for (let i = 0; i < 9; i++) { const y = i * 26, s = Math.sin(i * 0.8) * 34;
          g.append("line").attr("x1", -s).attr("y1", y).attr("x2", s).attr("y2", y).attr("stroke", ink).attr("stroke-width", 2);
          st(g.append("circle").attr("cx", -s).attr("cy", y).attr("r", 7).attr("fill", fill.genome)).attr("stroke-width", 1.5);
          st(g.append("circle").attr("cx", s).attr("cy", y).attr("r", 7).attr("fill", clay)).attr("stroke-width", 1.5); }
        g.append("circle").attr("cx", 46).attr("cy", 150).attr("r", 40).attr("fill", "#ffffff66").attr("stroke", ink).attr("stroke-width", 3);
        g.append("line").attr("x1", 74).attr("y1", 180).attr("x2", 110).attr("y2", 220).attr("stroke", ink).attr("stroke-width", 8).attr("stroke-linecap", "round");
      },
      design(g) { // protein ribbon of beads
        const pts = d3.range(26).map(i => [Math.cos(i * 0.62) * (50 + i * 3), Math.sin(i * 0.62) * (40 + i * 2) + i * 4]);
        g.append("path").attr("d", d3.line().curve(d3.curveCatmullRom)(pts)).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 3);
        pts.forEach((p, i) => st(g.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", i % 4 ? 7 : 11).attr("fill", i % 3 ? fill.design : clay)).attr("stroke-width", 1.5));
      },
      cell(g) { // a cell: membrane, nucleus, organelles
        st(g.append("ellipse").attr("rx", 92).attr("ry", 74).attr("fill", fill.cell));
        st(g.append("circle").attr("cx", -14).attr("cy", -6).attr("r", 30).attr("fill", "#fff"));
        st(g.append("circle").attr("cx", -10).attr("cy", -10).attr("r", 10).attr("fill", clay));
        [[44, -30, 14, 7], [52, 24, 18, 8], [-50, 38, 16, 7], [10, 48, 12, 6]].forEach(([x, y, rx, ry]) => st(g.append("ellipse").attr("cx", x).attr("cy", y).attr("rx", rx).attr("ry", ry).attr("fill", "#fff")).attr("stroke-width", 1.5));
        d3.range(7).forEach(i => g.append("circle").attr("cx", -70 + i * 22).attr("cy", -58 + (i % 2) * 6).attr("r", 2.5).attr("fill", ink));
      },
      agents(g) { // flask with bubbles + spark
        st(g.append("path").attr("d", "M-22,-10 L-22,40 L-70,140 Q-74,152 -60,152 L60,152 Q74,152 70,140 L22,40 L22,-10Z").attr("fill", "#fff"));
        g.append("path").attr("d", "M-50,100 L50,100 L66,140 Q68,148 58,148 L-58,148 Q-68,148 -66,140Z").attr("fill", fill.agents);
        st(g.append("rect").attr("x", -30).attr("y", -22).attr("width", 60).attr("height", 14).attr("rx", 5).attr("fill", fill.agents));
        [[-20, 120, 7], [14, 110, 5], [0, 80, 4], [-8, 56, 3]].forEach(([x, y, r]) => st(g.append("circle").attr("cx", x).attr("cy", y).attr("r", r).attr("fill", "#fff")).attr("stroke-width", 1.5));
        g.append("image").attr("href", "img/spark.svg").attr("x", 40).attr("y", -60).attr("width", 46).attr("height", 46);
      },
      clinic(g) { // clipboard with rising bars
        st(g.append("rect").attr("x", -70).attr("y", -10).attr("width", 140).attr("height", 180).attr("rx", 10).attr("fill", "#fff"));
        st(g.append("rect").attr("x", -28).attr("y", -22).attr("width", 56).attr("height", 22).attr("rx", 6).attr("fill", fill.clinic));
        [40, 62, 88, 120].forEach((h, i) => st(g.append("rect").attr("x", -48 + i * 26).attr("y", 150 - h).attr("width", 16).attr("height", h).attr("rx", 3).attr("fill", i === 3 ? clay : fill.clinic)).attr("stroke-width", 1.5));
      },
    };
    const place = { genome: [520, 20], design: [890, 95], cell: [1115, 115], agents: [690, 300], clinic: [1110, 300] };
    const labelY = { genome: 250, design: 195, cell: 100, agents: 178, clinic: 195 };
    const groups = {};
    ST.frontiers.forEach(f => {
      const g = svg.append("g").attr("class", "fx").attr("transform", `translate(${place[f.id]})`);
      art[f.id](g); groups[f.id] = g;
      g.append("text").attr("y", labelY[f.id]).attr("text-anchor", "middle")
        .attr("font-family", v("--f-sans")).attr("font-weight", 700).attr("font-size", 16).attr("fill", ink).text(f.name);
      g.on("click", () => toggle(f.id, true));
    });
    const list = (h, items, cls = "") => `<h6 class="${cls}">${h}</h6><ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    ST.frontiers.forEach(f => {
      const c = document.createElement("div");
      c.className = "fcard"; c.dataset.id = f.id; c.style.background = fill[f.id];
      c.innerHTML = `<button aria-expanded="false">${esc(f.name)}</button><div class="body"><p class="sub">${esc(f.sub)}</p>
        ${list("Where it started", f.started)}${list("Where it is now", f.now)}${list("Claude's part", f.claude, "claude")}${list("What's next", f.next)}</div>`;
      c.querySelector("button").onclick = () => toggle(f.id);
      cards.appendChild(c);
    });
    function toggle(id, forceOpen) {
      cards.querySelectorAll(".fcard").forEach(c => {
        const open = c.dataset.id === id && (forceOpen || !c.classList.contains("open"));
        c.classList.toggle("open", open); c.querySelector("button").setAttribute("aria-expanded", open);
      });
      const any = cards.querySelector(".fcard.open");
      svg.classed("focus", !!any);
      Object.entries(groups).forEach(([k, g]) => g.classed("on", any && any.dataset.id === k));
    }
  })();

  /* ── World map ───────────────────────────── */
  (function map() {
    const svg = d3.select("#map-svg"), card = document.getElementById("map-card");
    const world = topojson.feature(window.WORLD_110M, window.WORLD_110M.objects.countries);
    world.features = world.features.filter(f => f.properties.name !== "Antarctica");
    const proj = d3.geoNaturalEarth1().fitExtent([[10, 10], [950, 490]], world), path = d3.geoPath(proj);
    const root = svg.append("g");
    root.append("g").selectAll("path").data(world.features).join("path").attr("class", "country").attr("d", path);
    const kinds = { anthropic: ["Anthropic", v("--e-uses")], labs: ["AI labs & big tech", v("--e-data")], biotech: ["AI-native biotech", v("--e-builds")], pharma: ["Pharma", v("--e-deal")], research: ["Research & public health", v("--e-research")], policy: ["Regulators", v("--e-invests")] };
    const g = root.append("g").selectAll("g").data(ST.places).join("g").attr("class", "place")
      .attr("transform", d => `translate(${proj(d.ll)})`).attr("tabindex", 0).attr("role", "button").attr("aria-label", d => d.name);
    g.append("circle").attr("r", 6).attr("fill", d => kinds[d.kind][1]);
    const lbl = g.append("text").attr("x", 9).attr("y", 3).text(d => d.name).style("display", "none");
    let k = 1;
    const zoom = d3.zoom().scaleExtent([1, 8]).filter(ev => ev.type !== "wheel" && !ev.button).on("zoom", ev => {
      k = ev.transform.k; root.attr("transform", ev.transform);
      g.select("circle").attr("r", 6 / Math.sqrt(k)).attr("stroke-width", 1.5 / k);
      lbl.style("font-size", `${10 / k}px`).attr("x", 9 / k).attr("y", 3 / k).style("stroke-width", `${3 / k}px`);
    });
    svg.call(zoom);
    d3.selectAll("#map-zoom button").on("click", function () {
      const z = this.dataset.z;
      if (z === "reset") svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity);
      else svg.transition().duration(300).call(zoom.scaleBy, z === "in" ? 1.6 : 1 / 1.6);
    });
    function select(d) {
      g.classed("sel", x => x === d); lbl.style("display", x => (x === d ? null : "none"));
      card.innerHTML = `<span class="pl">${esc(d.place)} · ${esc(kinds[d.kind][0])}</span><h3>${esc(d.name)}</h3><p>${esc(d.text)}</p>`;
      card.hidden = false; card.style.animation = "none"; card.offsetHeight; card.style.animation = "";
      const [x, y] = proj(d.ll), { width, height } = svg.node().getBoundingClientRect(), s = 960 / width, zk = Math.max(k, 2.5);
      svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(480 - x * zk, 250 - y * zk).scale(zk));
    }
    g.on("mouseenter", function (_, d) { d3.select(this).select("text").style("display", null); })
      .on("mouseleave", function () { d3.select(this).filter(x => !d3.select(this).classed("sel")).select("text").style("display", "none"); })
      .on("click", (ev, d) => { ev.stopPropagation(); select(d); })
      .on("keydown", (ev, d) => { if (ev.key === "Enter") select(d); });
    // legend
    const lg = svg.append("g").attr("transform", "translate(20,372)");
    lg.append("rect").attr("x", -8).attr("y", -16).attr("width", 190).attr("height", 122).attr("rx", 8).attr("fill", v("--ivory")).attr("opacity", .9);
    Object.values(kinds).forEach(([name, c], i) => {
      lg.append("circle").attr("cx", 4).attr("cy", i * 18).attr("r", 5).attr("fill", c);
      lg.append("text").attr("x", 16).attr("y", i * 18 + 4).attr("font-family", v("--f-sans")).attr("font-size", 12).attr("fill", v("--slate")).text(name);
    });
  })();

  /* ── Safeguards, timeline, horizon ───────── */
  document.getElementById("safeguards").innerHTML = ST.safeguards.map((s, i) =>
    `<article class="sg"><span class="i">0${i + 1}</span><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>${srcLink(s.src)}</article>`).join("");
  const tl = document.getElementById("timeline");
  tl.innerHTML = ST.timeline.map(t => `<div class="tl${t.future ? " future" : ""}"><span class="d">${esc(t.date)}${t.future ? " · expected" : ""}</span><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></div>`).join("");
  onVisible(tl, () => tl.querySelectorAll(".tl").forEach((el, i) => setTimeout(() => el.classList.add("in"), reduced ? 0 : i * 140)), 0.15);
  document.getElementById("horizon-grid").innerHTML = ST.horizon.map(h => `<div class="hz"><h4>${esc(h.name)}</h4><p>${esc(h.text)}</p></div>`).join("");

  /* ── Network explorer + sources ──────────── */
  Net.init();
  const seen = new Map();
  const add = s => { if (s && !seen.has(s.url)) seen.set(s.url, s); };
  Object.values(window.NETWORK.sources).forEach(add);
  [ST.milestones.map(m => m.src), ST.accelerations.map(a => a.src), ST.pipeline.drugs.map(d => d.src), ST.pipeline.statSrc, ST.safeguards.map(x => x.src)].flat().forEach(add);
  add({ title: "Dario Amodei — Machines of Loving Grace", url: "https://www.darioamodei.com/essay/machines-of-loving-grace" });
  document.getElementById("source-list").innerHTML = [...seen.values()].map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
})();
