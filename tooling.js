/* =====================================================================
 * EV Tooling OCR - press tooling concept generator
 * Builds a preliminary progressive-die concept from the parsed part data.
 * Everything geometric that the .prt cannot supply is stated as an
 * assumption (A1..A5) and shown on the document itself.
 * ===================================================================*/
(function (root) {
  "use strict";

  var PRESSES = [25, 40, 63, 80, 100, 125, 160, 200, 250, 315];

  function stdPress(t) {
    for (var i = 0; i < PRESSES.length; i++) if (PRESSES[i] >= t) return PRESSES[i];
    return PRESSES[PRESSES.length - 1];
  }

  /* ---------------- engineering model ---------------- */

  function compute(r) {
    var p = r.part, d = r.derived;
    var t = p.thickMm || 1.2;
    var W = p.widthMm || 100, D = p.depthMm || 30, H = p.heightMm || 25;
    var Ablank = d.blankAreaMm2 || (W * D * 0.8);
    var perim = d.perimeterMm || 2 * (W + D);
    var L = d.blankLenEstMm || Ablank / D;

    // material grade -> tensile strength estimate
    var m = /CR\s*(\d{3})/i.exec(String(p.material || ""));
    var grade = m ? parseInt(m[1], 10) : 240;
    var uts = Math.min(590, Math.max(340, grade * 1.75));   // MPa
    var tau = 0.8 * uts;                                     // shear, MPa

    // blanking clearance & forming gap
    var clr = 0.05 * t;                 // 5 % t per side (burr-free note drives it low)
    var gap = t + 0.05;                 // forming gap

    // strip layout (feed along the developed length)
    var edge = Math.max(1.5 * t, 1.5);
    var bridge = Math.max(1.2 * t, 2.0);
    var stripW = D + 2 * edge;
    var pitch = L + bridge;
    var util = (Ablank / (stripW * pitch)) * 100;
    var rho = 7.85e-6;                  // kg/mm3
    var scrapG = ((stripW * pitch) - Ablank) * t * rho * 1000;
    var coilW = Math.ceil(stripW / 5) * 5;

    // forces (kN)
    var holes = 3, holeDia = 5;                       // ASSUMPTION A2
    var Ftrim = (perim * t * tau) / 1000;
    var Fpierce = (holes * Math.PI * holeDia * t * tau) / 1000;
    var Ri = 1.5 * t;
    var Fbend = (1.33 * uts * D * t * t) / ((Ri + t) * 1000);
    var Frestrike = 0.5 * Fbend;
    var Fcushion = 0.15 * (Ftrim + Fpierce + Fbend);
    var Ftotal = Ftrim + Fpierce + Fbend + Frestrike;
    var designT = (Ftotal * 1.3) / 9.81;
    var pressT = stdPress(designT * 1.5);             // snap-through shock allowance

    // die set envelope
    var stations = 6;                                  // 5 active + 1 idle
    var dieL = Math.round((stations * pitch + 2 * 180) / 10) * 10;
    var dieW = Math.round((stripW + 2 * 200) / 10) * 10;

    // cost (RM, Malaysian toolroom basis)
    var costBase = 48000;
    var costPerStation = 6500;
    var costCam = 10000;
    var toolCost = costBase + stations * costPerStation;

    return {
      t: t, W: W, D: D, H: H, Ablank: Ablank, perim: perim, L: L,
      grade: grade, uts: uts, tau: tau, clr: clr, gap: gap,
      edge: edge, bridge: bridge, stripW: stripW, pitch: pitch, util: util,
      scrapG: scrapG, coilW: coilW, Ri: Ri,
      holes: holes, holeDia: holeDia,
      Ftrim: Ftrim, Fpierce: Fpierce, Fbend: Fbend, Frestrike: Frestrike,
      Fcushion: Fcushion, Ftotal: Ftotal, designT: designT, pressT: pressT,
      stations: stations, dieL: dieL, dieW: dieW,
      toolCost: toolCost, costCam: costCam
    };
  }

  /* ---------------- rendering helpers ---------------- */

  function field(k, v, cls) {
    return "<div class='field" + (cls ? " " + cls : "") + "'><div class='k'>" + k +
      "</div><div class='v'>" + (v === "" || v == null ? "&mdash;" : v) + "</div></div>";
  }

  function stripSvg(c) {
    // schematic coil strip: 6 stations, feed left -> right
    var vw = 640, vh = 150;
    var x0 = 34, y0 = 46, sw = vw - 2 * x0;
    var sh = Math.min(58, Math.max(42, 2600 / c.stripW));
    var bandW = sw / 6;
    var s = "<svg viewBox='0 0 " + vw + " " + vh + "' width='100%' preserveAspectRatio='xMidYMid meet'>";
    s += "<rect x='" + x0 + "' y='" + y0 + "' width='" + sw + "' height='" + sh +
      "' fill='#f2f6fa' stroke='#8296a8' stroke-width='1.2'/>";
    for (var i = 1; i < 6; i++) {
      s += "<line x1='" + (x0 + i * bandW) + "' y1='" + y0 + "' x2='" + (x0 + i * bandW) +
        "' y2='" + (y0 + sh) + "' stroke='#b9c6d2' stroke-width='1' stroke-dasharray='3 3'/>";
    }
    var labels = ["pierce\npilots", "pierce +\ntrim", "pre-form", "final\nform", "restrike", "cut-off\n(idle)"];
    for (var j = 0; j < 6; j++) {
      var cx = x0 + bandW * (j + 0.5);
      // simplified blank outline
      s += "<rect x='" + (cx - bandW * 0.26) + "' y='" + (y0 + sh * 0.22) + "' width='" + (bandW * 0.52) +
        "' height='" + (sh * 0.56) + "' rx='2' fill='" + (j === 5 ? "#ffffff" : "#dce8f3") +
        "' stroke='#0a528c' stroke-width='1.3'/>";
      if (j >= 4) {
        s += "<line x1='" + (cx - bandW * 0.26) + "' y1='" + (y0 + sh * 0.5) + "' x2='" + (cx + bandW * 0.26) +
          "' y2='" + (y0 + sh * 0.5) + "' stroke='#0a528c' stroke-width='1.3'/>";
      }
      var parts = labels[j].split("\n");
      s += "<text x='" + cx + "' y='" + (y0 + sh + 16) + "' text-anchor='middle' font-size='9'" +
        " font-family='monospace' fill='#5c6670'>S" + (j + 1) + "</text>";
      s += "<text x='" + cx + "' y='" + (y0 + sh + 28) + "' text-anchor='middle' font-size='8.5'" +
        " font-family='sans-serif' fill='#17202a'>" + parts[0] + "</text>";
      if (parts[1]) {
        s += "<text x='" + cx + "' y='" + (y0 + sh + 38) + "' text-anchor='middle' font-size='8.5'" +
          " font-family='sans-serif' fill='#17202a'>" + parts[1] + "</text>";
      }
    }
    // pitch dimension
    s += "<line x1='" + x0 + "' y1='" + (y0 - 14) + "' x2='" + (x0 + bandW) + "' y2='" + (y0 - 14) +
      "' stroke='#a66006' stroke-width='1'/>";
    s += "<text x='" + (x0 + bandW / 2) + "' y='" + (y0 - 19) + "' text-anchor='middle' font-size='9'" +
      " font-family='monospace' fill='#a66006'>pitch " + c.pitch.toFixed(1) + "</text>";
    // feed arrow
    s += "<text x='" + (x0 + sw) + "' y='" + (y0 - 19) + "' text-anchor='end' font-size='9'" +
      " font-family='monospace' fill='#5c6670'>feed &rarr;</text>";
    s += "<text x='" + x0 + "' y='" + (y0 + sh + 54) + "' font-size='8.5' font-family='monospace'" +
      " fill='#5c6670'>strip " + c.coilW + " mm wide &middot; schematic, not the die layout</text>";
    s += "</svg>";
    return s;
  }

  function bar(segments) {
    var total = segments.reduce(function (a, b) { return a + b[1]; }, 0);
    var h = "<div class='bars'>";
    segments.forEach(function (s, i) {
      h += "<div class='bar-seg s" + (i % 5) + "' style='flex:" + s[1] + "'>" +
        "<span>" + s[0] + "</span><b>" + s[1] + "w</b></div>";
    });
    h += "</div><p class='bar-note'>Total " + total + " weeks from design release to PPAP support.</p>";
    return h;
  }

  /* ---------------- main render ---------------- */

  function render(r) {
    var p = r.part, f = r.fmt, sc = r.scrub;
    var c = compute(r);

    var body = root.document.getElementById("toolingBody");
    if (!body) return;

    /* --- 1. basis --- */
    var basis =
      "<div class='fields'>" +
      field("Part", sc(p.pn || "-")) +
      field("Material / grade", sc(p.material || "-")) +
      field("Thickness", f(c.t, 3) + " mm") +
      field("Envelope", f(c.W, 2) + " &times; " + f(c.D, 2) + " &times; " + f(c.H, 2) + " mm") +
      field("Developed blank area", f(c.Ablank, 1) + " mm&sup2;") +
      field("Developed length (feed dir.)", f(c.L, 1) + " mm") +
      field("Tensile strength (est.)", Math.round(c.uts) + " MPa <span class='tiny'>from grade</span>") +
      field("Blanking clearance", f(c.clr, 3) + " mm/side (5 % t)") +
      field("Forming gap", f(c.gap, 2) + " mm") +
      field("Bend inner radius (asm.)", f(c.Ri, 2) + " mm (1.5 t)") +
      "</div>";

    /* --- 2. route --- */
    var routes = [
      ["Stations / operations", "6 stations (5 active + 1 idle)", "4 line dies (OP10-OP40)", "5-6 stations + transfer"],
      ["Economic volume", "&gt; 30 000 pcs/yr", "3 000 - 30 000 pcs/yr", "&gt; 150 000 pcs/yr"],
      ["Tool cost (budget)", "RM " + (c.toolCost / 1000).toFixed(0) + "k", "RM 30k - 45k", "RM 120k +"],
      ["Lead time", "12 - 14 weeks to T0", "8 - 10 weeks", "16 - 20 weeks"],
      ["Output", "40 - 60 strokes/min, 1 press", "15 - 25 strokes/min, 3-4 presses", "30 - 40 pcs/min"],
      ["Direct labour", "1 operator", "3 - 4 operators", "0 - 1 operator"],
      ["ECO flexibility", "low - strip layout locked", "high - single op changes", "low"],
      ["Fit for this part", "recommended at volume", "dev phase / low volume", "not justified - part too small"]
    ];
    var routeRows = routes.map(function (x) {
      return "<tr><td class='muted'>" + x[0] + "</td><td>" + x[1] + "</td><td>" + x[2] + "</td><td>" + x[3] + "</td></tr>";
    }).join("");

    /* --- 3. stations --- */
    var st = [
      ["S1", "Pierce 2 pilot holes &Oslash;3.0 + notch", "Locates every later station - a progressive die cannot blank a closed contour and keep the part in the strip"],
      ["S2", "Pierce part holes + trim 60 % of outline", "Holes are pierced before forming so the surrounding material is not stretched"],
      ["S3", "Pre-form - first 90&deg; bend", "Separated from the final bend so the material is not worked twice in one stroke"],
      ["S4", "Final form - opposite bend + coin radius", "Completes the Z / S profile; coins out springback of " + (c.grade >= 240 ? "BH-grade " : "") + "steel"],
      ["S5", "Restrike / calibrate (+ cam if needed)", "Holds the profile band; carries cam piercing when holes sit in vertical walls"],
      ["S6", "Cut-off / separate (kept idle)", "Separates the part from the carrier; spare station for a deburr insert"]
    ];
    var stRows = st.map(function (s) {
      return "<tr><td class='num'>" + s[0] + "</td><td>" + s[1] + "</td><td class='muted'>" + s[2] + "</td></tr>";
    }).join("");

    /* --- 4. forces --- */
    var forces = [
      ["Trim / notch", "P &middot; t &middot; &tau;", f(c.Ftrim, 1), "kN", (c.Ftrim / 9.81).toFixed(1)],
      ["Pierce " + c.holes + " &times; &Oslash;" + c.holeDia + " (asm.)", "&Sigma;&pi;d &middot; t &middot; &tau;", f(c.Fpierce, 1), "kN", (c.Fpierce / 9.81).toFixed(1)],
      ["Bend / form", "1.33 &middot; &sigma;<sub>B</sub> &middot; b &middot; t&sup2; / (Ri + t)", f(c.Fbend, 1), "kN", (c.Fbend / 9.81).toFixed(1)],
      ["Restrike / calibrate", "0.5 &middot; F<sub>bend</sub>", f(c.Frestrike, 1), "kN", (c.Frestrike / 9.81).toFixed(1)],
      ["Cushion / pressure pad", "0.15 &middot; (F<sub>trim</sub> + F<sub>pierce</sub> + F<sub>bend</sub>)", f(c.Fcushion, 1), "kN", (c.Fcushion / 9.81).toFixed(1)]
    ];
    var fRows = forces.map(function (x) {
      return "<tr><td>" + x[0] + "</td><td class='mono muted'>" + x[1] + "</td><td class='c mono'>" + x[2] +
        "</td><td class='c muted'>" + x[3] + "</td><td class='c mono muted'>" + x[4] + "</td></tr>";
    }).join("");

    /* --- 5. cost --- */
    var costRows = [
      ["Die design + strip layout approval", "RM 8 000", "3 weeks"],
      ["Die build (6-station progressive, SKD11 inserts)", "RM " + (c.toolCost - 8000).toLocaleString(), "10 weeks"],
      ["T0 tryout + correction loops", "RM 6 000", "4 weeks"],
      ["PPAP / FAI support + run-at-rate", "RM 3 000", "2 weeks"],
      ["Cam unit (only if side-wall holes)", "+ RM " + c.costCam.toLocaleString(), "+ 2 weeks"]
    ];
    var costRowsHtml = costRows.map(function (x) {
      return "<tr><td>" + x[0] + "</td><td class='c mono'>" + x[1] + "</td><td class='c muted'>" + x[2] + "</td></tr>";
    }).join("");

    body.innerHTML =
      "<h3>1. Basis <span class='src-note'>&mdash; from the part file, everything else is stated as an assumption</span></h3>" + basis +

      "<h3 class='mt'>2. Process route</h3>" +
      "<table class='doc'><thead><tr><th>Criterion</th><th>Progressive die</th><th>Line dies (tandem)</th>" +
      "<th>Transfer die</th></tr></thead><tbody>" + routeRows + "</tbody></table>" +
      "<div class='callout'><b>Recommendation:</b> 6-station progressive die &mdash; 5 forming / piercing operations + 1 idle. " +
      "Below ~30 000 pcs/yr the 4-operation line-die route has the lower total cost of ownership " +
      "(about RM 35k less tooling and modifiable per ECO); above that the progressive die wins on piece price within 6-9 months.</div>" +

      "<h3 class='mt'>3. Station logic <span class='src-note'>&mdash; why five operations, not three</span></h3>" +
      "<table class='doc'><thead><tr><th class='num'>Stn</th><th>Operation</th><th>Reason</th></tr></thead><tbody>" +
      stRows + "</tbody></table>" +

      "<h3 class='mt'>4. Strip &amp; material utilisation</h3>" +
      "<div class='sketch'>" + stripSvg(c) + "</div>" +
      "<div class='fields'>" +
      field("Strip width", f(c.stripW, 1) + " mm (edge " + f(c.edge, 2) + ")") +
      field("Pitch", f(c.pitch, 1) + " mm (bridge " + f(c.bridge, 2) + ")") +
      field("Material utilisation", f(c.util, 1) + " %") +
      field("Scrap per part", f(c.scrapG, 2) + " g") +
      field("Coil width", c.coilW + " mm") +
      field("Flat blank (approx)", f(c.L, 0) + " &times; " + f(c.D, 0) + " mm") +
      field("Die set envelope", c.dieL + " &times; " + c.dieW + " mm") +
      field("Stations", c.stations + " (5 active + 1 idle)") +
      "</div>" +

      "<h3 class='mt'>5. Force calculation &amp; press selection</h3>" +
      "<table class='doc'><thead><tr><th>Component</th><th>Formula</th><th class='c'>kN</th>" +
      "<th class='c'>unit</th><th class='c'>tonnes</th></tr></thead><tbody>" + fRows +
      "<tr><td><b>Working force total</b></td><td class='mono muted'>&Sigma; F</td><td class='c mono'><b>" +
      f(c.Ftotal, 1) + "</b></td><td class='c'></td><td class='c mono'><b>" + (c.Ftotal / 9.81).toFixed(1) + "</b></td></tr>" +
      "<tr><td>Design tonnage</td><td class='mono muted'>F<sub>total</sub> &middot; 1.3 / g</td><td class='c mono'>" +
      (c.designT * 9.81).toFixed(0) + "</td><td class='c'>kN</td><td class='c mono'>" + f(c.designT, 1) + "</td></tr>" +
      "</tbody></table>" +
      "<div class='callout'><b>Press:</b> " + c.pressT + " t straight-side press &mdash; design tonnage &times; 1.5 to absorb snap-through shock, " +
      "with bolster and shut height confirmed against the toolmaker's press list.</div>" +

      "<h3 class='mt'>6. Die specification</h3>" +
      "<div class='fields'>" +
      field("Die set", c.dieL + " &times; " + c.dieW + " mm, 4-pillar ball guide") +
      field("Guide pillars", "4 &times; &Oslash;32 mm") +
      field("Inserts", "SKD11, wire-cut, 60-62 HRC") +
      field("Coating", "TiCN-PVD on forming radii (Zn galling)") +
      field("Blanking clearance", f(c.clr, 3) + " mm/side &mdash; burr-free requirement forces 5 % t") +
      field("Forming gap", f(c.gap, 2) + " mm") +
      field("Cushion", f(c.Fcushion, 0) + " kN pressure pad") +
      field("Feed", "servo roll feed, " + c.coilW + " mm coil") +
      field("Strip lift", "5-8 mm, spring stripper + pilots") +
      "</div>" +

      "<h3 class='mt'>7. Cost &amp; timing</h3>" +
      "<table class='doc'><thead><tr><th>Item</th><th class='c'>Budget</th><th class='c'>Duration</th></tr></thead><tbody>" +
      costRowsHtml +
      "<tr><td><b>Total (no cam)</b></td><td class='c mono'><b>RM " + c.toolCost.toLocaleString() +
      "</b></td><td class='c muted'>19 weeks</td></tr></tbody></table>" +
      bar([["Design", 3], ["Die build", 10], ["T0 tryout", 2], ["T1 + corrections", 2], ["PPAP", 2]]) +

      "<h3 class='mt'>8. Assumptions &amp; open items</h3>" +
      "<table class='doc'><thead><tr><th class='num'>#</th><th>Assumption</th><th>Consequence if wrong</th></tr></thead><tbody>" +
      "<tr><td class='num'>A1</td><td>2 primary 90&deg; bends (Z / S profile), Ri 1.5 t = " + f(c.Ri, 1) + " mm</td><td class='muted'>Extra bend = extra station, +RM 6.5k</td></tr>" +
      "<tr><td class='num'>A2</td><td>" + c.holes + " pierced holes &Oslash;" + c.holeDia + " mm, all on flat faces</td><td class='muted'>Side-wall holes need a cam, +RM 10k, +2 weeks</td></tr>" +
      "<tr><td class='num'>A3</td><td>Strip fed along the developed length, single centre carrier</td><td class='muted'>Different feed changes strip width and die size</td></tr>" +
      "<tr><td class='num'>A4</td><td>30 000 - 200 000 pcs/yr</td><td class='muted'>Below 30k the line-die route is cheaper</td></tr>" +
      "<tr><td class='num'>A5</td><td>Burr-free note satisfied by 5 % t clearance</td><td class='muted'>May need shave tool or deburr insert</td></tr>" +
      "</tbody></table>" +
      "<div class='callout warn'><b>Before die design freeze:</b> NX flat pattern with bend lines and hole coordinates, " +
      "PMI export (PMI XML / STEP AP242 / JT) for radii, angles and hole positions, annual volume, and the available press list. " +
      "Every geometry-dependent value above is an assumption until those arrive.</div>" +

      "<div class='disclaimer'><strong>Preliminary concept &mdash; not a die drawing.</strong> " +
      "Station count and process logic are firm for this part class; punch sizes, bend angles, cam requirement and strip " +
      "layout must be re-confirmed against the NX flat pattern. Generated in the browser from the part attributes.</div>";
  }

  root.ToolingDoc = { render: render, compute: compute };
})(typeof self !== "undefined" ? self : this);
