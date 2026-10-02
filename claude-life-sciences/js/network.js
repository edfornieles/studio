/* The Discovery Stack — network explorer (d3 v7).
 * Static, zone-clustered layout; edges appear on hover/select/legend filter. */
(function () {
  const W = 1480, H = 1440;
  const ZONES = {
    labs:      { cx: 740, cy: 165, r: 140, label: "AI Labs & Big Tech" },
    biotech:   { cx: 1190, cy: 490, r: 300, label: "AI-Native Biotech" },
    pharma:    { cx: 1140, cy: 1090, r: 250, label: "Pharma" },
    policy:    { cx: 740, cy: 1265, r: 115, label: "Regulators & Funders" },
    research:  { cx: 330, cy: 1090, r: 240, label: "Research & Open Data" },
    tools:     { cx: 300, cy: 490, r: 210, label: "Lab Tools & Data" },
    anthropic: { cx: 740, cy: 700, r: 150, label: "Anthropic & Claude", open: true },
  };
  const css = getComputedStyle(document.documentElement);
  const edgeColor = t => css.getPropertyValue(`--e-${t}`).trim();
  const zoneColor = z => css.getPropertyValue(`--z-${z}`).trim();

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const initials = name => {
    const words = name.replace(/[()\/·—-]/g, " ").split(/\s+/).filter(w => w && !/^(of|the|and|&)$/i.test(w));
    if (/^\d/.test(words[0])) return words[0];
    return (words[0][0] + (words[1] ? words[1][0] : words[0][1] || "")).toUpperCase();
  };
  const radius = n => (n.size === "large" ? 17 : 9);

  let layout = null;
  function computeLayout() {
    if (layout) return layout;
    const D = window.NETWORK;
    const nodes = D.nodes.map(n => ({ ...n }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    // deterministic seed positions around each zone centre
    const counts = {};
    nodes.forEach(n => {
      const z = ZONES[n.zone], i = (counts[n.zone] = (counts[n.zone] || 0) + 1);
      const a = i * 2.39996, d = Math.sqrt(i) * 28;
      n.x = z.cx + d * Math.cos(a); n.y = z.cy + d * Math.sin(a);
    });
    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(n => ZONES[n.zone].cx).strength(0.08))
      .force("y", d3.forceY(n => ZONES[n.zone].cy).strength(0.08))
      .force("charge", d3.forceManyBody().strength(-40))
      .force("collide", d3.forceCollide(n => Math.max(radius(n) + 22, n.name.length * (n.size === "large" ? 3.3 : 2.6))).strength(0.9).iterations(3))
      .stop();
    for (let i = 0; i < 400; i++) {
      sim.tick();
      nodes.forEach(n => { // keep inside zone
        const z = ZONES[n.zone], dx = n.x - z.cx, dy = n.y - z.cy, d = Math.hypot(dx, dy), max = z.r - radius(n) - 16;
        if (d > max) { n.x = z.cx + dx / d * max; n.y = z.cy + dy / d * max; }
      });
    }
    const ring = nodes.filter(n => n.zone === "anthropic" && n.id !== "anthropic"), za = ZONES.anthropic;
    ring.forEach((n, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ring.length; n.x = za.cx + Math.cos(a) * 118; n.y = za.cy + Math.sin(a) * 92; });
    const hub = byId.get("anthropic"); if (hub) { hub.x = za.cx; hub.y = za.cy; }
    const edges = D.edges.map(e => ({ ...e, s: byId.get(e.source), t: byId.get(e.target) }));
    nodes.forEach(n => { n.degree = edges.filter(e => e.s === n || e.t === n).length; });
    layout = { nodes, edges, byId };
    return layout;
  }

  /* faint static render for the hero background */
  function drawBackground(svgEl) {
    const { nodes, edges } = computeLayout();
    const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid slice");
    Object.values(ZONES).filter(z => !z.open).forEach(z =>
      svg.append("circle").attr("cx", z.cx).attr("cy", z.cy).attr("r", z.r).attr("class", "zone_circle"));
    svg.append("g").selectAll("path").data(edges).join("path")
      .attr("d", e => curve(e)).attr("fill", "none").attr("stroke", "#141413").attr("stroke-opacity", .25).attr("stroke-width", .8);
    svg.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("cx", n => n.x).attr("cy", n => n.y).attr("r", radius).attr("fill", n => zoneColor(n.zone));
  }

  function curve(e) {
    const { s, t } = e, mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2, dx = t.x - s.x, dy = t.y - s.y;
    const k = 0.18; // bow
    return `M${s.x},${s.y} Q${mx - dy * k},${my + dx * k} ${t.x},${t.y}`;
  }
  function midpoint(e) {
    const { s, t } = e, dx = t.x - s.x, dy = t.y - s.y, k = 0.18;
    const cx = (s.x + t.x) / 2 - dy * k, cy = (s.y + t.y) / 2 + dx * k;
    return [0.25 * s.x + 0.5 * cx + 0.25 * t.x, 0.25 * s.y + 0.5 * cy + 0.25 * t.y];
  }

  function init() {
    const D = window.NETWORK;
    const { nodes, edges, byId } = computeLayout();
    const svg = d3.select("#net-svg");
    const root = svg.append("g");
    const types = D.edgeTypes;

    // arrow markers
    const defs = svg.append("defs");
    types.forEach(t => defs.append("marker").attr("id", `arr-${t.id}`).attr("viewBox", "0 -4 8 8")
      .attr("refX", 8).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", edgeColor(t.id)));

    Object.entries(ZONES).forEach(([id, z]) => {
      if (!z.open) root.append("circle").attr("class", "zone_circle").attr("cx", z.cx).attr("cy", z.cy).attr("r", z.r);
      const ly = z.open ? z.cy - z.r - 10 : z.cy + z.r + 34;
      root.append("text").attr("class", `zone_label${z.open ? " anth" : ""}`).attr("x", z.cx).attr("y", ly).text(z.label);
    });

    // trim edge end so arrowheads sit at node edge
    edges.forEach(e => {
      const { t } = e, [mx, my] = midpoint(e), dx = t.x - mx, dy = t.y - my, d = Math.hypot(dx, dy) || 1, r = radius(t) + 3;
      e.path = curve({ s: e.s, t: { x: t.x - dx / d * r, y: t.y - dy / d * r } });
    });
    const edgeSel = root.append("g").selectAll("path").data(edges).join("path")
      .attr("class", "n_edge").attr("d", e => e.path).attr("stroke", e => edgeColor(e.type))
      .attr("marker-end", e => `url(#arr-${e.type})`);

    const labelSel = root.append("g").selectAll("g").data(edges).join("g").attr("class", "n_elabel")
      .attr("transform", e => {
        const [x, y] = midpoint(e); let a = Math.atan2(e.t.y - e.s.y, e.t.x - e.s.x) * 180 / Math.PI;
        if (a > 90) a -= 180; if (a < -90) a += 180;
        return `translate(${x},${y}) rotate(${a})`;
      });
    labelSel.append("rect").attr("rx", 7).attr("height", 14).attr("y", -7).attr("fill", e => edgeColor(e.type))
      .attr("width", e => e.label.length * 5.6 + 12).attr("x", e => -(e.label.length * 5.6 + 12) / 2);
    labelSel.append("text").text(e => e.label);

    const nodeSel = root.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", n => `n_node${n.size === "large" ? " large" : ""}${n.zone === "anthropic" ? " anth" : ""}`)
      .attr("transform", n => `translate(${n.x},${n.y})`)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", n => `${n.name}, ${n.type}`);
    nodeSel.append("circle").attr("r", radius).attr("fill", n => zoneColor(n.zone));
    nodeSel.filter(n => n.size === "large").append("text").attr("class", "mono").text(n => initials(n.name));
    nodeSel.append("text").attr("y", n => radius(n) + 14).text(n => n.name);

    // zoom (buttons + drag; wheel ignored so page scroll is never hijacked)
    const zoom = d3.zoom().scaleExtent([0.3, 3]).filter(ev => ev.type !== "wheel" && !ev.button).on("zoom", ev => root.attr("transform", ev.transform));
    svg.call(zoom).on("dblclick.zoom", null);
    const fit = () => {
      const { width, height } = svg.node().getBoundingClientRect();
      const k = Math.min(width / W, height / H) * 0.92;
      return d3.zoomIdentity.translate((width - W * k) / 2, (height - H * k) / 2 + (width < 760 ? 20 : 0)).scale(k);
    };
    let home = fit();
    svg.call(zoom.transform, home);
    window.addEventListener("resize", () => { home = fit(); svg.call(zoom.transform, home); });
    d3.selectAll("#net-zoom button").on("click", function () {
      const z = this.dataset.z;
      if (z === "reset") svg.transition().duration(600).call(zoom.transform, home);
      else svg.transition().duration(300).call(zoom.scaleBy, z === "in" ? 1.4 : 1 / 1.4);
    });

    // state
    let selected = null, filter = null;
    const connected = n => edges.filter(e => e.s === n || e.t === n);
    function highlight(n) {
      if (!n) {
        svg.classed("focus", !!filter);
        nodeSel.classed("lit", m => filter ? edges.some(e => e.type === filter && (e.s === m || e.t === m)) : false);
        edgeSel.classed("on", e => filter && e.type === filter);
        labelSel.classed("on", false);
        return;
      }
      const es = connected(n).filter(e => !filter || e.type === filter);
      const lit = new Set([n, ...es.flatMap(e => [e.s, e.t])]);
      svg.classed("focus", true);
      nodeSel.classed("lit", m => lit.has(m));
      edgeSel.classed("on", e => es.includes(e));
      labelSel.classed("on", e => es.includes(e));
      nodeSel.filter(m => lit.has(m)).raise();
    }
    nodeSel.on("mouseenter", (_, n) => { if (!selected) highlight(n); })
      .on("mouseleave", () => { if (!selected) highlight(null); })
      .on("click", (ev, n) => { ev.stopPropagation(); select(n); })
      .on("keydown", (ev, n) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(n); } });
    svg.on("click", () => { if (selected) closeCard(); });

    function select(n, zoomTo = true) {
      selected = n; highlight(n); renderCard(n);
      closeList(false);
      svg.classed("shift-l", window.innerWidth > 760).classed("shift-r", false);
      if (zoomTo) {
        const { width, height } = svg.node().getBoundingClientRect(), k = Math.max(home.k * 1.6, 0.7);
        svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(width / 2 - n.x * k, height / 2 - n.y * k).scale(k));
      }
    }
    const card = document.getElementById("actor-card");
    function closeCard() {
      selected = null; card.hidden = true; svg.classed("shift-l", false); highlight(null);
    }
    function renderCard(n) {
      const es = connected(n);
      const groups = types.map(t => ({ t, list: es.filter(e => e.type === t.id) })).filter(g => g.list.length);
      card.innerHTML = `
        <button class="close" aria-label="Close">×</button>
        <h2>${esc(n.name)}</h2>
        <div class="badge" style="background:${zoneColor(n.zone)};color:${n.zone === "anthropic" ? "#fff" : "#141413"}">${esc(initials(n.name))}</div>
        <div class="type">${esc(n.type)} · ${esc(ZONES[n.zone].label)}</div>
        <div class="desc">${md(n.description)}</div>
        <h4>Connections</h4>
        ${groups.map(g => `<div class="cgroup"><h5><i style="background:${edgeColor(g.t.id)}"></i>${esc(g.t.name)}</h5>
          <ul style="border-color:${edgeColor(g.t.id)}">${g.list.map(e => {
            const other = e.s === n ? e.t : e.s;
            return `<li><div class="row"><button class="who" data-id="${other.id}">${esc(other.name)}</button><span class="verb">${esc(e.label)}</span><button class="tog" aria-label="Details">▶</button></div>
              <div class="more">${esc(e.description)}<div class="srcs">Sources: ${e.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</div></div></li>`;
          }).join("")}</ul></div>`).join("")}
        <div class="srcs asrc">Sources: ${n.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</div>`;
      card.hidden = false; card.scrollTop = 0;
      card.querySelector(".close").onclick = closeCard;
      card.querySelectorAll(".who").forEach(b => b.onclick = () => select(byId.get(b.dataset.id)));
      card.querySelectorAll(".tog").forEach(b => b.onclick = () => b.closest("li").classList.toggle("open"));
    }

    // legend filter
    const legend = d3.select("#legend");
    types.forEach(t => {
      legend.append("button").attr("data-t", t.id).html(`<i style="background:${edgeColor(t.id)}"></i>${esc(t.name)}`)
        .on("click", function () {
          filter = filter === t.id ? null : t.id;
          legend.classed("filtering", !!filter);
          legend.selectAll("button").classed("active", function () { return this.dataset.t === filter; });
          highlight(selected);
        });
    });

    // list view
    const list = document.getElementById("list-view"), input = document.getElementById("list-search"), ul = document.getElementById("list-items");
    let sortBy = "az";
    function renderList() {
      const q = input.value.trim().toLowerCase();
      const zoneOrder = D.zones.map(z => z.id);
      const items = nodes.filter(n => !q || n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
        .sort((a, b) => sortBy === "conn" ? b.degree - a.degree : sortBy === "zone" ? zoneOrder.indexOf(a.zone) - zoneOrder.indexOf(b.zone) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
      ul.innerHTML = items.map(n => `<li><button data-id="${n.id}"><i style="background:${zoneColor(n.zone)}"></i><b>${esc(n.name)}</b><span>${sortBy === "conn" ? n.degree + " links" : esc(n.type)}</span></button></li>`).join("");
      ul.querySelectorAll("button").forEach(b => {
        b.onclick = () => select(byId.get(b.dataset.id));
        b.onmouseenter = () => { if (!selected) highlight(byId.get(b.dataset.id)); };
        b.onmouseleave = () => { if (!selected) highlight(null); };
      });
    }
    function closeList(unshift = true) { list.hidden = true; if (unshift) svg.classed("shift-r", false); }
    document.getElementById("open-list").onclick = () => {
      closeCard(); list.hidden = false; svg.classed("shift-r", window.innerWidth > 760); renderList(); input.focus();
    };
    document.getElementById("close-list").onclick = () => closeList();
    input.oninput = renderList;
    document.querySelectorAll("#list-sort button").forEach(b => b.onclick = () => {
      sortBy = b.dataset.s; document.querySelectorAll("#list-sort button").forEach(x => x.classList.toggle("active", x === b)); renderList();
    });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape") { closeCard(); closeList(); } });
  }

  window.Net = { init, drawBackground };
})();
