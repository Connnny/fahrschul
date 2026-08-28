/* Fahrschul Assistent – Oberfläche */
(function () {
  'use strict';
  const FS = window.FS;
  const FAV_KEY = 'fs_favs';

  /* ---------- kleine Helfer ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function snippet(text, max) {
    const t = String(text || '');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  function pointsClass(p) {
    if (p >= 5) return 'p5';
    if (p >= 4) return 'p4';
    if (p >= 3) return 'p3';
    return 'p2';
  }
  function themeOf(chapterCode) {
    const p = chapterCode.split('.');
    return p.length >= 2 ? p[0] + '.' + p[1] : chapterCode;
  }

  /* ---------- Favoriten (localStorage) ---------- */
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { favs = new Set(); }
  function saveFavs() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch (e) { /* ignorieren */ }
    updateFavCount();
  }
  function updateFavCount() {
    const badge = $('#favCount');
    if (badge) badge.textContent = favs.size ? String(favs.size) : '';
  }
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    const star = $('#favBtn');
    if (star) star.classList.toggle('on', favs.has(id));
  }

  /* ---------- Zustand ---------- */
  let current = null;        // aktuell angezeigte Frage
  let revealed = false;      // Antwort bereits sichtbar?
  let selected = new Set();  // vom Nutzer gewählte Optionen

  /* ---------- Sichten umschalten ---------- */
  const VIEWS = ['search', 'themes', 'favs', 'detail'];
  function showView(name) {
    VIEWS.forEach((v) => $('#view-' + v).classList.toggle('active', v === name));
    $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    window.scrollTo({ top: 0 });
    if (name === 'search') $('#searchInput').focus();
  }

  /* ---------- Kompaktes Ergebnis-Element ---------- */
  function compactItem(q) {
    const li = document.createElement('li');
    li.className = 'qitem';
    li.innerHTML =
      '<button class="qitem-btn" data-id="' + esc(q.n) + '">' +
      '<span class="qnum">' + esc(q.n) + '</span>' +
      (q.rn ? '<span class="qrn">Nr. ' + q.rn + '</span>' : '') +
      '<span class="qtext">' + esc(snippet(q.t, 110)) + '</span>' +
      '<span class="qpts ' + pointsClass(q.p) + '">' + q.p + ' P.</span>' +
      '</button>';
    return li;
  }

  /* ---------- Ergebnisliste ---------- */
  function renderResultList(container, questions, emptyText) {
    container.innerHTML = '';
    if (!questions.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = emptyText || 'Keine Treffer.';
      container.appendChild(p);
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'qlist';
    questions.forEach((q) => ul.appendChild(compactItem(q)));
    container.appendChild(ul);
  }

  /* ---------- Detailansicht ---------- */
  function renderDetail(q) {
    current = q;
    revealed = false;
    selected = new Set();
    showView('detail');

    const box = $('#detailBox');
    const favOn = favs.has(q.n);

    // Kopf: Nummer, Punkte, Favorit
    const head = document.createElement('div');
    head.className = 'q-head';
    head.innerHTML =
      '<span class="qnum-big">' + esc(q.n) + '</span>' +
      (q.rn ? '<span class="qrn-big" title="Laufende Nummer (wie in manchen Fahrschul-Apps)">Nr. ' + q.rn + '</span>' : '') +
      '<span class="qpts-big ' + pointsClass(q.p) + '">' + q.p + ' Punkte</span>' +
      '<button id="favBtn" class="fav-btn' + (favOn ? ' on' : '') + '" title="Favorit">★</button>';

    // Brotkrume: Thema → Kapitel
    const crumb = document.createElement('div');
    crumb.className = 'crumb';
    crumb.innerHTML =
      '<span class="crumb-theme">' + esc(themeOf(q.c)) + ' · ' + esc(q.th) + '</span>' +
      '<span class="crumb-ch">' + esc(q.c) + ' · ' + esc(q.ch) + '</span>';

    // Medien (Video zuerst, dann Bilder)
    const media = document.createElement('div');
    media.className = 'q-media';
    (q.v || []).forEach((src) => {
      const v = document.createElement('video');
      v.controls = true; v.preload = 'none'; v.playsInline = true;
      v.innerHTML = '<source src="' + esc(src) + '" type="video/mp4">';
      v.onerror = () => v.remove();
      media.appendChild(v);
    });
    (q.i || []).forEach((src) => {
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = 'Abbildung zur Frage';
      img.src = src;
      img.onerror = () => img.remove();
      media.appendChild(img);
    });
    if (!media.children.length) media.remove();

    // Fragetext
    const text = document.createElement('h2');
    text.className = 'q-text';
    text.textContent = q.t;

    box.innerHTML = '';
    box.appendChild(head);
    box.appendChild(crumb);
    box.appendChild(media);
    box.appendChild(text);

    // Antwortbereich
    const ans = document.createElement('div');
    ans.className = 'q-answers';
    ans.id = 'answersBox';

    const isNumber = q.na !== undefined;
    if (isNumber) {
      const hint = document.createElement('div');
      hint.className = 'num-hint';
      hint.textContent = 'Zahleneingabe-Frage – tippe auf „Antwort anzeigen“, um die Lösung zu sehen.';
      ans.appendChild(hint);
    } else {
      q.o.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt';
        btn.dataset.idx = String(i);
        const letter = String.fromCharCode(65 + i);
        const optImg = (q.oi && q.oi[i]) ? '<img class="opt-img" src="' + esc(q.oi[i]) + '" loading="lazy" alt="Antwort ' + letter + '">' : '';
        const optText = optImg || esc(opt || 'Antwort ' + letter + ' (Abbildung)');
        btn.innerHTML = '<span class="opt-letter">' + letter + '</span>' +
          '<span class="opt-text">' + optText + '</span>';
        btn.addEventListener('click', () => {
          if (revealed) return;
          if (selected.has(i)) selected.delete(i); else selected.add(i);
          btn.classList.toggle('sel', selected.has(i));
        });
        ans.appendChild(btn);
      });
    }

    const actions = document.createElement('div');
    actions.className = 'q-actions';
    const revealBtn = document.createElement('button');
    revealBtn.className = 'btn btn-primary';
    revealBtn.id = 'revealBtn';
    revealBtn.textContent = 'Antwort anzeigen';
    revealBtn.addEventListener('click', () => revealAnswer());
    const randBtn = document.createElement('button');
    randBtn.className = 'btn';
    randBtn.textContent = '🔀 Nächste Zufallsfrage';
    randBtn.addEventListener('click', () => renderDetail(FS.randomQuestion()));
    actions.appendChild(revealBtn);
    actions.appendChild(randBtn);

    box.appendChild(ans);
    box.appendChild(actions);

    // Favorit-Button nach dem Anhängen verdrahten
    $('#favBtn').addEventListener('click', () => toggleFav(q.n));
  }

  function revealAnswer() {
    if (!current) return;
    revealed = true;
    const box = $('#answersBox');
    const q = current;
    const isNumber = q.na !== undefined;

    let html = '';
    if (isNumber) {
      html += '<div class="num-answer"><span class="lbl">Antwort:</span> <b>' + esc(q.na) + '</b></div>';
    } else {
      q.o.forEach((opt, i) => {
        const correct = q.co.includes(i);
        const chosen = selected.has(i);
        let cls = 'opt static';
        if (correct) cls += ' correct';
        else if (chosen) cls += ' wrong';
        const letter = String.fromCharCode(65 + i);
        const optImg = (q.oi && q.oi[i]) ? '<img class="opt-img" src="' + esc(q.oi[i]) + '" loading="lazy" alt="Antwort ' + letter + '">' : '';
        const optText = optImg || esc(opt || 'Antwort ' + letter + ' (Abbildung)');
        const explLine = (q.ex && q.ex[i]) ? '<div class="opt-expl">' + esc(q.ex[i]) + '</div>' : '';
        html +=
          '<div class="' + cls + '">' +
          '<span class="opt-letter">' + letter + '</span>' +
          '<div class="opt-content"><span class="opt-text">' + optText + '</span>' + explLine + '</div>' +
          '<span class="opt-mark">' + (correct ? '✔' : (chosen ? '✘' : '')) + '</span>' +
          '</div>';
      });
    }

    if (q.e) {
      html += '<div class="expl"><div class="expl-title">🧠 Erklärung</div><div class="expl-body">' + esc(q.e) + '</div></div>';
    } else if (!(q.ex && q.ex.length)) {
      html += '<div class="expl none"><div class="expl-title">Hinweis</div><div class="expl-body">Für diese Frage liegt keine Erklärung im Datensatz vor.</div></div>';
    }

    box.innerHTML = html;
    const r = $('#revealBtn');
    if (r) { r.disabled = true; r.textContent = 'Antwort gezeigt'; }
  }

  /* ---------- Suche ---------- */
  function runSearch() {
    const input = $('#searchInput');
    const q = input.value.trim();
    const resBox = $('#searchResults');
    if (!q) {
      resBox.innerHTML = '<p class="empty">Gib eine Fragennummer (z. B. <b>1.4.41-175</b> oder <b>1576</b>) oder einen Suchbegriff ein.</p>';
      return;
    }
    showView('search');
    const { byNum, byText } = FS.search(q);
    resBox.innerHTML = '';
    if (byNum.length) {
      const h = document.createElement('h3');
      h.textContent = 'Nummerntreffer (' + byNum.length + ')';
      resBox.appendChild(h);
      renderResultList(resBox, byNum, '');
    }
    if (byText.length) {
      const h = document.createElement('h3');
      h.textContent = 'Weitere Treffer (' + byText.length + ')';
      resBox.appendChild(h);
      renderResultList(resBox, byText, '');
    }
    if (!byNum.length && !byText.length) {
      resBox.innerHTML = '<p class="empty">Keine Treffer für „' + esc(q) + '".</p>';
      return;
    }
    const hint = document.createElement('p');
    hint.className = 'enter-hint';
    hint.textContent = (byNum.length + byText.length === 1)
      ? '↵ Enter drücken oder auf den Treffer klicken, um die Frage zu öffnen.'
      : '↵ Enter drücken, um den ersten Treffer zu öffnen – oder auf eine Frage klicken.';
    resBox.appendChild(hint);
  }

  /* ---------- Themen-Baum ---------- */
  function renderThemes() {
    const box = $('#themesBox');
    box.innerHTML = '';
    FS.themeList().forEach((theme) => {
      const det = document.createElement('details');
      det.className = 'theme';
      det.innerHTML =
        '<summary><span class="th-code">Thema ' + esc(theme.code) + '</span> ' +
        '<span class="th-name">' + esc(theme.name) + '</span>' +
        '<span class="cnt">' + theme.count + '</span></summary>';
      const chapters = document.createElement('div');
      chapters.className = 'chapters';
      theme.chapters.forEach((code) => {
        const cdet = document.createElement('details');
        cdet.className = 'chapter';
        const meta = FS.chapterList().find((c) => c.code === code);
        cdet.innerHTML =
          '<summary><span class="ch-code">' + esc(code) + '</span> ' +
          '<span class="ch-name">' + esc(meta ? meta.name : '') + '</span>' +
          '<span class="cnt">' + (meta ? meta.count : 0) + '</span></summary>';
        const ul = document.createElement('ul');
        ul.className = 'qlist';
        FS.questionsByChapter(code).forEach((q) => ul.appendChild(compactItem(q)));
        cdet.appendChild(ul);
        chapters.appendChild(cdet);
      });
      det.appendChild(chapters);
      box.appendChild(det);
    });
  }

  /* ---------- Favoriten ---------- */
  function renderFavs() {
    const box = $('#favsBox');
    box.innerHTML = '';
    if (!favs.size) {
      box.innerHTML = '<p class="empty">Noch keine Favoriten. Markiere Fragen mit ★, um sie hier zu sammeln.</p>';
      return;
    }
    const questions = FS.DATA.filter((q) => favs.has(q.n));
    const ul = document.createElement('ul');
    ul.className = 'qlist';
    questions.forEach((q) => ul.appendChild(compactItem(q)));
    box.appendChild(ul);
  }

  /* ---------- Events ---------- */
  function init() {
    if (!FS || !FS.DATA || !FS.DATA.length) {
      document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif">Daten konnten nicht geladen werden (data/questions.js fehlt?).</div>';
      return;
    }
    $('#searchInput').addEventListener('input', runSearch);

    // Enter / "Suchen"-Button: Trefferliste öffnen, sonst in der Detailansicht Antwort zeigen
    const openOrReveal = () => {
      if ($('#view-search').classList.contains('active')) {
        const first = $('#searchResults .qitem-btn');
        if (first) first.click();
      } else if (current && $('#view-detail').classList.contains('active') && !revealed) {
        revealAnswer();
      }
    };
    $('#searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openOrReveal();
    });
    $('#searchGo').addEventListener('click', openOrReveal);
    $('#randomTab').addEventListener('click', () => {
      renderDetail(FS.randomQuestion());
    });
    $('#backBtn').addEventListener('click', () => showView('search'));

    // Delegation für Listen-Klicks
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.qitem-btn');
      if (btn) {
        const id = btn.dataset.id;
        const q = FS.findById(id)[0];
        if (q) renderDetail(q);
      }
    });

    // Tabs
    $$('.tab-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.view;
        if (v === 'themes') renderThemes();
        if (v === 'favs') renderFavs();
        showView(v);
      });
    });

    renderThemes();
    updateFavCount();
    const st = FS.DATA.length;
    $('#statCount').textContent = st + ' Fragen';
    $('#statExp').textContent = FS.DATA.filter((q) => q.e).length + ' mit Erklärung';

    // Direktaufruf mit ?q=<nummer|begriff>: einzelner Treffer wird direkt geöffnet
    try {
      const urlQ = new URLSearchParams(window.location.search).get('q');
      if (urlQ) {
        $('#searchInput').value = urlQ;
        runSearch();
        const res = FS.search(urlQ);
        if (res.byNum.length === 1) renderDetail(res.byNum[0]);
      }
    } catch (e) { /* ignorieren */ }
    $('#searchInput').focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
