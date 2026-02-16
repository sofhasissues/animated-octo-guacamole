/* K-Map & Hamming Toolkit PRO
 * With Quine-McCluskey, gate diagrams, Espresso comparison, PWA support, and 7-10 variables
 */

/* ---------- Helpers ---------- */

const byId = (id) => document.getElementById(id);

function grayCode(n) {
  const res = [];
  for (let i = 0; i < 1 << n; i++) {
    res.push(i ^ (i >> 1));
  }
  return res;
}

function numToBits(num, width) {
  return num.toString(2).padStart(width, "0");
}

function parseIndexList(str) {
  if (!str.trim()) return [];
  return str
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/* ---------- PWA / Service Worker Registration ---------- */

function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registered", reg);
      })
      .catch((err) => {
        console.error("[PWA] Service Worker registration failed", err);
      });
  }

  let deferredPrompt;
  const installBtn = byId("install-btn");
  const banner = byId("pwa-banner");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.add("show");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      banner.style.display = "none";
    }
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] App installed");
    banner.style.display = "none";
  });
}

/* ---------- Global K-map state ---------- */

let kVars = 4;
let kMapValues = [];

function resetKmapValues() {
  const size = 1 << kVars;
  kMapValues = new Array(size).fill(0);
}

function getVarNames(count) {
  const base = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  return base.slice(0, count);
}

/* ---------- K-map rendering ---------- */

function buildKmap() {
  const wrapper = byId("kmap-wrapper");
  wrapper.innerHTML = "";

  if (kVars > 6) {
    wrapper.innerHTML =
      "<p class='note'>📊 K-map visualization disabled for >6 variables (too large). Using Quine–McCluskey only.</p>";
    return;
  }

  const v = kVars;
  const varNames = getVarNames(v);

  const rowVars = [];
  const colVars = [];

  if (v === 2) {
    colVars.push(varNames[0]);
    rowVars.push(varNames[1]);
  } else if (v === 3) {
    colVars.push(varNames[0], varNames[1]);
    rowVars.push(varNames[2]);
  } else if (v === 4) {
    colVars.push(varNames[0], varNames[1]);
    rowVars.push(varNames[2], varNames[3]);
  } else if (v === 5) {
    colVars.push(varNames[0], varNames[1], varNames[2]);
    rowVars.push(varNames[3], varNames[4]);
  } else if (v === 6) {
    colVars.push(varNames[0], varNames[1], varNames[2]);
    rowVars.push(varNames[3], varNames[4], varNames[5]);
  }

  const colBits = colVars.length;
  const rowBits = rowVars.length;

  const colGray = grayCode(colBits);
  const rowGray = grayCode(rowBits);

  const table = document.createElement("table");
  table.className = "kmap-table";

  const thead = document.createElement("thead");
  const body = document.createElement("tbody");

  const tr0 = document.createElement("tr");
  const cornerTh = document.createElement("th");
  cornerTh.className = "kmap-corner";
  const cornerTop = document.createElement("span");
  cornerTop.textContent = rowVars.join("");
  const cornerSlash = document.createElement("span");
  cornerSlash.textContent = "\\";
  const cornerBottom = document.createElement("span");
  cornerBottom.textContent = colVars.join("");
  cornerTh.appendChild(cornerTop);
  cornerTh.appendChild(cornerSlash);
  cornerTh.appendChild(cornerBottom);
  tr0.appendChild(cornerTh);

  const colLabelTh = document.createElement("th");
  colLabelTh.colSpan = colGray.length;
  colLabelTh.className = "kmap-header-label";
  colLabelTh.textContent = colVars.join("");
  tr0.appendChild(colLabelTh);
  thead.appendChild(tr0);

  const tr1 = document.createElement("tr");
  const emptyTh1 = document.createElement("th");
  tr1.appendChild(emptyTh1);
  colGray.forEach((g) => {
    const th = document.createElement("th");
    th.className = "kmap-header-bits";
    const bits = numToBits(g, colBits);
    const parts = [];
    for (let i = 0; i < colBits; i++) {
      parts.push(colVars[i] + bits[i]);
    }
    th.textContent = parts.join("");
    tr1.appendChild(th);
  });
  thead.appendChild(tr1);

  const tr2 = document.createElement("tr");
  const emptyTh2 = document.createElement("th");
  tr2.appendChild(emptyTh2);
  colGray.forEach((g) => {
    const th = document.createElement("th");
    th.className = "kmap-header-bits";
    th.textContent = numToBits(g, colBits);
    tr2.appendChild(th);
  });
  thead.appendChild(tr2);

  rowGray.forEach((rg) => {
    const bits = numToBits(rg, rowBits);
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    const top = document.createElement("div");
    top.className = "kmap-row-var";
    top.textContent = rowVars.join("");
    const bottom = document.createElement("div");
    bottom.className = "kmap-row-bits";
    bottom.textContent = bits;
    th.appendChild(top);
    th.appendChild(bottom);
    tr.appendChild(th);

    colGray.forEach((cg) => {
      const colBitsStr = numToBits(cg, colBits);
      const rowBitsStr = numToBits(rg, rowBits);
      const fullBits = colBitsStr + rowBitsStr;
      const index = parseInt(fullBits, 2);

      const td = document.createElement("td");
      td.className = "kmap-cell";
      td.dataset.index = index.toString();
      const val = kMapValues[index];
      setKmapCellDisplay(td, val);
      td.addEventListener("click", () => {
        cycleKmapCell(td);
      });
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(body);
  wrapper.appendChild(table);
}

function setKmapCellDisplay(td, val) {
  td.classList.remove("value-0", "value-1", "value-x");
  if (val === 1) {
    td.textContent = "1";
    td.classList.add("value-1");
  } else if (val === "x") {
    td.textContent = "X";
    td.classList.add("value-x");
  } else {
    td.textContent = "0";
    td.classList.add("value-0");
  }
}

function cycleKmapCell(td) {
  const idx = parseInt(td.dataset.index, 10);
  const cur = kMapValues[idx];
  let next;
  if (cur === 0) next = 1;
  else if (cur === 1) next = "x";
  else next = 0;
  kMapValues[idx] = next;
  setKmapCellDisplay(td, next);
}

/* ---------- K-map solving (Quine-McCluskey) ---------- */

function collectMintermsAndDC() {
  const minterms = [];
  const dcs = [];
  kMapValues.forEach((v, idx) => {
    if (v === 1) minterms.push(idx);
    else if (v === "x") dcs.push(idx);
  });
  return { minterms, dcs };
}

function qmSimplify(numVars, ones, dcs) {
  const allOnes = new Set(ones);
  const allUsed = new Set([...ones, ...dcs]);

  if (ones.length === 0) {
    return { primeImplicants: [], essential: [], sop: "0" };
  }

  if (ones.length === 1 && dcs.length === 0) {
    const idx = ones[0];
    const bits = numToBits(idx, numVars);
    const term = bits
      .split("")
      .map((b, i) => (b === "1" ? getVarNames(numVars)[i] : getVarNames(numVars)[i] + "'"))
      .join("");
    return {
      primeImplicants: [{ mask: bits, covers: [idx] }],
      essential: [0],
      sop: term
    };
  }

  let groups = {};
  function addTerm(term) {
    const onesCount = term.mask.split("").filter((c) => c === "1").length;
    if (!groups[onesCount]) groups[onesCount] = [];
    groups[onesCount].push(term);
  }

  allUsed.forEach((idx) => {
    const mask = numToBits(idx, numVars);
    addTerm({ mask, covers: [idx] });
  });

  let primeImplicants = [];
  let changed = true;
  while (changed) {
    changed = false;
    const newGroups = {};
    const marked = new Set();

    const keys = Object.keys(groups)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b);

    function ensureGroup(g) {
      if (!newGroups[g]) newGroups[g] = [];
    }

    for (let i = 0; i < keys.length - 1; i++) {
      const g1 = keys[i];
      const g2 = keys[i + 1];
      const group1 = groups[g1] || [];
      const group2 = groups[g2] || [];

      for (const t1 of group1) {
        for (const t2 of group2) {
          let diffCount = 0;
          let newMask = "";
          for (let b = 0; b < numVars; b++) {
            const c1 = t1.mask[b];
            const c2 = t2.mask[b];
            if (c1 === c2) {
              newMask += c1;
            } else {
              diffCount++;
              newMask += "-";
            }
          }
          if (diffCount === 1) {
            changed = true;
            marked.add(t1);
            marked.add(t2);
            const covers = Array.from(new Set([...t1.covers, ...t2.covers]));
            const onesCount = newMask.split("").filter((c) => c === "1").length;
            ensureGroup(onesCount);
            if (!newGroups[onesCount].some((t) => t.mask === newMask && sameArray(t.covers, covers))) {
              newGroups[onesCount].push({ mask: newMask, covers });
            }
          }
        }
      }
    }

    Object.values(groups).forEach((arr) => {
      arr.forEach((t) => {
        if (!marked.has(t)) {
          primeImplicants.push(t);
        }
      });
    });

    groups = newGroups;
  }

  primeImplicants = dedupeImplicants(primeImplicants);

  const essentialIndices = [];
  const coverCount = {};
  ones.forEach((m) => (coverCount[m] = 0));
  primeImplicants.forEach((imp) => {
    imp.covers.forEach((m) => {
      if (allOnes.has(m)) coverCount[m]++;
    });
  });

  ones.forEach((m) => {
    if ((coverCount[m] || 0) === 1) {
      const idx = primeImplicants.findIndex((imp) => imp.covers.includes(m));
      if (idx >= 0 && !essentialIndices.includes(idx)) essentialIndices.push(idx);
    }
  });

  const covered = new Set();
  essentialIndices.forEach((idx) => {
    primeImplicants[idx].covers.forEach((m) => covered.add(m));
  });

  const remaining = ones.filter((m) => !covered.has(m));
  const optionalIndices = [];
  primeImplicants.forEach((imp, idx) => {
    if (!essentialIndices.includes(idx)) optionalIndices.push(idx);
  });

  while (remaining.length > 0 && optionalIndices.length > 0) {
    let bestIdx = -1;
    let bestCount = -1;
    for (const idx of optionalIndices) {
      const imp = primeImplicants[idx];
      let c = 0;
      imp.covers.forEach((m) => {
        if (allOnes.has(m) && !covered.has(m)) c++;
      });
      if (c > bestCount) {
        bestCount = c;
        bestIdx = idx;
      }
    }
    if (bestIdx === -1 || bestCount <= 0) break;
    essentialIndices.push(bestIdx);
    primeImplicants[bestIdx].covers.forEach((m) => covered.add(m));
    for (let i = optionalIndices.length - 1; i >= 0; i--) {
      if (optionalIndices[i] === bestIdx) optionalIndices.splice(i, 1);
    }
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (covered.has(remaining[i])) remaining.splice(i, 1);
    }
  }

  const termStrs = essentialIndices.map((idx) => maskToTerm(numVars, primeImplicants[idx].mask));
  const sop = termStrs.length ? termStrs.join(" + ") : "1";

  return {
    primeImplicants,
    essential: essentialIndices,
    sop
  };
}

function sameArray(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

function dedupeImplicants(arr) {
  const out = [];
  arr.forEach((imp) => {
    if (!out.some((t) => t.mask === imp.mask && sameArray(t.covers, imp.covers))) {
      out.push(imp);
    }
  });
  return out;
}

function maskToTerm(numVars, mask) {
  const vars = getVarNames(numVars);
  const parts = [];
  for (let i = 0; i < numVars; i++) {
    const c = mask[i];
    if (c === "-") continue;
    parts.push(c === "1" ? vars[i] : vars[i] + "'");
  }
  return parts.length ? parts.join("") : "1";
}

function buildPos(numVars, ones, dcs) {
  const off = [];
  const size = 1 << numVars;
  const onesSet = new Set([...ones, ...dcs]);
  for (let i = 0; i < size; i++) {
    if (!onesSet.has(i)) off.push(i);
  }
  if (off.length === 0) return "1";
  if (off.length === size) return "0";
  const vars = getVarNames(numVars);
  const terms = off.map((m) => {
    const bits = numToBits(m, numVars);
    const inner = [];
    for (let i = 0; i < numVars; i++) {
      inner.push(bits[i] === "1" ? vars[i] + "'" : vars[i]);
    }
    return "(" + inner.join(" + ") + ")";
  });
  return terms.join("");
}

function colorKmapGroups(result) {
  if (kVars > 6) return; // No K-map for large var counts
  const wrapper = byId("kmap-wrapper");
  const cells = wrapper.querySelectorAll(".kmap-cell");
  cells.forEach((td) => {
    td.classList.remove("group-a", "group-b", "group-c", "group-d", "group-e");
  });
  const colors = ["group-a", "group-b", "group-c", "group-d", "group-e"];
  result.essential.forEach((idx, j) => {
    const imp = result.primeImplicants[idx];
    const cls = colors[j % colors.length];
    imp.covers.forEach((m) => {
      const td = wrapper.querySelector(`.kmap-cell[data-index="${m}"]`);
      if (td) td.classList.add(cls);
    });
  });
}

/* ---------- Gate diagram rendering ---------- */

function renderGateDiagram(sop, numVars) {
  const svg = byId("gate-diagram");
  svg.innerHTML = "";

  if (!sop || sop === "0" || sop === "–") {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%");
    text.setAttribute("y", "75");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "var(--text-soft)");
    text.setAttribute("font-size", "12");
    text.textContent = "No logic to diagram";
    svg.appendChild(text);
    return;
  }

  const terms = sop.split("+").map((t) => t.trim()).filter(Boolean);
  const gateHeight = 50;
  const width = 500;
  const orGateX = width - 80;

  svg.setAttribute("viewBox", `0 0 ${width} ${Math.max(200, gateHeight * terms.length + 60)}`);

  // Draw input wires on left
  const inputHeight = gateHeight * terms.length + 40;
  const varsUnique = [];
  terms.forEach((term) => {
    for (let i = 0; i < term.length; i++) {
      const c = term[i];
      if (c !== "'" && !varsUnique.includes(c)) varsUnique.push(c);
    }
  });

  // Draw AND gates for each term
  terms.forEach((term, i) => {
    const y = 30 + i * gateHeight;

    // AND gate
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "150");
    rect.setAttribute("y", y - 15);
    rect.setAttribute("width", "50");
    rect.setAttribute("height", "30");
    rect.setAttribute("rx", "4");
    rect.classList.add("gate-rect");
    svg.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "175");
    text.setAttribute("y", y);
    text.classList.add("gate-text");
    text.textContent = "AND";
    svg.appendChild(text);

    // Wire to OR
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "200");
    line.setAttribute("y1", y);
    line.setAttribute("x2", orGateX - 30);
    line.setAttribute("y2", y);
    line.classList.add("gate-line");
    svg.appendChild(line);
  });

  // Draw OR gate
  if (terms.length > 1) {
    const orY = 30 + (terms.length - 1) * gateHeight / 2;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", orGateX - 20);
    rect.setAttribute("y", orY - 20);
    rect.setAttribute("width", "50");
    rect.setAttribute("height", "40");
    rect.setAttribute("rx", "4");
    rect.classList.add("gate-rect");
    svg.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", orGateX);
    text.setAttribute("y", orY);
    text.classList.add("gate-text");
    text.textContent = "OR";
    svg.appendChild(text);

    // Output wire
    const outLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    outLine.setAttribute("x1", orGateX + 30);
    outLine.setAttribute("y1", orY);
    outLine.setAttribute("x2", orGateX + 60);
    outLine.setAttribute("y2", orY);
    outLine.classList.add("gate-line");
    outLine.setAttribute("stroke-width", "2");
    svg.appendChild(outLine);

    // Output label
    const outText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    outText.setAttribute("x", orGateX + 80);
    outText.setAttribute("y", orY + 4);
    outText.setAttribute("fill", "var(--accent)");
    outText.setAttribute("font-size", "11");
    outText.setAttribute("font-weight", "bold");
    outText.textContent = "F";
    svg.appendChild(outText);
  } else if (terms.length === 1) {
    const outLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    outLine.setAttribute("x1", "200");
    outLine.setAttribute("y1", "30");
    outLine.setAttribute("x2", orGateX + 60);
    outLine.setAttribute("y2", "30");
    outLine.classList.add("gate-line");
    outLine.setAttribute("stroke-width", "2");
    svg.appendChild(outLine);

    const outText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    outText.setAttribute("x", orGateX + 80);
    outText.setAttribute("y", "34");
    outText.setAttribute("fill", "var(--accent)");
    outText.setAttribute("font-size", "11");
    outText.setAttribute("font-weight", "bold");
    outText.textContent = "F";
    svg.appendChild(outText);
  }
}

/* ---------- HDL generation ---------- */

function buildHDL(numVars, sop, lang) {
  const vars = getVarNames(numVars);
  const outName = "F";
  if (lang === "verilog") {
    return [
      `module kmap_func(`,
      `  input ${vars.join(", ")},`,
      `  output ${outName}`,
      `);`,
      `  assign ${outName} = ${sop || "1'b0"};`,
      `endmodule`
    ].join("\n");
  } else {
    return [
      `library IEEE;`,
      `use IEEE.STD_LOGIC_1164.ALL;`,
      ``,
      `entity kmap_func is`,
      `  port (`,
      `    ${vars.map((v) => v + " : in STD_LOGIC").join(";\n    ")};`,
      `    ${outName} : out STD_LOGIC`,
      `  );`,
      `end kmap_func;`,
      ``,
      `architecture rtl of kmap_func is`,
      `begin`,
      `  ${outName} <= ${sop || "'0'"};`,
      `end rtl;`
    ].join("\n");
  }
}

/* ---------- Espresso PLA export ---------- */

function buildEspressoPLA(numVars, ones, dcs) {
  const vars = getVarNames(numVars);
  const lines = [];
  lines.push(".i " + numVars);
  lines.push(".o 1");
  lines.push(".ilb " + vars.join(" "));
  lines.push(".ob F");
  ones.forEach((m) => {
    lines.push(numToBits(m, numVars) + " 1");
  });
  dcs.forEach((m) => {
    lines.push(numToBits(m, numVars) + " -");
  });
  lines.push(".e");
  return lines.join("\n");
}

/* ---------- Hamming code logic ---------- */

function hammingParityCount(dataBits) {
  let m = 0;
  while ((1 << m) < dataBits + m + 1) m++;
  return m;
}

function hammingLayout(dataBits) {
  const m = hammingParityCount(dataBits);
  const total = dataBits + m;
  const layout = new Array(total + 1);
  let dataIdx = 1;
  for (let i = 1; i <= total; i++) {
    if ((i & (i - 1)) === 0) {
      const pIndex = Math.log2(i) + 1;
      layout[i] = "p" + pIndex;
    } else {
      layout[i] = "d" + dataIdx++;
    }
  }
  return { layout, parityCount: m, totalBits: total };
}

function hammingEncode(dataStr, parityType) {
  const dataBits = dataStr.length;
  const { layout, parityCount, totalBits } = hammingLayout(dataBits);

  const arr = new Array(totalBits + 1).fill(0);
  for (let i = 1; i <= totalBits; i++) {
    const role = layout[i];
    if (role && role.startsWith("d")) {
      const idx = parseInt(role.slice(1), 10) - 1;
      arr[i] = dataStr[idx] === "1" ? 1 : 0;
    }
  }

  for (let p = 1; p <= parityCount; p++) {
    const pos = 1 << (p - 1);
    let sum = 0;
    for (let i = 1; i <= totalBits; i++) {
      if (i & pos) sum ^= arr[i];
    }
    arr[pos] = parityType === "even" ? sum : sum ^ 1;
  }

  let bits = "";
  for (let i = 1; i <= totalBits; i++) bits += arr[i].toString();
  if (parityType === "even") {
    let overall = 0;
    for (let i = 1; i <= totalBits; i++) overall ^= arr[i];
    bits += overall.toString();
  }

  return { bits, layout, parityCount, totalBits };
}

function hammingCoverageString(layout, totalBits) {
  const positions = Array.from({ length: totalBits }, (_, i) => i + 1);
  const parityPositions = positions.filter((i) => (i & (i - 1)) === 0);
  let header = "Bit pos:    " + positions.map((p) => p.toString().padStart(2, " ")).join(" ") + "\n";
  let roleLine = "Role:       " + positions
    .map((p) => (layout[p] || "").padStart(2, " "))
    .join(" ") + "\n\n";

  let rows = "";
  parityPositions.forEach((pos) => {
    const pIndex = Math.log2(pos) + 1;
    let line = ("p" + pIndex).padEnd(11, " ");
    positions.forEach((col) => {
      if (col & pos) line += "  ✓";
      else line += "   ";
    });
    rows += line + "\n";
  });

  return header + roleLine + rows;
}

function hammingCheck(received, parityExpectation) {
  const bits = received.trim().split("").map((c) => (c === "1" ? 1 : 0));
  const n = bits.length;
  if (n < 3) {
    return {
      type: "invalid",
      message: "Too short to be a Hamming code",
      corrected: received
    };
  }

  let parityType = "even";
  if (parityExpectation === "odd") parityType = "odd";
  else if (parityExpectation === "even") parityType = "even";

  let dataBitsGuess = n - 3;
  if (dataBitsGuess < 1) dataBitsGuess = 1;
  const { parityCount, totalBits } = hammingLayout(dataBitsGuess);
  const hasOverallParity = n === totalBits + 1;

  const arr = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    arr[i] = bits[i - 1];
  }

  let syndrome = 0;
  for (let p = 1; p <= parityCount; p++) {
    const pos = 1 << (p - 1);
    let sum = 0;
    for (let i = 1; i <= (hasOverallParity ? n - 1 : n); i++) {
      if (i & pos) sum ^= arr[i];
    }
    const expect = parityType === "even" ? 0 : 1;
    if (sum !== expect) syndrome |= pos;
  }

  let overallParityOk = "N/A";
  if (hasOverallParity && parityType === "even") {
    let overall = 0;
    for (let i = 1; i <= n; i++) overall ^= arr[i];
    overallParityOk = overall === 0 ? "OK" : "Mismatch";
  }

  let classification = "";
  let corrected = [...bits];

  if (!hasOverallParity || parityType === "odd") {
    if (syndrome === 0) {
      classification = "No error (or undetectable even‑bit error).";
    } else {
      classification = "Single‑bit error; corrected.";
      const pos = syndrome;
      if (pos >= 1 && pos <= n) {
        corrected[pos - 1] ^= 1;
      }
    }
  } else {
    if (syndrome === 0 && overallParityOk === "OK") {
      classification = "No error.";
    } else if (syndrome !== 0 && overallParityOk === "Mismatch") {
      classification = "Correctable single‑bit error.";
      const pos = syndrome;
      if (pos >= 1 && pos <= n) {
        corrected[pos - 1] ^= 1;
      }
    } else if (syndrome === 0 && overallParityOk === "Mismatch") {
      classification = "Error in overall parity bit.";
      corrected[n - 1] ^= 1;
    } else {
      classification = "Detected double‑bit error (uncorrectable).";
    }
  }

  return {
    type: parityType,
    syndrome,
    overallParityOk,
    classification,
    corrected: corrected.join("")
  };
}

/* ---------- UI wiring ---------- */

function initModeSwitch() {
  const btnK = byId("mode-kmap");
  const btnH = byId("mode-hamming");
  const panelK = byId("kmap-panel");
  const panelH = byId("hamming-panel");

  btnK.addEventListener("click", () => {
    btnK.classList.add("active");
    btnH.classList.remove("active");
    panelK.classList.add("visible");
    panelH.classList.remove("visible");
  });

  btnH.addEventListener("click", () => {
    btnH.classList.add("active");
    btnK.classList.remove("active");
    panelH.classList.add("visible");
    panelK.classList.remove("visible");
  });
}

function initKmapUI() {
  const varSelect = byId("var-count");
  const inputTypeSelect = byId("input-type");
  const methodSelect = byId("simplify-method");
  const methodInfo = byId("method-info");

  varSelect.addEventListener("change", () => {
    kVars = parseInt(varSelect.value, 10);
    resetKmapValues();
    if (kVars > 6) {
      byId("kmap-wrapper").innerHTML =
        "<p class='note'>📊 K-map visualization disabled for >6 variables. Using Quine–McCluskey only.</p>";
    } else {
      buildKmap();
    }
    updateSolutionDisplay(null);
  });

  methodSelect.addEventListener("change", () => {
    const method = methodSelect.value;
    if (method === "kmap") {
      methodInfo.textContent = "K-map provides visual grouping for 2–6 variables";
    } else if (method === "qmc") {
      methodInfo.textContent = "Quine–McCluskey tabular method works for all variable counts";
    } else {
      methodInfo.textContent = "Automatically uses K-map for ≤6 vars, Quine–McCluskey for >6 vars";
    }
  });

  inputTypeSelect.addEventListener("change", () => {
    const t = inputTypeSelect.value;
    byId("minterm-input-wrapper").classList.toggle("hidden", t !== "minterms" && t !== "maxterms");
    byId("truth-input-wrapper").classList.toggle("hidden", t !== "truth");
  });

  byId("solve-btn").addEventListener("click", () => {
    const type = inputTypeSelect.value;

    if (type === "grid") {
      const { minterms, dcs } = collectMintermsAndDC();
      runKmapSolve(minterms, dcs);
    } else if (type === "minterms") {
      const ones = parseIndexList(byId("minterm-input").value);
      const dcs = parseIndexList(byId("dc-input").value);
      resetKmapValues();
      ones.forEach((m) => {
        if (m < (1 << kVars)) kMapValues[m] = 1;
      });
      dcs.forEach((m) => {
        if (m < (1 << kVars)) kMapValues[m] = "x";
      });
      if (kVars <= 6) buildKmap();
      runKmapSolve(ones, dcs);
    } else if (type === "maxterms") {
      const maxterms = parseIndexList(byId("minterm-input").value);
      const dcs = parseIndexList(byId("dc-input").value);
      const size = 1 << kVars;
      const ones = [];
      for (let i = 0; i < size; i++) {
        if (!maxterms.includes(i)) ones.push(i);
      }
      resetKmapValues();
      ones.forEach((m) => (kMapValues[m] = 1));
      dcs.forEach((m) => {
        if (m < size) kMapValues[m] = "x";
      });
      if (kVars <= 6) buildKmap();
      runKmapSolve(ones, dcs);
    } else if (type === "truth") {
      const txt = byId("truth-input").value.trim();
      const lines = txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const ones = [];
      const dcs = [];
      lines.forEach((line) => {
        const parts = line.split(/\s+/);
        if (parts.length < 2) return;
        const bits = parts[0];
        const out = parts[1];
        if (bits.length !== kVars) return;
        const idx = parseInt(bits, 2);
        if (out === "1") ones.push(idx);
        else if (out.toLowerCase() === "x") dcs.push(idx);
      });
      resetKmapValues();
      ones.forEach((m) => (kMapValues[m] = 1));
      dcs.forEach((m) => (kMapValues[m] = "x"));
      if (kVars <= 6) buildKmap();
      runKmapSolve(ones, dcs);
    }
  });

  byId("clear-btn").addEventListener("click", () => {
    resetKmapValues();
    if (kVars <= 6) buildKmap();
    updateSolutionDisplay(null);
  });

  byId("hdl-lang").addEventListener("change", () => {
    const sop = byId("sop-output").textContent;
    if (!sop || sop === "–") {
      byId("hdl-output").textContent = "// Solve first to generate HDL";
      return;
    }
    const lang = byId("hdl-lang").value;
    byId("hdl-output").textContent = buildHDL(kVars, sop, lang);
  });

  byId("espresso-btn").addEventListener("click", () => {
    const { minterms, dcs } = collectMintermsAndDC();
    const pla = buildEspressoPLA(kVars, minterms, dcs);
    byId("espresso-output").textContent = pla;
  });

  resetKmapValues();
  if (kVars <= 6) buildKmap();
}

function runKmapSolve(ones, dcs) {
  const method = byId("simplify-method").value;
  const result = qmSimplify(kVars, ones, dcs);

  if ((method === "kmap" || method === "auto") && kVars <= 6) {
    colorKmapGroups(result);
    byId("method-used").textContent = "K-map";
  } else {
    byId("method-used").textContent = "Quine–McCluskey";
  }

  const pos = buildPos(kVars, ones, dcs);
  updateSolutionDisplay(result, pos);
  renderGateDiagram(result.sop, kVars);

  const lang = byId("hdl-lang").value;
  byId("hdl-output").textContent = buildHDL(kVars, result.sop, lang);
}

function updateSolutionDisplay(result, pos) {
  const sopSpan = byId("sop-output");
  const posSpan = byId("pos-output");
  const implSpan = byId("implicant-output");
  const stepsOl = byId("steps-output");

  if (!result) {
    sopSpan.textContent = "–";
    posSpan.textContent = "–";
    implSpan.textContent = "–";
    stepsOl.innerHTML = "";
    return;
  }

  sopSpan.textContent = result.sop;
  posSpan.textContent = pos;

  const termsDesc = result.essential
    .map((idx) => {
      const imp = result.primeImplicants[idx];
      return maskToTerm(kVars, imp.mask);
    })
    .join(", ");
  implSpan.textContent = termsDesc || "–";

  const steps = [];
  steps.push(`Variables: ${getVarNames(kVars).join(", ")}`);
  steps.push(`Minterms covered: ${result.primeImplicants
    .map((imp) => imp.covers.join(","))
    .join(" | ")}`);
  steps.push(`Essential implicants: ${termsDesc || "none"}`);
  steps.push(`Total terms: ${result.essential.length}`);
  stepsOl.innerHTML = "";
  steps.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    stepsOl.appendChild(li);
  });
}

/* Hamming UI */

function initHammingUI() {
  byId("h-generate").addEventListener("click", () => {
    const dataStr = byId("h-data").value.trim();
    if (!/^[01]+$/.test(dataStr)) {
      byId("h-gen-mode").textContent = "Invalid data (use only 0/1)";
      byId("h-encoded").textContent = "–";
      byId("h-layout").textContent = "–";
      byId("h-coverage").textContent = "–";
      return;
    }
    const parityType = byId("h-parity-type").value;
    const { bits, layout, totalBits } = hammingEncode(dataStr, parityType);

    byId("h-gen-mode").textContent =
      parityType === "even" ? "Even parity (extended Hamming)" : "Odd parity (standard Hamming)";

    byId("h-encoded").textContent = bits;

    const positions = Array.from({ length: totalBits }, (_, i) => i + 1);
    const layoutStr =
      "Bit index: " +
      positions.map((p) => p.toString().padStart(2, " ")).join(" ") +
      "\nRole:      " +
      positions
        .map((p) => (layout[p] || "").padStart(2, " "))
        .join(" ");
    byId("h-layout").textContent = layoutStr;

    const cov = hammingCoverageString(layout, totalBits);
    byId("h-coverage").textContent = cov;
  });

  byId("h-check").addEventListener("click", () => {
    const rec = byId("h-received").value.trim();
    if (!/^[01]+$/.test(rec)) {
      byId("h-det-type").textContent = "Invalid (use only 0/1)";
      byId("h-syndrome").textContent = "–";
      byId("h-overall").textContent = "–";
      byId("h-classification").textContent = "–";
      byId("h-corrected").textContent = "–";
      return;
    }
    const parityExp = byId("h-check-parity").value;
    const res = hammingCheck(rec, parityExp);

    if (res.type === "invalid") {
      byId("h-det-type").textContent = "Invalid";
      byId("h-syndrome").textContent = "–";
      byId("h-overall").textContent = "–";
      byId("h-classification").textContent = res.message;
      byId("h-corrected").textContent = rec;
      return;
    }

    byId("h-det-type").textContent =
      res.type === "even" ? "Even parity (extended Hamming)" : "Odd parity (standard Hamming)";
    byId("h-syndrome").textContent = res.syndrome.toString(2) || "0";
    byId("h-overall").textContent = res.overallParityOk;
    byId("h-classification").textContent = res.classification;
    byId("h-corrected").textContent = res.corrected;
  });
}

/* ---------- Init ---------- */

window.addEventListener("DOMContentLoaded", () => {
  initPWA();
  initModeSwitch();
  initKmapUI();
  initHammingUI();
});
