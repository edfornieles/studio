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

  /* ── Explorers graph ─────────────────────── */
  (function explorers() {
    const svg = d3.select("#explorers-svg"), card = document.getElementById("explorer-card");
    const nodes = ST.explorers.nodes, byId = new Map(nodes.map(n => [n.id, n]));
    const links = ST.explorers.links.map(([a, b]) => ({ s: byId.get(a), t: byId.get(b) }));
    const linkSel = svg.append("g").selectAll("line").data(links).join("line").attr("class", "ex_link")
      .attr("x1", l => l.s.x).attr("y1", l => l.s.y).attr("x2", l => l.t.x).attr("y2", l => l.t.y);
    const g = svg.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", n => `ex_node ${n.kind}${n.id === "anth" ? " anth" : ""}`)
      .attr("transform", n => `translate(${n.x},${n.y})`).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", n => `${n.name}, ${n.role}`);
    const R = n => (n.kind === "org" ? 30 : 26);
    g.append("circle").attr("class", "ring").attr("r", R);
    g.append("text").attr("class", "mono").text(n => n.abbr || n.name.split(" ").map(w => w[0]).filter(c => /[A-ZÉ]/.test(c)).slice(0, 2).join(""));
    g.append("text").attr("class", "nm").attr("y", n => R(n) + 17).text(n => n.name);
    g.append("text").attr("class", "rl").attr("y", n => R(n) + 32).text(n => n.role);

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
      card.hidden = false;
    }
    function close() { sel = null; card.hidden = true; focus(null); }
    g.on("mouseenter", (_, n) => { if (!sel) focus(n); }).on("mouseleave", () => { if (!sel) focus(null); })
      .on("click", (ev, n) => { ev.stopPropagation(); sel === n ? close() : open(n); })
      .on("keydown", (ev, n) => { if (ev.key === "Enter") open(n); });
    card.querySelector(".close").onclick = close;
    svg.on("click", close);
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
    const F = ST.flow, svg = d3.select("#flow-svg"), colX = [250, 470, 690, 880];
    const fills = [v("--z-tools"), v("--z-research"), v("--clay"), v("--z-pharma")];
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
    const fillC = [v("--z-tools"), v("--z-builders"), v("--z-research"), v("--z-pharma"), "#EBC9A0"];
    const ink = v("--slate"), clay = v("--clay");
    // ground
    svg.append("path").attr("d", "M0,470 C300,440 600,500 1200,455 L1200,520 L0,520Z").attr("fill", v("--pampas"));
    const art = {
      discovery(g) { // DNA helix + lens
        for (let i = 0; i < 9; i++) { const y = i * 26, s = Math.sin(i * 0.8) * 34;
          g.append("line").attr("x1", -s).attr("y1", y).attr("x2", s).attr("y2", y).attr("stroke", ink).attr("stroke-width", 2);
          g.append("circle").attr("cx", -s).attr("cy", y).attr("r", 7).attr("fill", fillC[0]).attr("stroke", ink).attr("stroke-width", 1.5);
          g.append("circle").attr("cx", s).attr("cy", y).attr("r", 7).attr("fill", clay).attr("stroke", ink).attr("stroke-width", 1.5); }
        g.append("circle").attr("cx", 46).attr("cy", 150).attr("r", 40).attr("fill", "#ffffff66").attr("stroke", ink).attr("stroke-width", 3);
        g.append("line").attr("x1", 74).attr("y1", 180).attr("x2", 110).attr("y2", 220).attr("stroke", ink).attr("stroke-width", 8).attr("stroke-linecap", "round");
      },
      design(g) { // protein ribbon of beads
        const pts = d3.range(26).map(i => [Math.cos(i * 0.62) * (50 + i * 3), Math.sin(i * 0.62) * (40 + i * 2) + i * 4]);
        g.append("path").attr("d", d3.line().curve(d3.curveCatmullRom)(pts)).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 3);
        pts.forEach((p, i) => g.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", i % 4 ? 7 : 11).attr("fill", i % 3 ? fillC[1] : clay).attr("stroke", ink).attr("stroke-width", 1.5));
      },
      clinical(g) { // clipboard with rising bars
        g.append("rect").attr("x", -70).attr("y", -10).attr("width", 140).attr("height", 180).attr("rx", 10).attr("fill", "#fff").attr("stroke", ink).attr("stroke-width", 2);
        g.append("rect").attr("x", -28).attr("y", -22).attr("width", 56).attr("height", 22).attr("rx", 6).attr("fill", fillC[2]).attr("stroke", ink).attr("stroke-width", 2);
        [40, 62, 88, 120].forEach((h, i) => g.append("rect").attr("x", -48 + i * 26).attr("y", 150 - h).attr("width", 16).attr("height", h).attr("rx", 3).attr("fill", i === 3 ? clay : fillC[2]).attr("stroke", ink).attr("stroke-width", 1.5));
      },
      regulatory(g) { // stacked documents
        [[-30, 20], [-15, 10], [0, 0]].forEach(([x, y], i) => g.append("rect").attr("x", x).attr("y", y).attr("width", 120).attr("height", 150).attr("rx", 6)
          .attr("fill", i === 2 ? "#fff" : fillC[3]).attr("stroke", ink).attr("stroke-width", 2));
        d3.range(6).forEach(i => g.append("line").attr("x1", 16).attr("x2", i % 3 === 2 ? 70 : 104).attr("y1", 26 + i * 18).attr("y2", 26 + i * 18).attr("stroke", ink).attr("stroke-width", 2).attr("stroke-opacity", .5));
        g.append("circle").attr("cx", 100).attr("cy", 130).attr("r", 22).attr("fill", clay).attr("stroke", ink).attr("stroke-width", 2);
        g.append("path").attr("d", "M90,130 l7,7 l13,-15").attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 4).attr("stroke-linecap", "round");
      },
      health(g) { // globe
        g.append("circle").attr("r", 80).attr("fill", fillC[4]).attr("stroke", ink).attr("stroke-width", 2);
        g.append("ellipse").attr("rx", 34).attr("ry", 80).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.5);
        [-40, 0, 40].forEach(y => g.append("line").attr("x1", -Math.sqrt(6400 - y * y)).attr("x2", Math.sqrt(6400 - y * y)).attr("y1", y).attr("y2", y).attr("stroke", ink).attr("stroke-width", 1.5));
        g.append("circle").attr("cx", 18).attr("cy", 22).attr("r", 10).attr("fill", clay).attr("stroke", ink).attr("stroke-width", 2);
      },
    };
    const place = { discovery: [560, 30], design: [870, 110], health: [1100, 110], regulatory: [600, 300], clinical: [1110, 330] };
    const groups = {};
    ST.frontiers.forEach(f => {
      const g = svg.append("g").attr("class", "fx").attr("transform", `translate(${place[f.id]})`);
      art[f.id](g); groups[f.id] = g;
      g.append("text").attr("y", f.id === "health" ? 112 : f.id === "discovery" ? 250 : 195).attr("x", f.id === "regulatory" ? 45 : 0).attr("text-anchor", "middle")
        .attr("font-family", v("--f-sans")).attr("font-weight", 700).attr("font-size", 16).attr("fill", ink).text(f.name);
      g.on("click", () => toggle(f.id, true));
    });
    ST.frontiers.forEach((f, i) => {
      const c = document.createElement("div");
      c.className = "fcard"; c.dataset.id = f.id; c.style.background = [v("--z-tools"), v("--z-builders"), v("--z-research"), v("--z-pharma"), "#EBC9A0"][i];
      c.innerHTML = `<button aria-expanded="false">${esc(f.name)}</button><div class="body"><p class="sub">${esc(f.sub)}</p>
        <h6>What becomes possible</h6><ul>${f.possible.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        <h6>Already happening</h6><ul>${f.practice.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
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
    const kinds = { anthropic: ["Anthropic", v("--e-deploys")], pharma: ["Pharma & biotech", v("--e-connects")], research: ["Research", v("--e-research")], tools: ["Tools", v("--e-builds")], health: ["Public health", v("--e-validates")] };
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
    const lg = svg.append("g").attr("transform", "translate(20,390)");
    lg.append("rect").attr("x", -8).attr("y", -16).attr("width", 150).attr("height", 104).attr("rx", 8).attr("fill", v("--ivory")).attr("opacity", .9);
    Object.values(kinds).forEach(([name, c], i) => {
      lg.append("circle").attr("cx", 4).attr("cy", i * 18).attr("r", 5).attr("fill", c);
      lg.append("text").attr("x", 16).attr("y", i * 18 + 4).attr("font-family", v("--f-sans")).attr("font-size", 12).attr("fill", v("--slate")).text(name);
    });
  })();

  /* ── Safeguards, timeline, horizon ───────── */
  document.getElementById("safeguards").innerHTML = ST.safeguards.map((s, i) =>
    `<article class="sg"><span class="i">0${i + 1}</span><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>${srcLink(s.src)}</article>`).join("");
  const tl = document.getElementById("timeline");
  tl.innerHTML = ST.timeline.map(t => `<div class="tl"><span class="d">${esc(t.date)}</span><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></div>`).join("");
  onVisible(tl, () => tl.querySelectorAll(".tl").forEach((el, i) => setTimeout(() => el.classList.add("in"), reduced ? 0 : i * 140)), 0.15);
  document.getElementById("horizon-grid").innerHTML = ST.horizon.map(h => `<div class="hz"><h4>${esc(h.name)}</h4><p>${esc(h.text)}</p></div>`).join("");

  /* ── Network explorer + sources ──────────── */
  Net.init();
  const seen = new Map();
  const add = s => { if (s && !seen.has(s.url)) seen.set(s.url, s); };
  Object.values(window.NETWORK.sources).forEach(add);
  ST.accelerations.forEach(a => add(a.src)); ST.safeguards.forEach(s => add(s.src));
  add({ title: "Dario Amodei — Machines of Loving Grace", url: "https://www.darioamodei.com/essay/machines-of-loving-grace" });
  document.getElementById("source-list").innerHTML = [...seen.values()].map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
})();
