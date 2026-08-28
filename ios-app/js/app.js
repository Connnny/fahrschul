/* Fahrschul Assistent – Übungs-App (PWA, offline) mit Statistik-Board */
(function () {
  'use strict';
  const FS = window.FS;
  if (!FS || !FS.DATA || !FS.DATA.length) {
    document.getElementById('statCount').textContent = '0';
    return;
  }

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const letter = (i) => String.fromCharCode(65 + i);
  const pct = (v) => Math.round(v * 10) / 10;

  let current = null;          // aktuelle Frage
  let selected = new Set();    // gewählte Optionen (Indizes)
  let checked = false;         // bereits geprüft?

  /* ---------- Fortschritt (lokal, localStorage) ---------- */
  const PROG_KEY = 'fsa_progress';
  let progress = { ans: {}, ok: {} };
  try {
    const p = JSON.parse(localStorage.getItem(PROG_KEY) || '{}');
    if (p && typeof p === 'object' && p.ans) progress = p;
  } catch (e) { /* ignorieren */ }

  function saveProgress() {
    try { localStorage.setItem(PROG_KEY, JSON.stringify(progress)); } catch (e) { /* ignorieren */ }
  }
  function recordResult(q, ok) {
    progress.ans[q.n] = (progress.ans[q.n] || 0) + 1;
    if (ok) progress.ok[q.n] = (progress.ok[q.n] || 0) + 1;
    saveProgress();
  }

  /* ---------- Statistik berechnen ---------- */
  function computeStats() {
    const total = FS.DATA.length;
    let totalAns = 0, totalOk = 0, hardAns = 0, hardOk = 0, correctIds = 0;
    const answeredIds = Object.keys(progress.ans);
    for (const id of answeredIds) {
      const a = progress.ans[id] || 0;
      const o = progress.ok[id] || 0;
      totalAns += a;
      totalOk += o;
      if (o > 0) correctIds++;
    }
    // „schwere Fragen" = 5-Punkt-Fragen
    for (const q of FS.DATA) {
      if (q.p >= 5) {
        hardAns += progress.ans[q.n] || 0;
        hardOk += progress.ok[q.n] || 0;
      }
    }
    return {
      total: total,
      answered: answeredIds.length,
      correctIds: correctIds,
      accuracy: totalAns ? pct(totalOk / totalAns * 100) : 0,
      hardAccuracy: hardAns ? pct(hardOk / hardAns * 100) : 0,
      coverage: total ? pct(answeredIds.length / total * 100) : 0,
      correctCoverage: total ? pct(correctIds / total * 100) : 0,
    };
  }

  function statRow(label, percent, detail) {
    const w = Math.max(0, Math.min(100, percent));
    return '<div class="srow">' +
      '<div class="slabel"><span>' + label + '</span><b>' + (isFinite(percent) ? percent + ' %' : '–') + '</b></div>' +
      '<div class="sbar"><div class="sbar-fill" style="width:' + w + '%"></div></div>' +
      (detail ? '<div class="sdetail">' + detail + '</div>' : '') +
      '</div>';
  }

  // Fragetypen für die Statistik
  const TYPE_DEFS = [
    { key: 'zahl', label: 'Zahleneingabe-Fragen', test: (q) => q.na !== undefined },
    { key: 'einfach', label: 'Einfachwahl', test: (q) => q.o && q.co.length === 1 },
    { key: 'mehrfach', label: 'Mehrfachwahl', test: (q) => q.o && q.co.length > 1 },
    { key: 'schilder', label: 'Schilder-Fragen (Verkehrszeichen)', test: (q) => /^[12]\.4\./.test(q.c) },
    { key: 'video', label: 'Videofragen', test: (q) => (q.v || []).length > 0 },
  ];

  function typeStats() {
    return TYPE_DEFS.map((t) => {
      let ans = 0, ok = 0;
      for (const q of FS.DATA) {
        if (!t.test(q)) continue;
        ans += progress.ans[q.n] || 0;
        ok += progress.ok[q.n] || 0;
      }
      return { label: t.label, ans, ok, pct: ans ? pct(ok / ans * 100) : NaN };
    });
  }

  function renderStats() {
    const s = computeStats();
    const totalAns = answeredTotal();
    const hd = hardDetail();
    let html =
      statRow('Richtige Antworten (insgesamt)', s.accuracy,
        totalAns ? 'Richtig/gesamt: siehe Detail unten (' + totalAns + ' Antworten geprüft)' : 'Noch keine Antwort geprüft') +
      statRow('Richtige Antworten bei 5-Punkt-Fragen (schwer)', s.hardAccuracy, hd) +
      statRow('Fragen beantwortet (Abdeckung)', s.coverage,
        s.answered + ' von ' + s.total + ' Fragen') +
      statRow('Fragen mind. einmal richtig', s.correctCoverage,
        s.correctIds + ' von ' + s.total + ' Fragen');
    html += '<div class="stypes"><h3>Nach Fragetyp</h3></div>';
    html += typeStats().map((t) =>
      statRow(t.label, t.pct,
        t.ans ? t.ok + ' richtig von ' + t.ans + ' Antworten' : 'Noch keine Antworten bei diesem Typ')
    ).join('');
    $('#stats').innerHTML = html;
  }

  function answeredTotal() {
    let n = 0;
    for (const k in progress.ans) n += progress.ans[k];
    return n;
  }
  function hardDetail() {
    let a = 0, o = 0;
    for (const q of FS.DATA) if (q.p >= 5) { a += progress.ans[q.n] || 0; o += progress.ok[q.n] || 0; }
    return a ? o + ' richtig von ' + a + ' schweren Antworten' : 'Noch keine 5-Punkt-Frage beantwortet';
  }

  $('#statCount').textContent = FS.DATA.length;

  /* ---------- Prüfungshistorie (lokal gespeichert) ---------- */
  const EXAMS_KEY = 'fsa_exams';
  let exams = [];
  try {
    const e = JSON.parse(localStorage.getItem(EXAMS_KEY) || '[]');
    if (Array.isArray(e)) exams = e;
  } catch (err) { /* ignorieren */ }
  function saveExams() {
    try { localStorage.setItem(EXAMS_KEY, JSON.stringify(exams)); } catch (err) { /* ignorieren */ }
  }

  function renderExams() {
    const box = $('#exams');
    if (!box) return;
    box.innerHTML = '';
    if (!exams.length) {
      box.innerHTML = '<p class="hint">Noch keine Prüfung absolviert – starte oben im Menü „Test Prüfung (30 Fragen)".</p>';
      return;
    }
    exams.forEach((ex) => {
      const card = document.createElement('div');
      card.className = 'ecard';
      const fmtIds = (ids) => ids.map((id) => {
        const q = FS.findById(id)[0];
        return q
          ? '<button class="eitem" data-id="' + esc(q.n) + '"><span class="enum">' + esc(q.n) + '</span><span class="etxt">' + esc(q.t.slice(0, 55)) + '</span></button>'
          : '';
      }).join('');
      card.innerHTML =
        '<div class="ehead"><span class="edate">' + esc(ex.date || '') + ' · ' + esc(ex.time || '') + '</span>' +
        '<span class="eres ' + (ex.passed ? 'ok' : 'no') + '">' + (ex.passed ? 'Bestanden' : 'Nicht bestanden') + '</span></div>' +
        '<div class="eline">Fehlerpunkte: <b>' + ex.fehler + '</b> / 10 · 5-Punkt-Fehler: <b>' + ex.wrong5 + '</b> · Richtig: <b>' + ex.correct + '</b> / 30</div>' +
        '<button class="etgl" type="button">Richtig/falsch anzeigen</button>' +
        '<div class="edetail hidden">' +
        '<div class="eline">Richtig (' + (ex.right || []).length + '):</div>' + fmtIds(ex.right || []) +
        '<div class="eline">Falsch (' + (ex.wrong || []).length + '):</div>' + fmtIds(ex.wrong || []) +
        '</div>';
      card.querySelector('.etgl').addEventListener('click', function () {
        const d = card.querySelector('.edetail');
        d.classList.toggle('hidden');
        this.textContent = d.classList.contains('hidden') ? 'Richtig/falsch anzeigen' : 'Ausblenden';
      });
      box.appendChild(card);
    });
  }

  // Fragen aus einer Prüfung anklickbar (zum Nachüben)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.eitem');
    if (b && b.dataset.id) {
      const q = FS.findById(b.dataset.id)[0];
      if (q) loadQuestion(q);
    }
  });

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === name));
    if (name === 'start') renderStats();
    if (name === 'verlauf') renderHistory();
    if (name === 'pruefungen') renderExams();
    // Tab-Leiste hervorheben
    const tabFor = { start: 'start', quiz: 'start', result: 'start', verlauf: 'verlauf', pruefungen: 'pruefungen' };
    const t = tabFor[name] || 'start';
    document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === t));
    window.scrollTo({ top: 0 });
  }

  /* ---------- Verlauf (letzte 10 Fragen) ---------- */
  const HIST_KEY = 'fsa_history';
  let history = [];
  try {
    const h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    if (Array.isArray(h)) history = h.filter(Boolean).slice(0, 10);
  } catch (e) { /* ignorieren */ }

  function saveHistory() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(history)); } catch (e) { /* ignorieren */ }
  }
  function pushHistory(q) {
    if (!q) return;
    history = history.filter((id) => id !== q.n);
    history.unshift(q.n);
    if (history.length > 10) history.pop();
    saveHistory();
  }
  function renderHistory() {
    const box = $('#history');
    if (!box) return;
    box.innerHTML = '';
    if (!history.length) {
      box.innerHTML = '<p class="hint">Noch keine Fragen beantwortet – deine letzten 10 Fragen erscheinen hier.</p>';
      return;
    }
    history.forEach((id) => {
      const q = FS.findById(id)[0];
      if (!q) return;
      // Lösung der Frage
      let solution = '';
      if (q.na !== undefined) {
        solution = esc(q.na);
      } else {
        solution = q.o.map((o, i) => (q.co.includes(i) ? letter(i) + ') ' + (o || 'Abbildung') : null)).filter(Boolean).join('  ·  ');
      }
      // Wie war das Ergebnis?
      const userAns = (progress.ans[id] || 0) > 0;
      const userOk = (progress.ok[id] || 0) > 0;
      const res = userAns ? (userOk ? 'richtig' : 'falsch') : '';
      const b = document.createElement('button');
      b.className = 'hitem';
      b.innerHTML =
        '<div class="hline"><span class="hnum">' + esc(q.n) + '</span>' +
        '<span class="hres ' + (res === 'richtig' ? 'h-ok' : (res === 'falsch' ? 'h-no' : '')) + '">' + (res ? res : '') + '</span></div>' +
        '<div class="htxt">' + esc(q.t.slice(0, 55)) + '</div>' +
        '<div class="hsol">Lösung: ' + solution + '</div>';
      b.addEventListener('click', () => loadQuestion(q));
      box.appendChild(b);
    });
  }

  /* ---------- Frage anzeigen ---------- */
  function loadQuestion(q, opts) {
    opts = opts || {};
    if (!opts.back && current && current.n !== q.n) {
      backStack.push(current.n);
      if (backStack.length > 20) backStack.shift();
    }
    pushHistory(current);
    current = q;
    selected = new Set();
    checked = false;

    $('#qMeta').innerHTML =
      '<span class="qnum">' + esc(q.n) + '</span>' +
      '<span class="qpts p' + Math.min(q.p, 5) + '">' + q.p + ' Punkte</span>' +
      (q.rn ? '<span class="qrn">Nr. ' + q.rn + '</span>' : '') +
      '<span class="qth">' + esc(mode.kind === 'exam' ? 'Frage ' + (exam.idx + 1) + '/30' : (mode.title || q.th)) + '</span>' +
      '<button id="qHome" class="qhome" title="Zur Startseite">Home</button>';
    const qh = $('#qHome');
    if (qh) qh.addEventListener('click', () => { resetMode(); showView('start'); });
    $('#qText').textContent = q.t;

    // Medien
    const media = $('#qMedia');
    media.innerHTML = '';
    if (q.v && q.v.length) {
      const v = document.createElement('video');
      v.controls = true; v.preload = 'none'; v.playsInline = true;
      v.innerHTML = '<source src="' + esc(q.v[0]) + '" type="video/mp4">';
      v.onerror = () => v.remove();
      media.appendChild(v);
    } else if (q.i && q.i.length) {
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = 'Abbildung zur Frage';
      img.src = q.i[0];
      img.onerror = () => img.remove();
      media.appendChild(img);
    }

    // Antworten
    const box = $('#answers');
    box.innerHTML = '';
    const isNumber = q.na !== undefined;
    if (isNumber) {
      box.innerHTML = '<div class="num-hint">Gib deine Antwort ein – wird live rot/grün gefärbt:</div>';
      $('#numInput').classList.remove('hidden');
      const f = $('#numField');
      f.value = '';
      f.classList.remove('wrong', 'right');
      f.focus();
    } else {
      $('#numInput').classList.add('hidden');
      q.o.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt';
        btn.dataset.i = String(i);
        const img = (q.oi && q.oi[i]) ? '<img class="opt-img" src="' + esc(q.oi[i]) + '">' : esc(opt || 'Antwort ' + letter(i));
        btn.innerHTML = '<span class="ol">' + letter(i) + '</span><span class="ot">' + img + '</span><span class="opt-check">×</span>';
        btn.addEventListener('click', () => {
          if (checked) return;
          if (selected.has(i)) selected.delete(i); else selected.add(i);
          btn.classList.toggle('sel', selected.has(i));
        });
        box.appendChild(btn);
      });
    }

    $('#feedback').innerHTML = '';
    $('#feedback').classList.remove('show');
    $('#checkBtn').classList.remove('hidden');
    $('#nextBtn').classList.add('hidden');
    showView('quiz');
  }

  /* ---------- Prüfen ---------- */
  function checkAnswer() {
    if (checked || !current) return;
    const q = current;

    let userAnswer = null;
    if (q.na !== undefined) {
      userAnswer = ($('#numField').value || '').trim();
      const tNum = numOf(q.na);
      const iNum = numOf(userAnswer);
      const correct = (tNum !== null && iNum !== null)
        ? tNum === iNum
        : normalize(userAnswer) === normalize(q.na);
      const html =
        '<div class="fb ' + (correct ? 'ok' : 'no') + '">' +
        '<b>' + (correct ? 'Richtig!' : 'Falsch.') + '</b>' +
        '<div class="fb-line">Deine Antwort: <b>' + esc(userAnswer || '–') + '</b></div>' +
        '<div class="fb-line">Richtig wäre: <b>' + esc(q.na) + '</b></div>' +
        (q.e ? '<div class="fb-expl">' + esc(q.e) + '</div>' : '') +
        '<button class="fx-btn" type="button">Erweiterung</button>' +
        '<div class="fext hidden">' +
        '<div class="fext-meta">Frage ' + esc(q.n) + (q.rn ? ' · Nr. ' + q.rn : '') + '</div>' +
        '<div class="fext-line">Thema: <b>' + esc(q.th || '–') + '</b></div>' +
        '<div class="fext-line">Kapitel: <b>' + esc(q.c || '–') + '</b>' + (q.ch ? ' · ' + esc(q.ch) : '') + '</div>' +
        '<div class="fext-line">Punkte: <b>' + q.p + '</b>' + (q.v && q.v.length ? ' · Video-Frage' : (q.i && q.i.length ? ' · Bild-Frage' : '')) + '</div>' +
        '<div class="fext-line">Richtige Antwort: <b>' + esc(q.na) + '</b></div>' +
        (q.e ? '<div class="fext-expl">Erklärung zur Frage: ' + esc(q.e) + '</div>' : '') +
        '</div>' +
        '</div>';
      $('#feedback').innerHTML = html;
      recordResult(q, correct);
      afterAnswered(correct);
    } else {
      // Auswahl prüfen: genau die richtigen müssen gewählt sein
      const correctSet = new Set(q.co);
      const isRight = selected.size === correctSet.size && [...selected].every((i) => correctSet.has(i));

      // Antwort-Optionen einfärben: richtig = grün, getippt & falsch = rot.
      // ✕-Kästchen nur auf den getippten Antworten (Klasse .checked).
      document.querySelectorAll('.opt[data-i]').forEach((el) => {
        const i = Number(el.dataset.i);
        el.classList.remove('sel');
        if (selected.has(i)) el.classList.add('checked');
        if (q.co.includes(i)) el.classList.add('right');
        else if (selected.has(i)) el.classList.add('wrong');
      });

      let html = '<div class="fb ' + (isRight ? 'ok' : 'no') + '"><b>' +
        (isRight ? 'Richtig!' : 'Falsch – hier ist die Auflösung:') + '</b></div>';

      const richtig = q.o.map((o, i) => (q.co.includes(i) ? letter(i) : null)).filter(Boolean).join(', ');
      const meta = 'Frage ' + esc(q.n) + (q.rn ? ' · Nr. ' + q.rn : '');
      q.o.forEach((opt, i) => {
        const correct = q.co.includes(i);
        let cls = 'fb-opt';
        if (correct) cls += ' ok';
        else cls += ' no'; // alle falschen Antworten rot
        const optHtml = (q.oi && q.oi[i]) ? '<img class="fx-img" src="' + esc(q.oi[i]) + '">' : esc(opt || 'Antwort ' + letter(i));
        const details =
          '<div class="fext hidden">' +
          '<div class="fext-meta">' + meta + '</div>' +
          '<div class="fext-line">Thema: <b>' + esc(q.th || '–') + '</b></div>' +
          '<div class="fext-line">Kapitel: <b>' + esc(q.c || '–') + '</b>' + (q.ch ? ' · ' + esc(q.ch) : '') + '</div>' +
          '<div class="fext-line">Punkte: <b>' + q.p + '</b>' + (q.v && q.v.length ? ' · Video-Frage' : (q.i && q.i.length ? ' · Bild-Frage' : '')) + '</div>' +
          '<div class="fext-line">Richtige Antwort(en): <b>' + esc(richtig) + '</b></div>' +
          (q.ex && q.ex[i] ? '<div class="fext-expl">Antwort-Erklärung: ' + esc(q.ex[i]) + '</div>' : '') +
          (q.e ? '<div class="fext-expl">Erklärung zur Frage: ' + esc(q.e) + '</div>' : '') +
          '</div>';
        html +=
          '<div class="' + cls + '">' +
          '<span class="fl">' + letter(i) + '</span>' +
          '<span class="ft">' + optHtml + '</span>' +
          '<span class="fm">' + (correct ? 'richtig' : 'falsch') + '</span>' +
          (q.ex && q.ex[i] ? '<div class="fx">' + esc(q.ex[i]) + '</div>' : '') +
          '<button class="fx-btn" type="button">Erweiterung</button>' +
          details +
          '</div>';
      });
      $('#feedback').innerHTML = html;
      recordResult(q, isRight);
      afterAnswered(isRight);
    }

    // „Erweiterung"-Knöpfe: Details auf-/zuklappen
    $('#feedback').querySelectorAll('.fx-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const panel = b.nextElementSibling;
        if (!panel || !panel.classList.contains('fext')) return;
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        b.textContent = opening ? 'Weniger' : 'Erweiterung';
      });
    });

    checked = true;
    $('#checkBtn').classList.add('hidden');
    $('#nextBtn').classList.remove('hidden');
    $('#feedback').classList.add('show');
  }

  function normalize(s) {
    return String(s).toLowerCase().replace(/\s+/g, ' ').replace(/\s/g, '').replace(',', '.');
  }

  // Erste Zahl aus einem Text holen ("50 km/h" -> 50; "1,5 m" -> 1.5)
  function numOf(s) {
    const m = String(s).trim().match(/^[-+]?\d+([.,]\d+)?/);
    return m ? parseFloat((m[1] || m[0]).replace(',', '.')) : null;
  }

  // Live-Feedback beim Tippen: falsch -> rot, richtig -> grün
  function initTypingFeedback() {
    const field = $('#numField');
    field.addEventListener('input', () => {
      field.classList.remove('wrong', 'right');
      const typed = field.value.trim();
      if (!typed || !current || current.na === undefined) return;
      const tNum = numOf(current.na);
      const iNum = numOf(typed);
      const ok = (tNum !== null && iNum !== null)
        ? tNum === iNum
        : normalize(typed) === normalize(current.na);
      field.classList.add(ok ? 'right' : 'wrong');
    });
  }

  /* ---------- Offline-Medien (Bilder & Videos im Service-Worker-Cache) ---------- */
  const MEDIA_DONE_KEY = 'fsa_media_done';

  function collectMedia() {
    const imgs = new Set(), vids = new Set();
    for (const q of FS.DATA) {
      if (q.i) q.i.forEach((u) => u && imgs.add(u));
      if (q.oi) q.oi.forEach((u) => u && imgs.add(u));
      if (q.v) q.v.forEach((u) => u && vids.add(u));
    }
    return { imgs: [...imgs], vids: [...vids] };
  }

  function swMsg(msg) {
    try {
      const c = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (c) c.postMessage(msg);
    } catch (e) { /* kein SW */ }
  }

  function fileBase(url) {
    try { return decodeURIComponent(url.split('/').pop()).slice(0, 40); } catch (e) { return url; }
  }

  function updateOfflineUI(state) {
    const card = $('#offlineCard');
    if (!card) return;
    if (!state) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    if (state.imgs != null) $('#offImgs').textContent = state.imgs + '/' + state.totalImgs;
    if (state.vids != null) $('#offVids').textContent = state.vids + '/' + state.totalVids;
    if (state.progress != null) {
      $('#offProgress').classList.remove('hidden');
      $('#offBar').style.width = Math.max(2, state.progress) + '%';
      $('#offPct').textContent = state.progress + ' %';
    }
    if (state.current) {
      $('#offCurrent').classList.remove('hidden');
      $('#offCurrentName').textContent = state.current;
    }
    if (state.finished) {
      $('#offCurrent').classList.add('hidden');
      $('#offProgress').classList.add('hidden');
      $('#offPct').textContent = 'alles offline (' + state.done + '/' + state.total + ')';
      $('#offNote').textContent = 'Bilder und Videos liegen komplett auf dem Gerät.';
      try { localStorage.setItem(MEDIA_DONE_KEY, '1'); } catch (e) { /* ignorieren */ }
    }
  }

  function initOfflineMedia() {
    if (!('serviceWorker' in navigator)) return;
    const media = collectMedia();
    const totalImgs = media.imgs.length, totalVids = media.vids.length;
    const noDl = new URLSearchParams(location.search).get('nodl') === '1';

    navigator.serviceWorker.ready.then(() => {
      // Status abfragen; Bilder + Videos automatisch laden (einmalig).
      // Kleine Verzögerung, damit der Controller aktiv ist (erster Start).
      setTimeout(() => {
        swMsg({ type: 'media-status' });
        let mediaDone = false;
        try { mediaDone = localStorage.getItem(MEDIA_DONE_KEY) === '1'; } catch (e) { /* ignorieren */ }
        if (!noDl && !mediaDone) {
          swMsg({ type: 'precache-media', urls: media.imgs, kind: 'img' });
          swMsg({ type: 'precache-media', urls: media.vids, kind: 'video' });
        }
      }, 700);
    });

    // Nachrichten vom SW (Live-Status)
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'media-status') {
        updateOfflineUI({ imgs: d.imgs, vids: d.vids, totalImgs, totalVids });
      }
      if (d.type === 'media-progress') {
        const pct = d.total ? Math.min(100, Math.round(d.done / d.total * 100)) : 0;
        updateOfflineUI({
          progress: pct,
          current: d.current ? ((d.kind === 'video' ? 'Video: ' : 'Bild: ') + fileBase(d.current)) : null,
          finished: !!d.finished,
          done: d.done, total: d.total,
        });
      }
    });
  }

  /* ---------- Modus + Prüfung ---------- */
  let mode = { kind: 'random', title: '' };
  let exam = null;
  let backStack = []; // für „Zurück zur letzten Frage"

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function randOf(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

  function startPool(filter, title) {
    const pool = filter ? FS.DATA.filter(filter) : FS.DATA.slice();
    mode = { kind: 'filter', title: title || '', pool: pool };
    exam = null;
    if (!pool.length) { alert('Keine Fragen für diesen Typ.'); return; }
    loadQuestion(randOf(pool));
  }

  function startExam() {
    const grund = shuffle(FS.DATA.filter((q) => /^1\./.test(q.c)));
    const zusatz = shuffle(FS.DATA.filter((q) => /^2\./.test(q.c)));
    exam = { list: grund.slice(0, 20).concat(zusatz.slice(0, 10)), idx: 0, fehler: 0, wrong5: 0, correct: 0, wrongIds: [], rightIds: [] };
    mode = { kind: 'exam', title: 'Test Prüfung' };
    loadQuestion(exam.list[0]);
  }

  function finishExam() {
    const passed = exam.fehler <= 10 && exam.wrong5 < 2;
    const t = $('#resTitle');
    t.textContent = passed ? 'Bestanden' : 'Nicht bestanden';
    t.className = passed ? 'res-ok' : 'res-no';
    $('#resDetail').innerHTML =
      '<div class="res-line">Fehlerpunkte: <b>' + exam.fehler + '</b> von 10 (max. 10)</div>' +
      '<div class="res-line">5-Punkt-Fragen falsch: <b>' + exam.wrong5 + '</b> (max. 1 erlaubt)</div>' +
      '<div class="res-line">Richtig beantwortet: <b>' + exam.correct + '</b> von 30</div>';
    // Prüfung speichern (Datum, Uhrzeit, Fehlerpunkte, richtige/falsche Fragen)
    const rec = {
      date: new Date().toLocaleDateString('de-DE'),
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      fehler: exam.fehler,
      wrong5: exam.wrong5,
      correct: exam.correct,
      passed: passed,
      right: exam.rightIds || [],
      wrong: exam.wrongIds || [],
    };
    exams.unshift(rec);
    if (exams.length > 50) exams.pop();
    saveExams();
    exam = null;
    mode = { kind: 'random', title: '' };
    showView('result');
  }

  function afterAnswered(right) {
    if (mode.kind === 'exam') {
      if (!right) { exam.fehler += current.p; if (current.p >= 5) exam.wrong5++; exam.wrongIds.push(current.n); }
      else { exam.correct++; exam.rightIds.push(current.n); }
      const fbEl = $('#feedback .fb');
      if (fbEl) fbEl.insertAdjacentHTML('beforeend', '<div class="fb-line">Fehlerpunkte: <b>' + exam.fehler + '</b> / 10</div>');
      $('#nextBtn').textContent = (exam.idx >= exam.list.length - 1) ? 'Ergebnis anzeigen' : 'Weiter (' + (exam.idx + 1) + '/30)';
    } else {
      $('#nextBtn').textContent = 'Nächste Frage';
    }
  }

  function resetMode() { mode = { kind: 'random', title: '' }; exam = null; backStack = []; }

  /* ---------- Events ---------- */
  $('#startBtn').addEventListener('click', () => {
    resetMode();
    loadQuestion(FS.randomQuestion());
  });
  $('#mExam').addEventListener('click', startExam);
  $('#mSchilder').addEventListener('click', () => startPool((q) => /^[12]\.4\./.test(q.c), 'Schilder-Fragen'));
  $('#mZahl').addEventListener('click', () => startPool((q) => q.na !== undefined, 'Zahleneingabe-Fragen'));
  $('#mEinfach').addEventListener('click', () => startPool((q) => q.o && q.co.length === 1, 'Einfachwahl-Fragen'));
  $('#mMehrfach').addEventListener('click', () => startPool((q) => q.o && q.co.length > 1, 'Mehrfachwahl-Fragen'));
  $('#mVideo').addEventListener('click', () => startPool((q) => (q.v || []).length > 0, 'Videofragen'));

  // Typ-Zähler in die Menü-Knöpfe
  const countOf = (f) => FS.DATA.filter(f).length;
  $('#mSchilder').textContent = 'Schilder-Fragen (' + countOf((q) => /^[12]\.4\./.test(q.c)) + ')';
  $('#mZahl').textContent = 'Zahleneingabe-Fragen (' + countOf((q) => q.na !== undefined) + ')';
  $('#mEinfach').textContent = 'Einfachwahl-Fragen (' + countOf((q) => q.o && q.co.length === 1) + ')';
  $('#mMehrfach').textContent = 'Mehrfachwahl-Fragen (' + countOf((q) => q.o && q.co.length > 1) + ')';
  $('#mVideo').textContent = 'Videofragen (' + countOf((q) => (q.v || []).length > 0) + ')';

  $('#checkBtn').addEventListener('click', checkAnswer);
  $('#numOk').addEventListener('click', checkAnswer);
  $('#numField').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });
  $('#nextBtn').addEventListener('click', () => {
    if (mode.kind === 'exam') {
      if (exam.idx >= exam.list.length - 1) { finishExam(); return; }
      exam.idx++;
      loadQuestion(exam.list[exam.idx]);
      return;
    }
    if (mode.kind === 'filter' && mode.pool) loadQuestion(randOf(mode.pool));
    else loadQuestion(FS.randomQuestion());
  });
  $('#homeBtn').addEventListener('click', () => {
    // „Zurück": zur letzten Frage
    if (backStack.length) {
      const id = backStack.pop();
      const q = FS.findById(id)[0];
      if (q) { loadQuestion(q, { back: true }); return; }
    }
    resetMode();
    showView('start');
  });
  $('#resAgain').addEventListener('click', startExam);
  $('#resHome').addEventListener('click', () => { resetMode(); showView('start'); });
  document.querySelectorAll('.tabbar .tab').forEach((b) => {
    b.addEventListener('click', () => showView(b.dataset.view));
  });
  $('#resetStats').addEventListener('click', () => {
    progress = { ans: {}, ok: {} };
    try { localStorage.removeItem(PROG_KEY); } catch (e) { /* ignorieren */ }
    renderStats();
  });

  // „Update prüfen" – erzwingt Service-Worker-Aktualisierung (wichtig für iOS)
  const updateBtn = $('#updateBtn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      if (!('serviceWorker' in navigator)) return;
      updateBtn.textContent = 'Prüfe …';
      navigator.serviceWorker.ready.then((reg) => {
        return reg.update().then(() => {
          updateBtn.textContent = 'Neu geladen – App neu öffnen';
          setTimeout(() => location.reload(), 800);
        });
      }).catch(() => {
        updateBtn.textContent = 'Aktualisiert – App 2× schließen und neu öffnen';
      });
    });
  }
  initTypingFeedback();
  renderStats();
  renderHistory();
  initOfflineMedia();
})();
