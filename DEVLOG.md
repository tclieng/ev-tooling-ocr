# EV Tooling OCR — Dev Log (WorkBuddy 1024 Build Challenge entry)

> Paste-ready post. Chinese and English versions below. The live app link is already filled in — add a screenshot/GIF before posting.

---

## 中文版

### 两天、零后端，我用浏览器「拆开」了一个 NX 三维零件文件 —— EV Tooling OCR

**一句话介绍：** 拖入一个 Siemens NX 的 `.prt` 零件文件，浏览器立刻解析出零件号、材料、料厚、质量、包络尺寸、派生下料尺寸和 3D PMI 备注，然后按真实交付链一次生成 **三份可打印文档**：零件数据表、**冲压模具方案**（工位数 / 排样 / 材料利用率 / 冲压力 / 设备吨位 / 成本周期）、以及 **PPAP / FAI 认证文件草案**（PSW 表头、AIAG 18 要素状态表、FAI 特性气球表、控制计划摘要）。全程纯前端，文件不上传服务器。

**为什么做这个：** 在汽车钣金/模具行业，`.prt` 文件里藏着大量被锁死的工程信息。没有安装 NX（几十 GB 的商业软件）的人，面对一个二进制零件文件什么都做不了。我们验证过：零件的核心属性其实是以 XML 块明文存在文件里的，用正则就能读出来 —— 所以有了这个工具。

**怎么实现的（3 个关键点）：**

1. **属性解析** — 扫描字节流中的 `<UgAttributes>` XML 块，提取 `title`/`utf8value` 对：零件号、版本、材料（如 CR240BH-GI50/50-U）、料厚 1.2 mm、质量、体积、包络、模具类型等 40+ 字段。
2. **PMI 备注还原** — 3D PMI 注释文本以长度前缀 ASCII 字符串形式嵌在二进制里，用「可打印串 + 关键词过滤 + 去重」的启发式把它们捞出来（公差、标准号、表面处理要求等 17+ 条）。
3. **派生计算** — 不止显示原始值：下料展开面积 = 体积 ÷ 料厚，轮廓周长 ≈ 边缘面积 ÷ 料厚，还做了密度交叉校验（质量/体积 = 7.85 g/cm³，和钢材密度对上，证明读出的数字自洽）。
4. **冲压模具方案生成** — 按真实交付链补上中间环节：基于材料牌号推算抗拉强度 → 剪切力、冲孔力、弯曲力、整形力逐项算出（公式全部标在文档上）→ 求总吨位 ×1.3 安全系数 → 选标准压力机（并留冲击余量）。同时算出条料宽度 / 步距 / 桥料、材料利用率、单件废料重量、下料毛坯尺寸、模架外廓，并给出 6 工位排样示意图、工位逻辑表（为什么是 5 道工序而不是 3 道）、三种工艺路线对比（级进模 / 线模 / 传递模的成本-产量决策规则）、RM 级模具预算和 19 周时间条。所有几何假设（A1-A5）和"冻结模具设计前必须拿到的东西"都写在文档里。
5. **PPAP / FAI 草案生成** — 交付链的最后一环：基于读出的属性，自动产出一份 AIAG PPAP 4th Ed 风格的认证文件草案 —— PSW 表头（零件号、版本、材料、重量、提交等级 Level 3、提交理由）、18 项 PPAP 要素逐条状态（每条标明 VER 文件直读 / DER 计算派生 / TBC 待实物确认 / N/A 不适用）、FAI 气球特性表（18 项特性 + 名义值 + 公差 + 检测方法 + 留空的实测列）、6 工位控制计划摘要。检测方法从材料牌号自动推断（如 GI50/50 → 镀锌层 50/50 g/m²，毛刺高度按 10%×料厚计算）。草案明确标注"非提交证据"，实测列留白待填 —— 诚实标注边界，正是汽车行业质量文档的规矩。

**工程取舍（诚实版）：** `.prt` 里的渲染预览图只有 247×185 像素 —— 足够「识别」这个零件，永远不够「测量」。孔位、弯角半径这些 GD&T 信息只存在于 3D PMI 几何中，没有 NX 就拿不到。工具的边界在页面上写得明明白白。

**隐私设计：** 全部解析在浏览器完成（ArrayBuffer + 正则），文件不出本机 —— 对真实客户文件零风险。

**体验方式：** 打开即用「示例零件」按钮看演示（脱敏虚构数据），或拖入自己的 `.prt` 文件。
👉 https://ev-tooling-ocr.app.workbuddy.host/?sharecode=P6EYRGTQ73

**技术栈：** WorkBuddy 智能体 + 纯 HTML/CSS/JS，零依赖，零后端，离线可用。

---

## English version

### I "cracked open" a Siemens NX part file in the browser in two days, with zero backend — EV Tooling OCR

**One-liner:** Drop a Siemens NX `.prt` file, and the browser instantly extracts the part number, material, thickness, mass, envelope, derived blank dimensions, and 3D PMI notes — then renders **three linked printable documents** along the real delivery chain: a part data sheet, a **press tooling concept** (station count / strip layout / material utilisation / press forces / tonnage / cost & timing), and an **auto-drafted PPAP / FAI package** (PSW header, AIAG 18-element status, ballooned FAI characteristics, control-plan extract). 100% client-side; the file never leaves your machine.

**Why:** In the automotive sheet-metal / tooling world, `.prt` files hold a treasure chest of engineering data locked behind NX — a multi-gigabyte commercial CAD package. But we verified the core part attributes are stored in the file as plain-text XML blocks readable with regex. So this tool exists.

**How it works (3 key moves):**

1. **Attribute parsing** — scan the byte stream for `<UgAttributes>` XML blocks and pull `title`/`utf8value` pairs: part number, revision, material (e.g. CR240BH-GI50/50-U), 1.2 mm thickness, mass, volume, envelope, tooling type — 40+ fields.
2. **PMI note recovery** — 3D PMI annotation text lives in the binary as length-prefixed ASCII strings; a heuristic (printable runs + keyword filtering + dedupe) recovers 17+ note lines: tolerances, standards, coating specs.
3. **Derived engineering math** — beyond raw values: developed blank area = volume ÷ thickness, outline perimeter ≈ edge area ÷ thickness, plus a density cross-check (mass/volume = 7.85 g/cm³ — matches steel, proving the numbers are self-consistent).
4. **Press tooling concept generation** — the missing middle of the delivery chain: the material grade is converted to an estimated tensile strength, then shear force, piercing force, bending force and restrike force are computed one by one (every formula is printed on the document) → total tonnage × 1.3 safety factor → a standard straight-side press is selected with a snap-through allowance. It also derives strip width / pitch / bridge, material utilisation, scrap per part, flat-blank size and die-set envelope, and renders a 6-station strip schematic, the station-logic table (why five operations, not three), a three-route comparison (progressive vs line dies vs transfer with the volume/cost decision rule), an RM-budgeted tooling cost table and a 19-week timing bar. All geometry assumptions (A1–A5) and the "before die design freeze" list are stated on the document itself.
5. **PPAP / FAI draft generation** — the last link of the chain: from the parsed attributes, the app auto-produces an AIAG PPAP 4th-Ed-style approval package — PSW header (part number, rev, material, weight, submission level 3, reason), all 18 PPAP elements with per-element status (VER read-from-file / DER computed / TBC needs-parts / N/A), a ballooned FAI characteristics table (18 characteristics with nominal, tolerance, inspection method, and a blank ACTUAL column for the shop floor), and a 6-station control-plan extract. Inspection methods are inferred from the material designation (e.g. GI50/50 → Zn coating 50/50 g/m²; burr height computed as 10% × thickness). The draft is stamped "not submitted evidence" with the ACTUAL column deliberately blank — stating the boundary honestly is exactly how automotive quality documents work.

**Honest limits:** the embedded render preview is 247×185 px — enough to *identify* the part, never to *measure* it. Hole positions and bend radii exist only as 3D PMI geometry; without NX they stay out of reach. The tool states its boundary right on the page.

**Privacy:** all parsing happens in the browser (ArrayBuffer + regex). Nothing is uploaded — safe for real customer files.

**Try it:** hit the demo button for a desensitized fictional part, or drop your own `.prt`.
👉 https://ev-tooling-ocr.app.workbuddy.host/?sharecode=P6EYRGTQ73

**Stack:** WorkBuddy agent + pure HTML/CSS/JS. Zero dependencies, zero backend, works offline.

---

## Posting checklist

- [x] Live app link: https://ev-tooling-ocr.app.workbuddy.host/?sharecode=P6EYRGTQ73
- [ ] Attach 1–2 screenshots (demo part card + notes panel) or a short GIF of drag-and-drop
- [ ] Post to one channel (微信公众号 / 视频号 / 小红书 / 知乎 / LinkedIn) with hashtags **#WorkBuddy** **#1024程序员节** (required for the social bonus)
- [ ] Paste the social post URL into the submission form's "社媒分享链接" field (worth up to +30 points)
