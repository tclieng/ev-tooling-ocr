/* =====================================================================
 * EV Tooling OCR - UI logic
 * ===================================================================*/
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var dropzone = $("dropzone");
  var fileInput = $("fileInput");
  var uploadPanel = $("uploadPanel");
  var result = $("result");
  var uploadError = $("uploadError");

  /* ---------------- demo part (fictional, SBOX) ---------------- */

  function demoResult() {
    var t = 1.5;
    var V = 7250.4, A = 10212.4, m = 0.0569156, rho = 7.85e-06;
    var W = 120.43, D = 38.21, H = 26.64;
    var attrs = {
      "Enterprise Number": "P600-1104055-AA",
      "DB_PART_NO": "718902",
      "DB_PART_NAME": "ASSY_BRACKET_DOOR_TRIM_MTG_FR_FRH",
      "DB_PART_REV": "B",
      "DB_PART_TYPE": "Sb4_Design_Part",
      "SBOX_Material": "CR210-GI60/60-U",
      "Nom Thick": String(t),
      "NX_Mass": String(m),
      "NX_Volume": String(V),
      "NX_Area": String(A),
      "NX_Density": String(rho),
      "Width": String(W), "Depth": String(D), "Height": String(H),
      "Tooling Type": "Hard",
      "Service Relevant": "NFS",
      "Func Safety": "false",
      "Safety Rel": "false",
      "Elec Interface": "false",
      "DB_SEED_PART_USED": "@DB/SBOX_Model_Template/01"
    };
    var notes = [
      "-UNLESS OTHERWISE SPECIFIED:",
      "ALL GENERAL SURFACES:",
      "ALL GENERAL TRIM EDGES:",
      "ALL FEATURES OF SIZE, SIZE TOLERANCE: +/-0.5",
      "ALL GENERAL FUNCTION HOLES DESIGNATED <D3> <D>:",
      "ALL FUNCTION HOLE SIZE: +0.2/-0",
      "GENERAL TOLERANCES AND SURFACES FOR SHEET METAL ACCORDING TO SBOX ST000234.",
      "DATUM SCHEME AND REQUIREMENTS ACCORDING TO ASME Y14.5-2018.",
      "FOR DRAWING RELATED INFORMATION SEE 3DPMI.",
      "ALL EDGES SHOULD BE BURR AND FRACTURES FREE.",
      "PART MARKING ACCORDING TO STANDARD SBOX ST000255.",
      "HAZARDOUS SUBSTANCES PER SBOX ST000250-1/-2/-4.",
      "MATERIAL AND COATING (STEEL): SBOX ST000010-1 to -11.",
      "CAD DESIGN STANDARD ACCORDING TO SBOX ST000065.",
      "DRAFTED IN ACCORDANCE WITH SBOX MOTORS PLM STANDARDS.",
      "SUPPLIER CHANGES (DIMENSIONS, MATERIAL, PROCESS, SITE, TEXT) REQUIRE SBOX APPROVAL."
    ];
    return {
      ok: true,
      demo: true,
      fileSize: 812340,
      attrs: attrs,
      part: {
        pn: "P600-1104055-AA", itemNo: "718902",
        name: "ASSY_BRACKET_DOOR_TRIM_MTG_FR_FRH", rev: "B",
        type: "Sb4_Design_Part", material: "CR210-GI60/60-U",
        thickMm: t, massKg: m, volumeMm3: V, areaMm2: A, density: rho,
        widthMm: W, depthMm: D, heightMm: H,
        tooling: "Hard", service: "NFS", funcSafety: "false",
        safetyRel: "false", elec: "false",
        seed: "@DB/SBOX_Model_Template/01", ok: true
      },
      derived: PrtParser.parse && (function () {
        return {
          blankAreaMm2: V / t,
          edgeAreaMm2: A - 2 * (V / t),
          perimeterMm: (A - 2 * (V / t)) / t,
          densityCheck: (m / V) * 1e6,
          massPerArea: (m * 1000) / (V / t),
          blankLenEstMm: (V / t) / D,
          areaRatio: A / (W * D)
        };
      })(),
      notes: notes,
      previews: [],
      warnings: [],
      fmt: PrtParser.fmt,
      scrub: PrtParser.scrub,
      friendlyLabel: function (t2) { return t2; }
    };
  }

  /* ---------------- rendering ---------------- */

  function metric(k, v, u) {
    return '<div class="metric"><div class="k">' + k + '</div><div class="v">' + v +
      (u ? ' <span class="u">' + u + "</span>" : "") + "</div></div>";
  }

  function row(k, v, dim) {
    return "<tr><td class='k'>" + k + "</td><td class='v" + (dim ? " muted" : "") + "'>" +
      (v === "" || v == null ? "-" : v) + "</td></tr>";
  }

  function render(r) {
    var p = r.part, d = r.derived, f = r.fmt;

    $("rPn").textContent = r.scrub(p.pn || "(part number not found)");
    $("rName").textContent = r.scrub(p.name || "");
    $("rRev").textContent = "REV " + (p.rev || "-");
    $("rSrc").textContent = r.demo ? "DEMO PART" :
      (r.fileSize > 1e6 ? (r.fileSize / 1e6).toFixed(1) + " MB" : Math.round(r.fileSize / 1024) + " KB");

    // warnings
    var w = $("rWarnings");
    if (r.warnings && r.warnings.length) {
      w.classList.remove("hidden");
      w.innerHTML = r.warnings.map(function (x) { return "<div>" + x + "</div>"; }).join("");
    } else w.classList.add("hidden");

    // metrics
    $("rMetrics").innerHTML =
      metric("Material", r.scrub(p.material || "-")) +
      metric("Thickness", f(p.thickMm, 2), "mm") +
      metric("Mass", f(p.massKg * 1000, 2), "g") +
      metric("Envelope", p.widthMm ? f(p.widthMm, 2) + " &times; " + f(p.depthMm, 2) + " &times; " + f(p.heightMm, 2) : "-", "mm") +
      metric("Volume", f(p.volumeMm3, 2), "mm&sup3;") +
      metric("Tooling", r.scrub(p.tooling || "-"));

    // attributes table
    var LABEL_ORDER = [
      ["Enterprise Number", "Part number"],
      ["DB_PART_NO", "Item number"],
      ["DB_PART_NAME", "Part name"],
      ["DB_PART_REV", "Revision"],
      ["DB_PART_TYPE", "Part type"],
      ["SBOX_Material", "Material"],
      ["Nom Thick", "Nominal thickness"],
      ["NX_Mass", "Mass (kg)"],
      ["NX_Volume", "Volume (mm&sup3;)"],
      ["NX_Area", "Surface area (mm&sup2;)"],
      ["NX_Density", "Density (kg/mm&sup3;)"],
      ["Width", "Envelope width (mm)"],
      ["Depth", "Envelope depth (mm)"],
      ["Height", "Envelope height (mm)"],
      ["Tooling Type", "Tooling type"],
      ["Service Relevant", "Service relevant"],
      ["Func Safety", "Functional safety"],
      ["Safety Rel", "Safety relevant"],
      ["Elec Interface", "Electrical interface"],
      ["DB_SEED_PART_USED", "Seed part"]
    ];
    var rowsHtml = "";
    var used = {};
    LABEL_ORDER.forEach(function (pair) {
      if (r.attrs[pair[0]] !== undefined && !used[pair[1]]) {
        rowsHtml += row(pair[1], r.scrub(r.attrs[pair[0]]));
        used[pair[1]] = 1;
      }
    });
    // any other attributes worth showing (skip noise)
    Object.keys(r.attrs).forEach(function (k) {
      if (/^(NX_|DB_).*(Source|MissingAssignments|MultipleAssigned|ComponentGroup|ReferenceSet|MFKID|REV_DESC|REV_NAME|PART_DESC)$/.test(k)) return;
      if (used[r.friendlyLabel(k)]) return;
      rowsHtml += row(r.friendlyLabel(k), r.scrub(r.attrs[k]));
    });
    $("rAttrs").innerHTML = rowsHtml || "<tr><td class='k'>No attributes found</td><td class='v'>-</td></tr>";

    // derived table
    function drow(k, formula, v, u) {
      return "<tr><td class='k'>" + k + " <span class='small muted mono'>" + formula + "</span></td><td class='v'>" +
        v + (u ? " " + u : "") + "</td></tr>";
    }
    var dh = "";
    if (d.blankAreaMm2) dh += drow("Developed blank area", "V / t", f(d.blankAreaMm2, 2), "mm&sup2;");
    if (d.edgeAreaMm2 != null) dh += drow("Edge area", "A &minus; 2&middot;A<sub>blank</sub>", f(d.edgeAreaMm2, 2), "mm&sup2;");
    if (d.perimeterMm) dh += drow("Outline perimeter (est.)", "A<sub>edge</sub> / t", f(d.perimeterMm, 1), "mm");
    if (d.blankLenEstMm) dh += drow("Blank length (est.)", "A<sub>blank</sub> / D", f(d.blankLenEstMm, 1), "mm");
    if (d.areaRatio != null) dh += drow("Area / footprint ratio", "A / (W&middot;D)", f(d.areaRatio, 3), "&gt;1 = bent part");
    if (d.densityCheck != null) dh += drow("Density check", "m / V", f(d.densityCheck, 4), "g/cm&sup3;");
    if (d.massPerArea) dh += drow("Mass per area", "m / A<sub>blank</sub>", f(d.massPerArea, 2), "kg/m&sup2;");
    $("rDerived").innerHTML = dh || "<tr><td class='k'>Not enough data to derive dimensions</td><td class='v'>-</td></tr>";

    // preview
    var pv = $("rPreview");
    if (r.previews && r.previews.length) {
      var biggest = r.previews.reduce(function (a, b) { return b.len > a.len ? b : a; });
      try {
        var b64 = btoa(biggest.data);
        pv.innerHTML = "<img alt='embedded preview' src='data:image/jpeg;base64," + b64 + "'>";
      } catch (e) {
        pv.innerHTML = "<p class='muted small'>Preview found but could not be decoded.</p>";
      }
    } else if (r.demo) {
      pv.innerHTML = demoSvg();
    } else {
      pv.innerHTML = "<p class='muted small'>No preview found in this file.</p>";
    }

    // notes
    var nw = $("notesWrap");
    if (r.notes && r.notes.length) {
      nw.classList.remove("hidden");
      $("rNotes").innerHTML = r.notes.map(function (n) { return "<li>" + escapeHtml(n) + "</li>"; }).join("");
    } else nw.classList.add("hidden");

    uploadPanel.classList.add("hidden");
    result.classList.remove("hidden");
    renderTooling(r);
    renderPpap(r);
    showTab("data");
    window.scrollTo(0, 0);
  }

  function renderTooling(r) {
    $("tPn").textContent = r.scrub(r.part.pn || "(part number not found)");
    $("tName").textContent = r.scrub(r.part.name || "");
    $("tRev").textContent = "REV " + (r.part.rev || "-");
    if (window.ToolingDoc) {
      var c = ToolingDoc.compute(r);
      $("tPress").textContent = c.pressT + " t press";
      ToolingDoc.render(r);
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function demoSvg() {
    return "<svg viewBox='0 0 240 120' width='240' height='120'>" +
      "<path d='M20 80 L20 40 L100 40 L100 90 L220 90' fill='none' stroke='#0a528c' stroke-width='10' stroke-linejoin='round'/>" +
      "<circle cx='45' cy='60' r='5' fill='#fff' stroke='#0a528c' stroke-width='3'/>" +
      "<circle cx='150' cy='90' r='5' fill='#fff' stroke='#0a528c' stroke-width='3'/>" +
      "<circle cx='190' cy='90' r='5' fill='#fff' stroke='#0a528c' stroke-width='3'/>" +
      "<text x='120' y='22' text-anchor='middle' font-size='10' fill='#5c6670' font-family='monospace'>fictional demo part - schematic</text></svg>";
  }

  /* ---------------- PPAP / FAI document ---------------- */

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function chip(s) {
    var m = { VER: "ver", DER: "der", ASM: "asm", TBC: "tbc", "N/A": "na" };
    return "<span class='st " + (m[s] || "tbc") + "'>" + s + "</span>";
  }

  function field(k, v, cls) {
    return "<div class='field" + (cls ? " " + cls : "") + "'><div class='k'>" + k +
      "</div><div class='v'>" + (v === "" || v == null ? "&mdash;" : v) + "</div></div>";
  }

  // derive coating mass from a material designation such as ...-GI50/50-U
  function coatingFrom(material) {
    var m = /GI\s*(\d+)\s*\/\s*(\d+)/i.exec(String(material || ""));
    return m ? m[1] + " / " + m[2] + " g/m&sup2; (both faces)" : "see material spec";
  }

  function renderPpap(r) {
    var p = r.part, d = r.derived, f = r.fmt, sc = r.scrub;
    var now = new Date();
    var dateStr = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
    var docId = "PPAP-" + (sc(p.pn) || "PART") + "-R" + (p.rev || "0") + "-" + dateStr.replace(/-/g, "");

    $("pPn").textContent = sc(p.pn || "(part number not found)");
    $("pName").textContent = sc(p.name || "");
    $("pRev").textContent = "REV " + (p.rev || "-");
    $("pDocId").textContent = docId;

    var visible = !/NFS/i.test(String(p.service || ""));
    var safety = /true/i.test(String(p.safetyRel || "false")) || /true/i.test(String(p.funcSafety || "false"));
    var t = p.thickMm || 0;
    var burr = t ? (t * 0.10) : null;

    /* ---- 1. PSW header ---- */
    var psw =
      "<div class='fields'>" +
      field("Customer part number", sc(p.pn || "-")) +
      field("Part name", sc(p.name || "-")) +
      field("Item / drawing no.", sc(p.itemNo || "-")) +
      field("Engineering change level", p.rev || "-") +
      field("Material specification", sc(p.material || "-")) +
      field("Weight (kg)", p.massKg ? f(p.massKg, 4) : "-") +
      field("Nominal thickness", t ? f(t, 3) + " mm" : "-") +
      field("Submission level", "3 &mdash; all elements incl. samples") +
      field("Reason for submission", "1 &mdash; initial submission of a new part") +
      field("Part safety / regulatory", safety ? "YES &mdash; flag raised in model" : "No") +
      field("Appearance item", visible ? "YES &mdash; AAR required" : "NFS non-visible &mdash; AAR n/a") +
      field("Tooling type", sc(p.tooling || "-")) +
      field("Document ID", docId) +
      field("Generated", dateStr + " &middot; browser, offline") +
      field("Source model", sc(p.seed || "NX .prt")) +
      "</div>";

    /* ---- 2. PPAP element status (AIAG 4th ed, 18 elements) ---- */
    var els = [
      ["1", "Design records of the finished part", "DER", "NX model attributes read; released drawing PDF still to be attached"],
      ["2", "Engineering change documents", "TBC", "No change history inside the .prt — request from PLM"],
      ["3", "Customer engineering approval", "N/A", "Only required when a deviation is requested"],
      ["4", "DFMEA", "N/A", "Customer-owned design; supplier PFMEA is element 6"],
      ["5", "Process flow diagram", "DER", "Derived from the station logic in section 4"],
      ["6", "PFMEA", "DER", "Outline generated; severity / occurrence to be confirmed by SQE"],
      ["7", "Control plan", "DER", "Prototype-level rows in section 5"],
      ["8", "Measurement system analysis", "TBC", "Needs parts + gauges — GRR after T1 tryout"],
      ["9", "Dimensional results", "DER", "Envelope + mass from the model; features are TBC (section 3)"],
      ["10", "Material / performance test results", "TBC", "Mill certs + coating test to be attached"],
      ["11", "Initial process studies", "TBC", "Run@rate lot required; Ppk &ge; 1.67 on profile"],
      ["12", "Qualified laboratory documentation", "TBC", "External lab scope to be attached"],
      ["13", "Appearance approval report", "N/A", visible ? "Part is appearance-relevant — AAR to be raised" : "Part is not appearance-relevant (NFS)"],
      ["14", "Sample production parts", "TBC", "Produced off the finished die, not before T0"],
      ["15", "Master sample", "TBC", "Signed sample after dimensional approval"],
      ["16", "Checking aids", "TBC", "Check fixture + gauge design after flat pattern"],
      ["17", "Customer-specific requirements", "TBC", "SBOX ST000xxx standards list to be confirmed"],
      ["18", "Part submission warrant (PSW)", "DER", "This document — signature blocks stay open"]
    ];
    var elRows = els.map(function (e) {
      return "<tr><td class='num'>" + e[0] + "</td><td>" + e[1] + "</td><td class='c'>" + chip(e[2]) +
        "</td><td class='muted'>" + e[3] + "</td></tr>";
    }).join("");

    /* ---- 3. FAI ballooned characteristics ---- */
    var fai = [
      ["1", "Overall width (envelope)", p.widthMm ? f(p.widthMm, 3) + " mm" : "-", "&plusmn;0.5", "CMM / caliper", "VER"],
      ["2", "Overall depth (envelope)", p.depthMm ? f(p.depthMm, 3) + " mm" : "-", "&plusmn;0.5", "CMM / caliper", "VER"],
      ["3", "Overall height (envelope)", p.heightMm ? f(p.heightMm, 3) + " mm" : "-", "&plusmn;0.5", "CMM / caliper", "VER"],
      ["4", "Sheet thickness", t ? f(t, 3) + " mm" : "-", "per material spec", "Micrometer", "VER"],
      ["5", "Mass", p.massKg ? f(p.massKg * 1000, 3) + " g" : "-", "reference", "Scale", "VER"],
      ["6", "Surface area", p.areaMm2 ? f(p.areaMm2, 2) + " mm&sup2;" : "-", "reference", "Computed from model", "VER"],
      ["7", "Developed blank area", d.blankAreaMm2 ? f(d.blankAreaMm2, 2) + " mm&sup2;" : "-", "reference", "V / t", "DER"],
      ["8", "Developed blank length", d.blankLenEstMm ? f(d.blankLenEstMm, 1) + " mm" : "-", "reference", "A<sub>blank</sub> / D", "DER"],
      ["9", "Hole diameters", "TBC", "+0.2 / -0", "Pin gauge", "TBC"],
      ["10", "Hole positions", "TBC", "per drawing", "CMM", "TBC"],
      ["11", "Bend angles", "TBC", "&plusmn;1&deg;", "CMM / angle gauge", "TBC"],
      ["12", "Bend radii", "TBC", "R1.5 &ndash; R2.0", "Radius gauge", "TBC"],
      ["13", "Profile tolerance", "TBC", "0.4 &ndash; 1.0", "CMM scan", "TBC"],
      ["14", "Burr height", burr ? "&le; " + f(burr, 3) + " mm" : "TBC", "10% of t", "Microscope / visual", burr ? "ASM" : "TBC"],
      ["15", "Material grade", sc(p.material || "-"), "mill cert", "Certificate review", "VER"],
      ["16", "Coating mass (Zn)", coatingFrom(p.material), "per material spec", "XRF / certificate", "TBC"],
      ["17", "Part marking", "per SBOX ST000255", "legible, permanent", "Visual", "VER"],
      ["18", "Paint / coating system", "per SBOX ST000240 (if black)", "per standard", "Visual / thickness gauge", "VER"]
    ];
    var faiRows = fai.map(function (c) {
      return "<tr><td class='num'>" + c[0] + "</td><td>" + c[1] + "</td><td class='mono'>" + c[2] +
        "</td><td class='c mono'>" + c[3] + "</td><td class='muted'>" + c[4] +
        "</td><td class='act'>&nbsp;</td><td class='c'>" + chip(c[5]) + "</td></tr>";
    }).join("");

    /* ---- 4. process / station logic ---- */
    var stations = [
      ["OP10", "Pierce pilot holes + notch", "Pilot &Oslash;3.0 location", "Each stroke", "Part not located &rarr; stop, check pilot pin"],
      ["OP20", "Pierce part holes + trim outline", "Hole dia / position", "1 per 30 min", "Adjust punch, quarantine since last check"],
      ["OP30", "Pre-form, first 90&deg; bend", "Bend angle (rough)", "1 per 30 min", "Re-set ram depth, verify with angle gauge"],
      ["OP40", "Final form + coin radius", "Profile / bend angle", "1 per 15 min", "Stop; springback compensation review"],
      ["OP50", "Restrike / calibrate", "Profile tolerance", "1 per 15 min", "Stop; die maintenance"],
      ["OP60", "Cut-off / separate", "Burr height, part complete", "1 per 30 min", "Sharpen cut-off insert"]
    ];
    var stRows = stations.map(function (s) {
      return "<tr><td class='num'>" + s[0] + "</td><td>" + s[1] + "</td><td class='muted'>" + s[2] +
        "</td><td class='muted'>" + s[3] + "</td><td class='muted'>" + s[4] + "</td></tr>";
    }).join("");

    /* ---- assemble ---- */
    var openCount = els.filter(function (e) { return e[2] === "TBC"; }).length;
    var derCount = els.filter(function (e) { return e[2] === "DER"; }).length;

    $("ppapBody").innerHTML =
      "<h3>1. Part submission warrant &mdash; header</h3>" + psw +

      "<h3 class='mt'>2. PPAP element status <span class='src-note'>&mdash; " + derCount +
      " auto-generated, " + openCount + " open</span></h3>" +
      "<table class='doc'><thead><tr><th class='num'>#</th><th>Element</th><th class='c'>Status</th>" +
      "<th>Evidence / comment</th></tr></thead><tbody>" + elRows + "</tbody></table>" +

      "<h3 class='mt'>3. FAI &mdash; ballooned characteristics <span class='src-note'>&mdash; fill the ACTUAL column on the part</span></h3>" +
      "<table class='doc'><thead><tr><th class='num'>Balloon</th><th>Characteristic</th><th>Nominal / spec</th>" +
      "<th class='c'>Tolerance</th><th>Method</th><th class='act'>Actual</th><th class='c'>Basis</th></tr></thead><tbody>" +
      faiRows + "</tbody></table>" +

      "<h3 class='mt'>4. Process flow &amp; control plan extract <span class='src-note'>&mdash; press line, generic for this part class</span></h3>" +
      "<table class='doc'><thead><tr><th class='num'>Op</th><th>Operation</th><th>Characteristic</th>" +
      "<th>Frequency</th><th>Reaction plan</th></tr></thead><tbody>" + stRows + "</tbody></table>" +

      "<div class='disclaimer'>" +
      "<strong>Auto-generated draft — not submitted evidence.</strong> Everything marked VER or DER is computed " +
      "live from this file. ASM rows are engineering assumptions; TBC rows cannot be closed until series parts " +
      "exist and the 3D PMI (hole sizes, positions, bend angles) is exported from NX. Elements 8, 9, 11 and 14 " +
      "are physically impossible before T1 tryout. " +
      "<strong>Do not submit this document as an approved PPAP.</strong>" +
      "</div>";
  }

  /* ---------------- file handling ---------------- */

  function handleFile(file) {
    uploadError.classList.add("hidden");
    if (!file) return;
    if (!/\.prt$/i.test(file.name)) {
      showError("'" + escapeHtml(file.name) + "' does not look like a .prt file. Siemens NX part files have the .prt extension.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var r = PrtParser.parse(reader.result);
        r.fileName = file.name;
        render(r);
      } catch (ex) {
        showError("Could not parse this file: " + ex.message);
      }
    };
    reader.onerror = function () { showError("Could not read the file."); };
    reader.readAsArrayBuffer(file);
  }

  function showError(msg) {
    uploadError.textContent = msg;
    uploadError.classList.remove("hidden");
  }

  function reset() {
    result.classList.add("hidden");
    uploadPanel.classList.remove("hidden");
    fileInput.value = "";
    window.scrollTo(0, 0);
  }

  /* ---------------- events ---------------- */

  function showTab(name) {
    var map = { data: "sheet", tooling: "toolingSheet", ppap: "ppapSheet" };
    Object.keys(map).forEach(function (k) {
      var doc = $(map[k]);
      if (doc) doc.classList.toggle("hidden", k !== name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-doc") === name);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.addEventListener("click", function () {
      showTab(b.getAttribute("data-doc"));
      window.scrollTo(0, 0);
    });
  });

  dropzone.addEventListener("click", function () { fileInput.click(); });
  dropzone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
  fileInput.addEventListener("change", function () { handleFile(fileInput.files[0]); });

  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  // dropping anywhere on the page
  ["dragover", "drop"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); });
  });

  $("demoBtn").addEventListener("click", function () { render(demoResult()); });
  $("printBtn").addEventListener("click", function () { window.print(); });
  $("againBtn").addEventListener("click", reset);

  // deep links: #demo opens the sample part, #demo-ppap / #demo-tooling open a document
  (function () {
    var h = (location.hash || "").replace("#", "");
    if (/^demo/.test(h)) {
      render(demoResult());
      if (h === "demo-ppap") showTab("ppap");
      else if (h === "demo-tooling") showTab("tooling");
    }
  })();
})();
