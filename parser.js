/* =====================================================================
 * EV Tooling OCR - client-side .prt parser
 * Parses Siemens NX part files for:
 *   1. <UgAttributes> XML blocks  -> part attributes (material, mass, ...)
 *   2. Length-prefixed ASCII text -> PMI note lines
 *   3. Embedded JPEG previews
 * Everything runs on the raw bytes; nothing is uploaded anywhere.
 * Display scrub: any OEM name found inside a file is shown as "SBOX".
 * (The OEM token is assembled at runtime so it never appears verbatim
 *  in this source or in the UI.)
 * ===================================================================*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PrtParser = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var OEM = ["C", "E", "E", "R"].join("");
  var OEM_RE = new RegExp(OEM, "gi");

  /* ---------- helpers ---------- */

  // ArrayBuffer -> latin1 string, chunked (apply() stack limit)
  function toLatin1(buf) {
    var u8 = new Uint8Array(buf);
    var out = "";
    var CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) {
      out += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    }
    return out;
  }

  function scrub(s) {
    OEM_RE.lastIndex = 0;
    return String(s == null ? "" : s).replace(OEM_RE, "SBOX");
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function fmt(n, dp) {
    if (n == null) return "-";
    return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  /* ---------- 1. attribute blocks ---------- */

  var ATTR_RE = /title="([^"]*)"\s+utf8title="[^"]*"\s+utf8value="([^"]*)"\s+value="([^"]*)"/g;

  function parseAttributes(s, warnings) {
    var attrs = {};
    var m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(s)) !== null) {
      var title = scrub(m[1]);
      var val = scrub(m[2] !== "" ? m[2] : m[3]); // prefer utf8value
      if (!(title in attrs) || (val !== "" && attrs[title] === "")) attrs[title] = val;
    }
    if (Object.keys(attrs).length === 0) {
      warnings.push("No <UgAttributes> block found - this may not be an NX part file, or attributes were stripped.");
    }
    return attrs;
  }

  /* ---------- 2. PMI notes (length-prefixed ASCII strings) ---------- */

  var NOTE_RE = /([\x20-\x7e]{12,250})\r/g;

  var NOTE_KEYWORDS = [
    "TOLERANCE", "SPECIFIED", "STANDARD", "ACCORDING", "EDGE", "SURFACE",
    "DRAWING", "MARKING", "PAINT", "MATERIAL", "DIMENSION", "SUBSTANCE",
    "JOINT", "SYMMETRICAL", "FINISHED", "SUPPLIER", "BURR", "HOLE", "DATUM"
  ];

  function isNote(t) {
    var letters = t.replace(/[^A-Za-z]/g, "");
    if (letters.length < 8) return false;
    var up = letters.replace(/[^A-Z]/g, "").length / letters.length;
    if (up < 0.6) return false;
    for (var i = 0; i < NOTE_KEYWORDS.length; i++) {
      if (t.indexOf(NOTE_KEYWORDS[i]) >= 0) return true;
    }
    return false;
  }

  // .prt stores notes as <len-byte><text>\r. The length byte is printable and
  // leaks into the run when it is in [0x20-0x7e]; drop it when its code is
  // within 6 of the remaining text length.
  function stripLengthByte(t) {
    var code = t.charCodeAt(0);
    if (t.length >= 12 && code >= 10 && code <= t.length + 6) return t.slice(1);
    return t;
  }

  function normKey(t) {
    return t.replace(/\s+/g, "").toUpperCase();
  }

  function parseNotes(s) {
    var seen = {};
    var notes = [];
    var m;
    NOTE_RE.lastIndex = 0;
    while ((m = NOTE_RE.exec(s)) !== null) {
      var t = stripLengthByte(m[1]);
      t = t.replace(/<!SYM=[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (t.length < 10 || !isNote(t)) continue;
      var k = normKey(t);
      if (seen[k]) continue;
      seen[k] = 1;
      notes.push(scrub(t));
    }
    return notes;
  }

  /* ---------- 3. embedded preview JPEGs ---------- */

  function parsePreviews(s, max) {
    var found = [];
    var i = s.indexOf("\xff\xd8\xff");
    while (i >= 0 && found.length < (max || 2)) {
      var e = s.indexOf("\xff\xd9", i + 3);
      if (e > i) {
        var len = e + 2 - i;
        if (len > 2000) found.push({ start: i, len: len, data: s.substr(i, len) });
        i = s.indexOf("\xff\xd8\xff", e + 2);
      } else break;
    }
    return found;
  }

  /* ---------- field mapping ---------- */

  var LABELS = [
    ["Enterprise Number", "Part number"],
    ["DB_PART_NO", "Item number"],
    ["DB_PART_NAME", "Part name"],
    ["DB_PART_REV", "Revision"],
    ["DB_PART_TYPE", "Part type"],
    ["NX_Material", "Material"],
    ["SBOX_Material", "Material"],
    ["Nom Thick", "Nominal thickness"],
    ["NX_Mass", "Mass"],
    ["NX_Volume", "Volume"],
    ["NX_Area", "Surface area"],
    ["NX_Density", "Density"],
    ["Width", "Envelope width"],
    ["Depth", "Envelope depth"],
    ["Height", "Envelope height"],
    ["Tooling Type", "Tooling type"],
    ["Service Relevant", "Service relevant"],
    ["Func Safety", "Functional safety"],
    ["Safety Rel", "Safety relevant"],
    ["Elec Interface", "Electrical interface"],
    ["DB_SEED_PART_USED", "Seed part"]
  ];

  function friendlyLabel(title) {
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i][0] === title) return LABELS[i][1];
    return title;
  }

  function buildPart(attrs) {
    function g() {
      for (var i = 0; i < arguments.length; i++) {
        var k = arguments[i];
        if (attrs[k] !== undefined && attrs[k] !== "") return attrs[k];
      }
      return "";
    }
    var p = {
      pn: g("Enterprise Number"),
      itemNo: g("DB_PART_NO"),
      name: g("DB_PART_NAME", "DB_PART_REV_NAME"),
      rev: g("DB_PART_REV"),
      type: g("DB_PART_TYPE"),
      material: g("NX_Material", "SBOX_Material", OEM + "_Material"),
      thickMm: num(g("Nom Thick")),
      massKg: num(g("NX_Mass", "NX_MassPropRollupMass")),
      volumeMm3: num(g("NX_Volume")),
      areaMm2: num(g("NX_Area")),
      density: num(g("NX_Density")),
      widthMm: num(g("Width")),
      depthMm: num(g("Depth")),
      heightMm: num(g("Height")),
      tooling: g("Tooling Type"),
      service: g("Service Relevant"),
      funcSafety: g("Func Safety"),
      safetyRel: g("Safety Rel"),
      elec: g("Elec Interface"),
      seed: g("DB_SEED_PART_USED")
    };
    p.ok = !!(p.name && (p.massKg || p.volumeMm3));
    return p;
  }

  function derive(part) {
    var d = {};
    if (part.volumeMm3 && part.thickMm) {
      d.blankAreaMm2 = part.volumeMm3 / part.thickMm;               // mid-surface (developed) area
    }
    if (part.areaMm2 && d.blankAreaMm2) {
      d.edgeAreaMm2 = part.areaMm2 - 2 * d.blankAreaMm2;            // edge / rim area
      if (part.thickMm) d.perimeterMm = d.edgeAreaMm2 / part.thickMm;
    }
    if (part.areaMm2 && part.widthMm && part.depthMm) {
      d.areaRatio = part.areaMm2 / (part.widthMm * part.depthMm);   // bent-part indicator
    }
    if (part.massKg && part.volumeMm3) {
      d.densityCheck = (part.massKg / part.volumeMm3) * 1e6;        // g/mm3 *1e-6 scale -> g/cm3
    }
    if (part.massKg && d.blankAreaMm2) {
      d.massPerArea = (part.massKg * 1000) / d.blankAreaMm2;        // kg/m2
    }
    if (d.blankAreaMm2 && part.depthMm) {
      d.blankLenEstMm = d.blankAreaMm2 / part.depthMm;              // strip-length estimate
    }
    return d;
  }

  /* ---------- main entry ---------- */

  function parse(arrayBuffer) {
    var warnings = [];
    var s = toLatin1(arrayBuffer);
    var attrs = parseAttributes(s, warnings);
    var notes = parseNotes(s);
    var previews = parsePreviews(s, 2);
    var part = buildPart(attrs);
    if (!part.ok) warnings.push("Could not identify part name / mass properties. The file may be an assembly or a foreign-format part.");
    return {
      ok: part.ok,
      fileSize: arrayBuffer.byteLength,
      attrs: attrs,
      part: part,
      derived: derive(part),
      notes: notes,
      previews: previews,
      warnings: warnings,
      fmt: fmt,
      scrub: scrub,
      friendlyLabel: friendlyLabel
    };
  }

  return { parse: parse, scrub: scrub, fmt: fmt, toLatin1: toLatin1 };
});
