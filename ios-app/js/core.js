/* Fahrschul Assistent – Kernlogik (kein DOM, testbar in Node) */
(function () {
  'use strict';
  const g = (typeof window !== 'undefined') ? window : globalThis;
  const DATA = (g.FS_QUESTIONS || []).slice();

  /* ---- Indizes ---- */
  const byNormId = new Map();        // normalisierte Nummer -> Frage
  const byRn = new Map();            // laufende Nummer (rn) -> Frage
  const byChapter = new Map();       // Kapitel-Code -> [Fragen]
  const chapterMeta = new Map();     // Kapitel-Code -> {code,name,theme,count}
  for (const q of DATA) {
    const key = normNum(q.n);
    if (!byNormId.has(key)) byNormId.set(key, q);
    if (typeof q.rn === 'number' && !byRn.has(q.rn)) byRn.set(q.rn, q);
    if (!byChapter.has(q.c)) byChapter.set(q.c, []);
    byChapter.get(q.c).push(q);
    if (!chapterMeta.has(q.c)) chapterMeta.set(q.c, { code: q.c, name: q.ch, theme: q.th, count: 0 });
    chapterMeta.get(q.c).count++;
  }

  /* "1.4.41-175" -> "1441175"; "1.1.02-051-M" -> "1102051m" */
  function normNum(s) {
    return String(s).toLowerCase().replace(/[\s._\-]+/g, '');
  }

  /* Kapitel-Code -> Themen-Code: "1.4.41" -> "1.4" */
  function themeCode(chapterCode) {
    const p = String(chapterCode).split('.');
    return (p.length >= 2) ? p[0] + '.' + p[1] : chapterCode;
  }

  /* Suche nach Fragennummer(n):
     - exakte offizielle Nummer ("1.4.41-175", auch ohne Trennzeichen "1441175")
     - laufende Nummer wie in Fahrschul-Apps ("1576", "Frage 1576", "Nr. 1576")
     - Endziffern der offiziellen Nummer, falls keine laufende Nummer passt ("1175" -> ...-1175)
     - Kapitel ("1.4.41" -> alle Fragen des Kapitels)
     - Präfix (fängt Varianten -M/-B ab) */
  function findById(input) {
    const raw = String(input || '').trim();
    if (!raw) return [];

    // "1576", "Frage 1576", "Nr. 1576", "Nummer 1576" -> laufende Nummer
    const rnMatch = raw.match(/^(?:(?:frage|nr\.?|nummer|q)\s*[#:]?\s*)?(\d{1,5})$/i);
    if (rnMatch) {
      const rn = Number(rnMatch[1]);
      const hit = byRn.get(rn);
      if (hit) return [hit];
      // keine laufende Nummer -> Endziffern der offiziellen Nummer
      const suffix = DATA.filter((q) => normNum(q.n).endsWith(rnMatch[1]));
      return suffix.length ? suffix : [];
    }

    const key = normNum(raw);
    const exact = byNormId.get(key);
    if (exact) return [exact];

    const chapter = byChapter.get(raw);
    if (chapter) return chapter.slice();
    const prefix = DATA.filter((q) => normNum(q.n).startsWith(key));
    return prefix;
  }

  /* Volltextsuche über Fragetext, Erklärung, Kapitel- und Themenname, Nummer */
  function searchText(input, limit) {
    const query = String(input || '').trim().toLowerCase();
    if (query.length < 2) return [];
    limit = limit || 100;
    const qNum = query.replace(/[\s._\-]+/g, '');
    const scored = [];
    for (const q of DATA) {
      let score = 0;
      if (normNum(q.n).includes(qNum)) score += 4;
      if (q.t && q.t.toLowerCase().includes(query)) score += 3;
      if (q.th && q.th.toLowerCase().includes(query)) score += 2;
      if (q.ch && q.ch.toLowerCase().includes(query)) score += 1;
      if (q.e && q.e.toLowerCase().includes(query)) score += 1;
      if (score > 0) scored.push({ q: q, s: score });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map((r) => r.q);
  }

  /* Kombinierte Suche: Nummerntreffer zuerst, dann Volltext */
  function search(input) {
    const byNum = findById(input);
    const byText = searchText(input, 60);
    const seen = new Set(byNum.map((q) => q.n));
    const rest = byText.filter((q) => !seen.has(q.n));
    return { byNum: byNum, byText: rest };
  }

  function themeList() {
    const map = new Map();
    for (const m of chapterMeta.values()) {
      const tc = themeCode(m.code);
      if (!map.has(tc)) map.set(tc, { code: tc, name: m.theme, count: 0, chapters: [] });
      const t = map.get(tc);
      t.count += m.count;
      t.chapters.push(m.code);
    }
    return [...map.values()]
      .map((t) => ({ ...t, chapters: t.chapters.sort() }))
      .sort((a, b) => a.code.localeCompare(b.code, 'de'));
  }

  function chapterList() {
    return [...chapterMeta.values()].sort((a, b) => a.code.localeCompare(b.code, 'de'));
  }

  function questionsByChapter(code) {
    return byChapter.get(code) || [];
  }

  function randomQuestion(excludeIds) {
    const pool = (excludeIds && excludeIds.size)
      ? DATA.filter((q) => !excludeIds.has(q.n))
      : DATA;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  g.FS = {
    DATA: DATA,
    normNum: normNum,
    themeCode: themeCode,
    findById: findById,
    searchText: searchText,
    search: search,
    themeList: themeList,
    chapterList: chapterList,
    questionsByChapter: questionsByChapter,
    randomQuestion: randomQuestion,
  };
})();
