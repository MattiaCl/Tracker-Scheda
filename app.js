/* Scheda Palestra — app principale (vanilla JS, dati in localStorage) */
'use strict';

const KEY = 'gymlog.v1';
const VERSION = '1.7 · senza diciture "prima"';
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fkg = n => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const today = () => new Date().toISOString().slice(0, 10);

let S;            // stato persistente
let view = { name: 'home' };

/* ---------- stato ---------- */
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.programs)) {
    S = { activeId: null, programs: [], settings: { sound: true, vibrate: true } };
    const p = seedProgram();
    S.programs.push(p);
    S.activeId = p.id;
    save();
  }
  S.settings = Object.assign({ sound: true, vibrate: true }, S.settings || {});
  // migrazione: deduce le serie extra dalla tecnica per gli esercizi che non le hanno ancora
  S.programs.forEach(p => p.days.forEach(d => d.exercises.forEach(ex => {
    if (ex.extra === undefined) ex.extra = guessExtra(ex.technique);
  })));
  save();
}

/* serie extra (drop / rest-pause) dedotte dal testo della tecnica */
function guessExtra(tech) {
  const t = String(tech || '').toLowerCase();
  if (/rest.?pause|myo/.test(t)) {
    const m = t.match(/(\d+)\s*[x×]/);
    return { type: 'rp', n: m ? Math.min(+m[1], 6) : 2, all: false };
  }
  if (/drop|stripping|scalare/.test(t)) {
    const n = /tripl/.test(t) ? 3 : /doppi|double/.test(t) ? 2 : 1;
    return { type: 'drop', n, all: false };
  }
  return null;
}
const extraApplies = (ex, i, nSets) => !!(ex.extra && ex.extra.type && ex.extra.n > 0 && (ex.extra.all || i === nSets - 1));
function dropPct(ex) { const m = String(ex.technique || '').match(/(\d+)\s*%/); return m ? +m[1] / 100 : null; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Errore nel salvataggio!'); }
}
const prog = () => S.programs.find(p => p.id === S.activeId) || S.programs[0];
const dayById = id => prog().days.find(d => d.id === id);
const exById = (day, id) => day.exercises.find(e => e.id === id);

function getLog(dayId, week, create) {
  const p = prog();
  p.logs = p.logs || {};
  if (!p.logs[dayId]) { if (!create) return null; p.logs[dayId] = {}; }
  if (!p.logs[dayId][week]) { if (!create) return null; p.logs[dayId][week] = { date: null, ex: {}, notes: {} }; }
  const l = p.logs[dayId][week];
  l.notes = l.notes || {};
  return l;
}
function setsFor(log, ex) {
  if (!log.ex[ex.id]) log.ex[ex.id] = ex.sets.map(() => blankSet());
  return log.ex[ex.id];
}
const blankSet = () => ({ kg: null, reps: null, done: false, extras: [] });
const hasData = s => s && (s.done || s.kg != null || s.reps != null);
function weekDone(dayId, w) {
  const l = getLog(dayId, w, false);
  return !!l && Object.values(l.ex).some(a => a.some(s => s.done));
}
function nextWeek(day) {
  const p = prog();
  for (let w = 1; w <= p.weeks; w++) if (!weekDone(day.id, w)) return w;
  return p.weeks;
}

/* ---------- formattazione ---------- */
function setLine(s) {
  let line = `${fkg(s.kg)} kg x ${s.reps ?? ''}`;
  if (s.kg == null) line = `${s.reps ?? ''} rip.`;
  return line;
}
function extrasLine(s) {
  const xs = (s.extras || []).filter(x => x.reps != null);
  if (!xs.length) return '';
  return '+ ' + xs.map(x => x.kg == null ? `${x.reps ?? ''}` : `${fkg(x.kg)} kg x ${x.reps ?? ''}`).join(' + ');
}
function cellText(dayId, ex, w) {
  const l = getLog(dayId, w, false);
  if (!l || !l.ex[ex.id]) return '';
  const lines = [];
  l.ex[ex.id].filter(s => s.done).forEach(s => {
    lines.push(setLine(s));
    const e = extrasLine(s); if (e) lines.push(e);
  });
  if (l.notes[ex.id]) lines.push('Nota: ' + l.notes[ex.id]);
  return lines.join('\n');
}
const uniq = a => [...new Set(a.map(x => String(x ?? '')))];
function targetSummary(ex) {
  const reps = uniq(ex.sets.map(s => s.reps)), rest = uniq(ex.sets.map(s => s.rest)), rir = uniq(ex.sets.map(s => s.rir));
  return {
    n: ex.sets.length,
    reps: reps.join(' / '),
    rest: rest.map(r => r === '' ? '' : r + '"').join(' / '),
    rir: rir.join(' / ')
  };
}

/* ---------- icone (stile linea, minimal) ---------- */
const ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  single: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3m0 0-5 5m5-5 5 5M5 21h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.4 1.3 2.8 2.5 2.8z"/>',
  note: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- render ---------- */
const app = document.getElementById('app');
const hdr = document.getElementById('hdr');

function go(v) { view = v; render(); window.scrollTo(0, 0); }
function render() {
  const keepScroll = window.scrollY;
  const r = ({ home: vHome, workout: vWorkout, editor: vEditor, exercise: vExercise, report: vReport, settings: vSettings })[view.name] || vHome;
  const { title, eyebrow, back, actions, html } = r();
  hdr.innerHTML = `
    ${back ? `<button class="hbtn" data-go="${back}" aria-label="Indietro">${ic('back', 22)}</button>` : ''}
    <div class="htitle">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${esc(title)}</h1></div>
    ${actions || ''}`;
  app.innerHTML = html;
  window.scrollTo(0, keepScroll);
  manageWakeLock();
}

const weekBar = (dayId, weeks) => `<div class="wbar">${Array.from({ length: weeks }, (_, i) =>
  `<span class="${weekDone(dayId, i + 1) ? 'on' : ''}"></span>`).join('')}</div>`;

function vHome() {
  const p = prog();
  // allenamento suggerito: il primo con meno settimane completate
  let next = null, best = Infinity;
  p.days.forEach(d => { const c = Array.from({ length: p.weeks }, (_, i) => weekDone(d.id, i + 1)).filter(Boolean).length; if (c < best && d.exercises.length) { best = c; next = d; } });
  const hero = next ? `<div class="hero">
      <div class="eyebrow">Prossimo allenamento</div>
      <div class="hero-title">${esc(next.name)}</div>
      <div class="muted">Settimana ${nextWeek(next)} · ${next.exercises.length} esercizi</div>
      <button class="primary big" data-act="start" data-day="${next.id}" data-week="${nextWeek(next)}">${ic('play', 16)} Inizia</button>
    </div>` : '';
  const days = p.days.map(d => `
    <button class="dayrow" data-act="start" data-day="${d.id}" data-week="${nextWeek(d)}">
      <div class="grow">
        <div class="dayname">${esc(d.name)}</div>
        <div class="muted small">${d.exercises.length} esercizi · sett. ${nextWeek(d)}</div>
        ${weekBar(d.id, p.weeks)}
      </div>
      <span class="dim">${ic('next', 20)}</span>
    </button>`).join('');
  return {
    title: p.name, eyebrow: 'La mia scheda',
    actions: `<button class="hbtn" data-go="settings" aria-label="Impostazioni">${ic('settings', 20)}</button>`,
    html: `${hero}
      <div class="section">Allenamenti</div>
      <div class="list">${days || '<div class="empty">Nessun allenamento. Aggiungine uno da “Modifica scheda”.</div>'}</div>
      <div class="tiles">
        <button class="tile" data-go="report">${ic('file', 22)}<span>Resoconto</span></button>
        <button class="tile" data-go="editor">${ic('edit', 22)}<span>Modifica scheda</span></button>
      </div>`
  };
}

function vWorkout() {
  const p = prog(), d = dayById(view.dayId);
  if (!d) return vHome();
  const w = view.week;
  const log = getLog(d.id, w, true);
  const prevLog = w > 1 ? getLog(d.id, w - 1, false) : null;
  const one = S.settings.oneByOne !== false;
  const weeks = Array.from({ length: p.weeks }, (_, i) =>
    `<button class="${i + 1 === w ? 'on' : ''} ${weekDone(d.id, i + 1) ? 'has' : ''}" data-act="week" data-week="${i + 1}">S${i + 1}</button>`).join('');

  const card = ex => {
    const sets = setsFor(log, ex);
    const prev = prevLog && prevLog.ex[ex.id] ? prevLog.ex[ex.id] : [];
    const t = targetSummary(ex);
    const rows = sets.map((s, i) => {
      const pv = prev[i];
      const tg = ex.sets[i] || ex.sets[ex.sets.length - 1] || {};
      const tgTxt = uniq(ex.sets.map(x => x.reps)).length > 1 ? `obiettivo ${tg.reps}` : '';
      // mini-serie: automatiche se l'esercizio ha drop/rest-pause, oppure aggiunte a mano con "+"
      const auto = extraApplies(ex, i, sets.length) ? ex.extra : null;
      s.extras = s.extras || [];
      if (auto) while (s.extras.length < auto.n) s.extras.push({ kg: null, reps: null });
      const pct = dropPct(ex);
      const extras = s.extras.map((x, j) => {
        const isAuto = !!auto && j < auto.n;
        const rp = isAuto && auto.type === 'rp';
        const px = pv && pv.extras ? pv.extras[j] : null;
        let kgPh = px && px.kg != null ? fkg(px.kg) : '';
        if (!kgPh && pct && isAuto) {
          const base = s.kg ?? (pv ? pv.kg : null);
          if (base) kgPh = fkg(Math.round(base * Math.pow(1 - pct, j + 1) * 2) / 2);
        }
        return `<div class="extra ${isAuto ? 'auto' : ''}">
          <span class="xidx">${i + 1}.${j + 1}</span>
          ${rp ? `<div class="rpnote">${j === 0 ? 'rest-pause' : ''}</div>`
            : `<div class="u"><input inputmode="decimal" placeholder="${kgPh || '='}" value="${fkg(x.kg)}" data-f="xkg" data-ex="${ex.id}" data-i="${i}" data-j="${j}"><span>kg</span></div>`}
          <div class="u"><input inputmode="numeric" placeholder="${px && px.reps != null ? px.reps : '–'}" value="${x.reps ?? ''}" data-f="xreps" data-ex="${ex.id}" data-i="${i}" data-j="${j}"><span>rip</span></div>
          ${isAuto ? '<span></span>' : `<button class="ibtn" data-act="xdel" data-ex="${ex.id}" data-i="${i}" data-j="${j}" aria-label="Rimuovi">${ic('x', 16)}</button>`}
          <span class="xtag">${isAuto ? (rp ? 'RP' : 'drop') : ''}</span>
        </div>`;
      }).join('');
      return `<div class="set ${s.done ? 'done' : ''}">
          <span class="idx">${i + 1}</span>
          <div class="u"><input inputmode="decimal" value="${fkg(s.kg)}" placeholder="${pv ? fkg(pv.kg) : ''}" data-f="kg" data-ex="${ex.id}" data-i="${i}"><span>kg</span></div>
          <div class="u"><input inputmode="numeric" value="${s.reps ?? ''}" placeholder="${pv && pv.reps != null ? pv.reps : (tg.reps || '')}" data-f="reps" data-ex="${ex.id}" data-i="${i}"><span>rip</span></div>
          <button class="ibtn" data-act="xadd" data-ex="${ex.id}" data-i="${i}" aria-label="Aggiungi drop o rest-pause">${ic('plus', 16)}</button>
          <button class="check" data-act="check" data-ex="${ex.id}" data-i="${i}" aria-label="Serie fatta">${ic('check', 20)}</button>
          ${tgTxt ? `<span></span><div class="prev">${esc(tgTxt)}</div>` : ''}
        </div>${extras}`;
    }).join('');
    const rest = (ex.sets[0] || {}).rest || 60;
    return `<section class="excard">
      <h2 class="exname">${esc(ex.name)}</h2>
      ${ex.note ? `<div class="exnote">${esc(ex.note)}</div>` : ''}
      <div class="pills">
        ${ex.technique ? `<span class="pill accent">${esc(ex.technique)}</span>` : ''}
        <span class="pill">${t.n} serie</span>
        <span class="pill">${esc(t.reps)} rip</span>
        <span class="pill">${esc(t.rest)}</span>
        ${t.rir !== '' ? `<span class="pill">RIR ${esc(t.rir)}</span>` : ''}
      </div>
      <div class="sethead"><span>#</span><span>Carico</span><span>Ripetizioni</span><span></span><span></span></div>
      ${rows}
      <div class="exfoot">
        <button class="tbtn" data-act="addset" data-ex="${ex.id}">${ic('plus', 15)} Serie</button>
        <button class="tbtn" data-act="delset" data-ex="${ex.id}">${ic('minus', 15)} Serie</button>
        <button class="tbtn" data-act="timer" data-sec="${rest}">${ic('timer', 15)} ${esc(rest)}″</button>
      </div>
      <details class="exnotes" ${log.notes[ex.id] ? 'open' : ''}><summary>${ic('note', 14)} Nota per il coach</summary>
        <input value="${esc(log.notes[ex.id] || '')}" data-f="note" data-ex="${ex.id}" placeholder="es. dolore spalla, macchina diversa…"></details>
    </section>`;
  };

  // pagine: [riscaldamento (se c'è)] + esercizi
  const pages = (d.warmup && d.warmup.trim() ? [{ warm: true }] : []).concat(d.exercises.map(ex => ({ ex })));
  const n = pages.length;
  const idx = Math.min(Math.max(view.idx || 0, 0), Math.max(n - 1, 0));
  view.idx = idx;
  const exDone = ex => { const a = log.ex[ex.id]; return !!a && a.length > 0 && a.every(s => s.done); };
  const warmItems = (d.warmup || '').split(/\s*·\s*|\n+/).map(s => s.trim()).filter(Boolean);
  const warm = d.warmup ? `<details class="warm"><summary>${ic('flame', 15)} Riscaldamento</summary><p>${warmItems.map(esc).join('<br>')}</p></details>` : '';
  const warmPage = `<section class="excard">
      <div class="eyebrow warm-eyebrow">${ic('flame', 13)} Prima di iniziare</div>
      <h2 class="exname">Riscaldamento</h2>
      <ul class="warmlist">${warmItems.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>`;
  const clear = `<button class="linkdanger" data-act="clearweek">${ic('trash', 14)} Cancella registro della settimana ${w}</button>`;
  let body;
  if (one && n) {
    const pg = pages[idx];
    const segs = pages.map((p2, i) =>
      `<button class="seg ${p2.warm ? 'warmseg' : ''} ${i === idx ? 'cur' : ''} ${p2.ex && exDone(p2.ex) ? 'ok' : ''}" data-act="goex" data-i="${i}" aria-label="${p2.warm ? 'Riscaldamento' : 'Esercizio ' + (i + 1)}"></button>`).join('');
    const exCount = d.exercises.length, exPos = pg.ex ? d.exercises.indexOf(pg.ex) + 1 : 0;
    body = `<div class="progress"><div class="segs">${segs}</div><span class="muted small">${pg.warm ? 'Risc.' : exPos + '/' + exCount}</span></div>
      ${pg.warm ? warmPage : card(pg.ex)}
      <div class="pager">
        <button class="ghost" data-act="goex" data-i="${idx - 1}" ${idx === 0 ? 'disabled' : ''}>${ic('back', 18)} Indietro</button>
        ${idx < n - 1
          ? `<button class="${pg.warm || exDone(pg.ex) ? 'primary' : 'soft'}" data-act="goex" data-i="${idx + 1}">${pg.warm ? 'Inizia' : 'Avanti'} ${ic('next', 18)}</button>`
          : `<button class="primary" data-act="finish">${ic('check', 18)} Fine</button>`}
      </div>
      ${idx === n - 1 ? clear : ''}`;
  } else {
    body = warm + d.exercises.map(card).join('') + clear;
  }

  return {
    title: d.name, eyebrow: `Settimana ${w}`, back: 'home',
    actions: `<button class="hbtn" data-act="mode" aria-label="${one ? 'Vista lista' : 'Un esercizio alla volta'}">${ic(one ? 'list' : 'single', 20)}</button>`,
    html: `<div class="wkbar"><div class="segctl">${weeks}</div>
        <input type="date" class="datein" value="${log.date || ''}" data-f="date" aria-label="Data allenamento"></div>
      ${body}`
  };
}

function vEditor() {
  const p = prog();
  const days = p.days.map((d, di) => `
    <section class="card">
      <div class="row">
        <input class="grow titleinput" value="${esc(d.name)}" data-f="dayname" data-day="${d.id}">
        <button class="ibtn" data-act="daymove" data-day="${d.id}" data-dir="-1" ${di === 0 ? 'disabled' : ''} aria-label="Su">${ic('up', 18)}</button>
        <button class="ibtn" data-act="daymove" data-day="${d.id}" data-dir="1" ${di === p.days.length - 1 ? 'disabled' : ''} aria-label="Giù">${ic('down', 18)}</button>
        <button class="ibtn" data-act="daydel" data-day="${d.id}" aria-label="Elimina">${ic('trash', 17)}</button>
      </div>
      <label>Riscaldamento</label>
      <textarea data-f="warmup" data-day="${d.id}">${esc(d.warmup || '')}</textarea>
      <label>Esercizi</label>
      <div class="exlist">
      ${d.exercises.map((ex, i) => {
        const t = targetSummary(ex);
        return `<div class="exrow">
          <div class="grow" data-act="exedit" data-day="${d.id}" data-ex="${ex.id}">
            <div class="exrow-name">${esc(ex.name)}</div>
            <div class="muted small">${t.n} × ${esc(t.reps)} · ${esc(t.rest)}${t.rir !== '' ? ' · RIR ' + esc(t.rir) : ''}${ex.technique ? ` · <span class="accent-text">${esc(ex.technique)}</span>` : ''}</div>
          </div>
          <button class="ibtn" data-act="exmove" data-day="${d.id}" data-ex="${ex.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Su">${ic('up', 17)}</button>
          <button class="ibtn" data-act="exmove" data-day="${d.id}" data-ex="${ex.id}" data-dir="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Giù">${ic('down', 17)}</button>
        </div>`;
      }).join('')}
      </div>
      <button class="tbtn" style="margin-top:6px" data-act="exadd" data-day="${d.id}">${ic('plus', 15)} Aggiungi esercizio</button>
    </section>`).join('');
  return {
    title: 'Modifica scheda', back: 'home',
    html: `<section class="card">
        <label class="first">Nome scheda</label>
        <input value="${esc(p.name)}" data-f="pname">
        <label>Numero di settimane</label>
        <input inputmode="numeric" value="${p.weeks}" data-f="pweeks">
      </section>
      ${days}
      <button class="soft full" data-act="dayadd">${ic('plus', 16)} Aggiungi allenamento</button>`
  };
}

const TECHNIQUES = ['Drop Set', 'Drop Set al 30%', 'Doppio Drop Set', 'Rest-Pause', 'Rest-Pause 2x15"', 'Myo-reps', 'Superserie', 'Giant Set', 'Cluster Set', 'Serie a scalare', 'Parziali', 'Isometria in contrazione', 'Tempo 3-1-1', 'Pre-affaticamento', 'Negative'];

function vExercise() {
  const d = dayById(view.dayId), ex = d && exById(d, view.exId);
  if (!ex) return vEditor();
  const same = uniq(ex.sets.map(s => s.reps)).length <= 1 && uniq(ex.sets.map(s => s.rest)).length <= 1 && uniq(ex.sets.map(s => s.rir)).length <= 1;
  const custom = view.custom ?? !same;
  const f = ex.sets[0] || { reps: '', rest: '', rir: '' };
  const xt = ex.extra && ex.extra.type;
  return {
    title: ex.name || 'Esercizio', eyebrow: d.name, back: 'editor',
    html: `<section class="card">
      <label class="first">Nome esercizio</label>
      <input value="${esc(ex.name)}" data-f="exname">
      <label>Indicazioni (sotto il nome)</label>
      <input value="${esc(ex.note)}" data-f="exnote" placeholder="es. con busto in avanti">
      <label>Tecnica d'intensità</label>
      <input value="${esc(ex.technique)}" data-f="extech" list="techs" placeholder="es. Drop Set al 30% (testo libero)">
      <datalist id="techs">${TECHNIQUES.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    </section>
    <section class="card">
      <div class="row"><div class="grow"><b>Serie</b></div>
        <div class="stepper"><button data-act="exsets" data-dir="-1" aria-label="Meno">${ic('minus', 16)}</button><b>${ex.sets.length}</b><button data-act="exsets" data-dir="1" aria-label="Più">${ic('plus', 16)}</button></div></div>
      <label class="switch"><input type="checkbox" data-f="custom" ${custom ? 'checked' : ''}><span>Serie diverse tra loro<br><small class="muted">piramidi, top set + back-off…</small></span></label>
      ${custom ? `<table class="settable"><tr><th></th><th>Ripetizioni</th><th>Recupero (s)</th><th>RIR</th></tr>
        ${ex.sets.map((s, i) => `<tr><td>${i + 1}</td>
          <td><input value="${esc(s.reps)}" data-f="sreps" data-i="${i}"></td>
          <td><input inputmode="numeric" value="${esc(s.rest)}" data-f="srest" data-i="${i}"></td>
          <td><input value="${esc(s.rir)}" data-f="srir" data-i="${i}"></td></tr>`).join('')}</table>`
        : `<div class="grid3">
          <div><label>Ripetizioni</label><input value="${esc(f.reps)}" data-f="areps" placeholder="8-10"></div>
          <div><label>Recupero (s)</label><input inputmode="numeric" value="${esc(f.rest)}" data-f="arest" placeholder="90"></div>
          <div><label>RIR</label><input value="${esc(f.rir)}" data-f="arir" placeholder="1"></div></div>`}
      <p class="muted small">Ripetizioni e RIR sono testo libero: “6-8”, “max”, “30 sec”, “AMRAP”, “0-1”…</p>
    </section>
    <section class="card">
      <b>Mini-serie extra</b>
      <div class="muted small" style="margin:2px 0 12px">Righe piccole sotto la serie per drop set o rest-pause${ex.extraManual ? '' : ' · dedotte dalla tecnica'}</div>
      <div class="segctl">
        <button class="${!xt ? 'on' : ''}" data-act="xtype" data-v="">Nessuna</button>
        <button class="${xt === 'drop' ? 'on' : ''}" data-act="xtype" data-v="drop">Drop set</button>
        <button class="${xt === 'rp' ? 'on' : ''}" data-act="xtype" data-v="rp">Rest-pause</button>
      </div>
      ${xt ? `<div class="row" style="margin-top:14px"><div class="grow">${xt === 'drop' ? 'Numero di drop' : 'Mini-serie di rest-pause'}
          <div class="muted small">${xt === 'drop' ? 'con carico e ripetizioni' : 'solo ripetizioni, stesso carico'}</div></div>
        <div class="stepper"><button data-act="xn" data-dir="-1" aria-label="Meno">${ic('minus', 16)}</button><b>${ex.extra.n}</b><button data-act="xn" data-dir="1" aria-label="Più">${ic('plus', 16)}</button></div></div>
        <label class="switch"><input type="checkbox" data-f="xall" ${ex.extra.all ? 'checked' : ''}><span>Su tutte le serie<br><small class="muted">altrimenti solo sull'ultima</small></span></label>` : ''}
    </section>
    <button class="linkdanger" data-act="exdel">${ic('trash', 14)} Elimina esercizio</button>`
  };
}

function vReport() {
  return {
    title: 'Resoconto', eyebrow: prog().name, back: 'home',
    html: `<div class="actions3">
        <button class="primary" data-act="share">${ic('share', 17)} Invia</button>
        <button class="soft" data-act="xlsx">${ic('download', 17)} Excel</button>
        <button class="soft" data-act="print">${ic('print', 17)} PDF</button>
      </div>
      <div class="rep-wrap">${reportTables()}</div>`
  };
}
function reportTables() {
  const p = prog();
  const wk = Array.from({ length: p.weeks }, (_, i) => `<th>Settimana ${i + 1}</th>`).join('');
  return p.days.map(d => `<table class="rep">
    <tr><th>${esc(d.name)}</th><th>Serie</th><th>Ripetizioni</th><th>Recupero</th><th>RIR</th>${wk}</tr>
    ${d.exercises.map(ex => {
      const t = targetSummary(ex);
      return `<tr><td class="name"><b>${esc(ex.name)}</b>${ex.note ? `<i>${esc(ex.note)}</i><br>` : ''}${ex.technique ? `<i>+ ${esc(ex.technique)}</i>` : ''}</td>
        <td class="n">${t.n}</td><td class="c">${esc(t.reps)}</td><td class="c">${esc(t.rest)}</td><td class="n">${esc(t.rir)}</td>
        ${Array.from({ length: p.weeks }, (_, i) => `<td class="wk">${esc(cellText(d.id, ex, i + 1))}</td>`).join('')}</tr>`;
    }).join('')}
    ${d.warmup ? `<tr><td class="warm" colspan="${5 + p.weeks}">Riscaldamento: ${esc(d.warmup)}</td></tr>` : ''}
  </table>`).join('');
}

function vSettings() {
  const p = prog();
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return {
    title: 'Impostazioni', back: 'home',
    html: `<div class="section">Schede</div>
      <section class="card">
        ${S.programs.map(x => `<div class="exrow"><div class="grow">
          <div class="exrow-name">${esc(x.name)} ${x.id === p.id ? '<span class="pill accent">attiva</span>' : ''}</div>
          <div class="muted small">${x.days.length} allenamenti · ${x.weeks} settimane</div></div>
          ${x.id !== p.id ? `<button class="soft small" data-act="pactivate" data-p="${x.id}">Usa</button>` : ''}</div>`).join('')}
        <div class="stack">
          <button class="soft" data-act="pclone">${ic('repeat', 16)} Nuovo ciclo · stessa scheda, registro vuoto</button>
          <button class="soft" data-act="pnew">${ic('plus', 16)} Scheda vuota</button>
        </div>
        ${S.programs.length > 1 ? `<button class="linkdanger" data-act="pdel">${ic('trash', 14)} Elimina scheda attiva</button>` : ''}
      </section>
      <div class="section">Timer di recupero</div>
      <section class="card">
        <label class="switch"><input type="checkbox" data-f="snd" ${S.settings.sound ? 'checked' : ''}><span>Suono a fine recupero</span></label>
        <label class="switch"><input type="checkbox" data-f="vib" ${S.settings.vibrate ? 'checked' : ''}><span>Vibrazione a fine recupero</span></label>
        <div class="stack">
          ${perm === 'granted' ? `<div class="muted small">${ic('bell', 14)} Notifiche attive: quando esci dall'app vedi il timer nella tendina.</div>`
            : perm === 'denied' ? `<div class="muted small">${ic('bell', 14)} Notifiche bloccate: riattivale dalle impostazioni del sito in Chrome.</div>`
            : perm === 'default' ? `<button class="soft" data-act="notifyperm">${ic('bell', 16)} Attiva notifiche del timer</button>` : ''}
          <button class="soft" data-act="testtimer">${ic('timer', 16)} Prova timer (10 secondi)</button>
        </div>
      </section>
      <div class="section">Backup e PC</div>
      <section class="card">
        <p class="muted small" style="margin-top:0">Salva un file con tutti i dati per spostarli sul PC o su un nuovo telefono.</p>
        <div class="stack">
          <button class="soft" data-act="backup">${ic('download', 16)} Esporta backup</button>
          <button class="soft" data-act="restore">${ic('upload', 16)} Importa backup</button>
        </div>
        <input type="file" id="restoreFile" accept=".json,application/json" hidden>
      </section>
      <p class="muted small" style="text-align:center">Versione ${VERSION}</p>`
  };
}

/* ---------- input (senza re-render, per non perdere il focus) ---------- */
app.addEventListener('input', e => {
  const t = e.target, f = t.dataset.f;
  if (!f) return;
  const p = prog();
  if (view.name === 'workout') {
    const d = dayById(view.dayId), log = getLog(d.id, view.week, true);
    if (f === 'date') { log.date = t.value || null; save(); return; }
    const ex = exById(d, t.dataset.ex), sets = setsFor(log, ex), i = +t.dataset.i;
    if (f === 'kg') sets[i].kg = num(t.value);
    if (f === 'reps') sets[i].reps = num(t.value);
    if (f === 'xkg') sets[i].extras[+t.dataset.j].kg = num(t.value);
    if (f === 'xreps') {
      const x = sets[i].extras[+t.dataset.j];
      x.reps = num(t.value);
      // se il carico del drop è vuoto, usa quello suggerito
      const kin = t.closest('.extra').querySelector('[data-f=xkg]');
      if (x.kg == null && kin && kin.placeholder && kin.placeholder !== '=') { x.kg = num(kin.placeholder); kin.value = kin.placeholder; }
    }
    if (f === 'note') { if (t.value.trim()) log.notes[ex.id] = t.value; else delete log.notes[ex.id]; }
  } else if (view.name === 'editor') {
    if (f === 'pname') p.name = t.value;
    if (f === 'pweeks') { const n = parseInt(t.value); if (n >= 1 && n <= 52) p.weeks = n; }
    if (f === 'dayname') dayById(t.dataset.day).name = t.value;
    if (f === 'warmup') dayById(t.dataset.day).warmup = t.value;
  } else if (view.name === 'exercise') {
    const ex = exById(dayById(view.dayId), view.exId), i = +t.dataset.i;
    if (f === 'exname') ex.name = t.value;
    if (f === 'exnote') ex.note = t.value;
    if (f === 'extech') { ex.technique = t.value; if (!ex.extraManual) ex.extra = guessExtra(t.value); }
    if (f === 'areps') ex.sets.forEach(s => s.reps = t.value);
    if (f === 'arest') ex.sets.forEach(s => s.rest = t.value.replace(/\D/g, ''));
    if (f === 'arir') ex.sets.forEach(s => s.rir = t.value);
    if (f === 'sreps') ex.sets[i].reps = t.value;
    if (f === 'srest') ex.sets[i].rest = t.value.replace(/\D/g, '');
    if (f === 'srir') ex.sets[i].rir = t.value;
  }
  save();
});
app.addEventListener('change', e => {
  const t = e.target, f = t.dataset.f;
  if (f === 'custom') { view.custom = t.checked; render(); }
  if (f === 'extech' && view.name === 'exercise') render();
  if (f === 'xall') { const ex = exById(dayById(view.dayId), view.exId); ex.extra.all = t.checked; ex.extraManual = true; save(); }
  if (f === 'snd') { S.settings.sound = t.checked; save(); }
  if (f === 'vib') { S.settings.vibrate = t.checked; save(); }
  if (t.id === 'restoreFile' && t.files[0]) restore(t.files[0]);
  if (f === 'pweeks') render();
});

/* ---------- click ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go],[data-act],[data-t]');
  if (!b || b.disabled) return;
  unlockAudio();
  if (b.dataset.go) return go({ name: b.dataset.go });
  if (b.dataset.t) return timerCtl(b.dataset.t);
  const a = b.dataset.act, p = prog();
  const d = b.dataset.day ? dayById(b.dataset.day) : (view.dayId ? dayById(view.dayId) : null);

  switch (a) {
    case 'start': return go({ name: 'workout', dayId: b.dataset.day, week: +b.dataset.week });
    case 'week': view.week = +b.dataset.week; return render();
    case 'goex': view.idx = +b.dataset.i; render(); return window.scrollTo(0, 0);
    case 'mode': S.settings.oneByOne = S.settings.oneByOne === false; save(); return render();
    case 'finish': toast('Allenamento salvato 💪'); return go({ name: 'home' });
    case 'clearweek':
      if (confirm(`Cancellare tutto quello che hai registrato in "${d.name}" – settimana ${view.week}?`)) {
        delete p.logs[d.id][view.week]; save(); toast('Settimana cancellata'); render();
      }
      return;
    case 'check': {
      const log = getLog(d.id, view.week, true), ex = exById(d, b.dataset.ex), i = +b.dataset.i;
      const s = setsFor(log, ex)[i];
      if (!s.done) {
        const row = b.closest('.set');
        const kgIn = row.querySelector('[data-f=kg]'), rIn = row.querySelector('[data-f=reps]');
        if (s.kg == null && kgIn.placeholder) s.kg = num(kgIn.placeholder);
        if (s.reps == null && rIn.placeholder && /^\d+$/.test(rIn.placeholder)) s.reps = num(rIn.placeholder);
        if (s.reps == null) { toast('Inserisci le ripetizioni'); rIn.focus(); return; }
        s.done = true;
        if (!log.date) log.date = today();
        const tg = ex.sets[i] || ex.sets[ex.sets.length - 1] || {};
        const rest = parseInt(tg.rest);
        if (rest > 0) startTimer(rest, ex.name);
      } else s.done = false;
      save(); return render();
    }
    case 'xadd': {
      const log = getLog(d.id, view.week, true), ex = exById(d, b.dataset.ex);
      setsFor(log, ex)[+b.dataset.i].extras.push({ kg: null, reps: null });
      save(); return render();
    }
    case 'xdel': {
      const log = getLog(d.id, view.week, true), ex = exById(d, b.dataset.ex);
      setsFor(log, ex)[+b.dataset.i].extras.splice(+b.dataset.j, 1);
      save(); return render();
    }
    case 'addset': {
      const log = getLog(d.id, view.week, true), ex = exById(d, b.dataset.ex);
      setsFor(log, ex).push(blankSet()); save(); return render();
    }
    case 'delset': {
      const log = getLog(d.id, view.week, true), ex = exById(d, b.dataset.ex), sets = setsFor(log, ex);
      if (sets.length > 1) sets.pop(); save(); return render();
    }
    case 'timer': return startTimer(+b.dataset.sec, 'Recupero');
    /* editor */
    case 'dayadd': p.days.push({ id: uid(), name: 'Allenamento ' + (p.days.length + 1), warmup: '', exercises: [] }); save(); return render();
    case 'daydel':
      if (confirm(`Eliminare "${d.name}" e il suo registro?`)) { p.days = p.days.filter(x => x !== d); if (p.logs) delete p.logs[d.id]; save(); render(); }
      return;
    case 'daymove': move(p.days, d, +b.dataset.dir); save(); return render();
    case 'exadd': {
      const ex = { id: uid(), name: 'Nuovo esercizio', note: '', technique: '', sets: [1, 2, 3].map(() => ({ reps: '8-10', rest: '90', rir: '1' })) };
      d.exercises.push(ex); save(); return go({ name: 'exercise', dayId: d.id, exId: ex.id });
    }
    case 'exedit': return go({ name: 'exercise', dayId: d.id, exId: b.dataset.ex });
    case 'exmove': move(d.exercises, exById(d, b.dataset.ex), +b.dataset.dir); save(); return render();
    case 'xtype': {
      const ex = exById(d, view.exId), v = b.dataset.v;
      ex.extra = v ? { type: v, n: (ex.extra && ex.extra.n) || (v === 'rp' ? 2 : 1), all: !!(ex.extra && ex.extra.all) } : null;
      ex.extraManual = true; save(); return render();
    }
    case 'xn': {
      const ex = exById(d, view.exId);
      ex.extra.n = Math.min(6, Math.max(1, ex.extra.n + +b.dataset.dir)); ex.extraManual = true; save(); return render();
    }
    case 'exsets': {
      const ex = exById(d, view.exId);
      if (+b.dataset.dir > 0) ex.sets.push({ ...(ex.sets[ex.sets.length - 1] || { reps: '8-10', rest: '90', rir: '1' }) });
      else if (ex.sets.length > 1) ex.sets.pop();
      save(); return render();
    }
    case 'exdel': {
      const ex = exById(d, view.exId);
      if (confirm(`Eliminare "${ex.name}"?`)) { d.exercises = d.exercises.filter(x => x !== ex); save(); go({ name: 'editor' }); }
      return;
    }
    /* report */
    case 'xlsx': return exportXlsx(false);
    case 'share': return exportXlsx(true);
    case 'print': return window.print();
    /* settings */
    case 'pactivate': S.activeId = b.dataset.p; save(); return render();
    case 'pclone': {
      const c = JSON.parse(JSON.stringify(p));
      c.id = uid(); c.logs = {}; c.name = p.name + ' (nuovo ciclo)';
      S.programs.unshift(c); S.activeId = c.id; save(); toast('Nuovo ciclo creato'); return render();
    }
    case 'pnew': {
      const c = { id: uid(), name: 'Nuova scheda', weeks: 4, days: [], logs: {} };
      S.programs.unshift(c); S.activeId = c.id; save(); return go({ name: 'editor' });
    }
    case 'pdel':
      if (confirm(`Eliminare definitivamente "${p.name}" con tutto il registro?`)) {
        S.programs = S.programs.filter(x => x !== p); S.activeId = S.programs[0].id; save(); render();
      }
      return;
    case 'testtimer': toast('Esci dall\'app per vedere la notifica'); return startTimer(10, 'Prova timer');
    case 'notifyperm': return askNotify();
    case 'backup': {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      return download(blob, `backup-palestra-${today()}.json`);
    }
    case 'restore': return document.getElementById('restoreFile').click();
  }
});
/* swipe orizzontale per cambiare esercizio */
let touch = null;
app.addEventListener('touchstart', e => {
  if (view.name !== 'workout' || S.settings.oneByOne === false || e.touches.length !== 1) { touch = null; return; }
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
app.addEventListener('touchend', e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
  const dd = dayById(view.dayId);
  const n = dd.exercises.length + (dd.warmup && dd.warmup.trim() ? 1 : 0), i = (view.idx || 0) + (dx < 0 ? 1 : -1);
  if (i < 0 || i >= n) return;
  view.idx = i; render(); window.scrollTo(0, 0);
}, { passive: true });

function move(arr, item, dir) {
  const i = arr.indexOf(item), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
function restore(file) {
  file.text().then(t => {
    const data = JSON.parse(t);
    if (!data || !Array.isArray(data.programs)) throw new Error();
    if (!confirm('Sostituire tutti i dati attuali con quelli del backup?')) return;
    S = data; save(); toast('Backup importato'); go({ name: 'home' });
  }).catch(() => toast('File di backup non valido'));
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- export Excel ---------- */
async function exportXlsx(share) {
  if (!window.ExcelJS) { toast('Modulo Excel non caricato: serve connessione la prima volta'); return; }
  const p = prog();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Scheda', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const nCols = 5 + p.weeks;
  ws.columns = [{ width: 36 }, { width: 7 }, { width: 11 }, { width: 10 }, { width: 6 }, ...Array.from({ length: p.weeks }, () => ({ width: 17 }))];
  const thin = { style: 'thin', color: { argb: 'FF9A9A9A' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const base = { name: 'Arial', size: 10 };

  p.days.forEach((d, di) => {
    if (di > 0) { ws.addRow([]); ws.addRow([]); }
    const h = ws.addRow([d.name, 'Serie', 'Ripetizioni', 'Recupero', 'RIR', ...Array.from({ length: p.weeks }, (_, i) => 'Settimana ' + (i + 1))]);
    h.eachCell(c => { c.border = border; c.font = base; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; });
    d.exercises.forEach(ex => {
      const t = targetSummary(ex);
      const weeks = Array.from({ length: p.weeks }, (_, i) => cellText(d.id, ex, i + 1));
      const sub = [ex.note, ex.technique ? '+ ' + ex.technique : ''].filter(Boolean);
      const r = ws.addRow([null, t.n, t.reps, t.rest, num(t.rir) ?? t.rir, ...weeks]);
      r.getCell(1).value = { richText: [{ text: ex.name, font: { ...base, bold: true } }, ...(sub.length ? [{ text: '\n' + sub.join('\n'), font: { ...base, size: 8, color: { argb: 'FF555555' } } }] : [])] };
      const lines = Math.max(2, 1 + sub.length, ...weeks.map(w => w ? w.split('\n').length : 0));
      r.height = lines * 13 + 6;
      for (let c = 1; c <= nCols; c++) {
        const cell = r.getCell(c);
        cell.border = border;
        if (!cell.font || c > 1) cell.font = base;
        cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c === 1 || c > 5 ? 'left' : (c === 3 || c === 4 ? 'center' : 'right') };
      }
    });
    if (d.warmup) {
      const r = ws.addRow(['Riscaldamento: ' + d.warmup]);
      ws.mergeCells(r.number, 1, r.number, nCols);
      r.getCell(1).font = { ...base, size: 9 };
      r.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
      r.getCell(1).border = border;
      r.height = 18;
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const name = `Resoconto ${p.name.replace(/[\\/:*?"<>|]/g, '')} ${today()}.xlsx`;
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const file = new File([buf], name, { type });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Resoconto allenamento' }); } catch (e) { /* annullato */ }
    return;
  }
  if (share) toast('Condivisione non disponibile qui: scarico il file');
  download(file, name);
}

/* ---------- timer di recupero ---------- */
const T = { el: document.getElementById('timer'), end: 0, total: 0, label: '', iv: null, to: null, fired: true };
const RING = 2 * Math.PI * 21;
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function startTimer(sec, label) {
  T.total = sec; T.end = Date.now() + sec * 1000; T.label = label; T.fired = false;
  localStorage.setItem('gymlog.timer', JSON.stringify({ end: T.end, total: T.total, label }));
  askNotify();
  closeNotifs('rest-end');
  runTimer();
}
function runTimer() {
  clearInterval(T.iv); clearTimeout(T.to);
  T.el.classList.add('show'); T.el.classList.remove('end');
  document.getElementById('tlbl').textContent = T.label;
  T.iv = setInterval(tick, 250); tick();
  T.to = setTimeout(tick, Math.max(0, T.end - Date.now()) + 30);
  if (document.hidden) startNotifLoop();
}
function tick() {
  if (T.fired) return;
  const left = Math.max(0, T.end - Date.now());
  document.getElementById('ttime').textContent = mmss(Math.ceil(left / 1000));
  const frac = T.total ? left / (T.total * 1000) : 0;
  document.getElementById('tring').style.strokeDashoffset = (RING * (1 - frac)).toFixed(1);
  if (left <= 0) { T.fired = true; timerEnd(); }
}
function timerEnd() {
  clearInterval(T.iv);
  stopNotifLoop();
  localStorage.removeItem('gymlog.timer');
  T.el.classList.add('end');
  document.getElementById('tlbl').textContent = 'Recupero finito';
  document.getElementById('ttime').textContent = 'Vai!';
  if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 700]);
  if (S.settings.sound) beep();
  if (document.hidden && canNotify()) {
    navigator.serviceWorker.ready.then(r => r.showNotification('Recupero finito 💪', {
      tag: 'rest-end', body: T.label + ' · tocca per tornare all\'allenamento', icon: 'icon-192.png',
      vibrate: S.settings.vibrate ? [400, 150, 400, 150, 700] : [], silent: !S.settings.sound && !S.settings.vibrate
    })).catch(() => {});
  }
  setTimeout(() => { if (T.fired) T.el.classList.remove('show', 'end'); }, 6000);
}
function timerCtl(cmd) {
  if (cmd === 'stop') {
    T.fired = true; clearInterval(T.iv); clearTimeout(T.to); stopNotifLoop();
    localStorage.removeItem('gymlog.timer'); T.el.classList.remove('show', 'end'); return;
  }
  if (T.fired) { startTimer(Math.max(5, +cmd), T.label || 'Recupero'); return; }
  T.end = Math.max(Date.now() + 1000, T.end + +cmd * 1000); T.total = Math.max(T.total + +cmd, 1);
  localStorage.setItem('gymlog.timer', JSON.stringify({ end: T.end, total: T.total, label: T.label }));
  runTimer();
  if (document.hidden) showRestNotif();
}

/* notifica con il conto alla rovescia quando esci dall'app */
const canNotify = () => 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator;
let nIv = null;
async function showRestNotif() {
  if (!canNotify() || T.fired) return;
  const s = Math.ceil(Math.max(0, T.end - Date.now()) / 1000);
  const at = new Date(T.end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  try {
    const r = await navigator.serviceWorker.ready;
    await r.showNotification(`⏱ Recupero ${mmss(s)}`, {
      tag: 'rest', body: `${T.label} · finisce alle ${at}`, icon: 'icon-192.png',
      silent: true, renotify: false, requireInteraction: true,
      actions: [{ action: 'add15', title: '+15 s' }, { action: 'skip', title: 'Salta' }]
    });
  } catch (e) { }
}
function startNotifLoop() { if (nIv || !canNotify()) return; showRestNotif(); nIv = setInterval(showRestNotif, 1000); }
function stopNotifLoop() { clearInterval(nIv); nIv = null; closeNotifs('rest'); }
async function closeNotifs(tag) {
  try {
    const r = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    if (r) (await r.getNotifications({ tag })).forEach(n => n.close());
  } catch (e) { }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.timer === 'add15') timerCtl('15');
  if (e.data.timer === 'skip') timerCtl('stop');
});
let actx;
function unlockAudio() {
  if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
  if (actx && actx.state === 'suspended') actx.resume();
}
function beep() {
  if (!actx) return;
  [0, 0.35, 0.7].forEach((t, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, actx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.5, actx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.28);
    o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.3);
  });
}
function askNotify() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => { if (view.name === 'settings') render(); }).catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!T.fired) startNotifLoop(); }
  else { stopNotifLoop(); closeNotifs('rest-end'); tick(); manageWakeLock(); }
});

/* schermo sempre acceso durante l'allenamento */
let wakeLock = null;
async function manageWakeLock() {
  const want = view.name === 'workout';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator && !document.hidden) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

/* ---------- avvio ---------- */
load();
try {
  const saved = JSON.parse(localStorage.getItem('gymlog.timer'));
  if (saved && saved.end > Date.now()) { T.end = saved.end; T.total = saved.total; T.label = saved.label; T.fired = false; runTimer(); }
} catch (e) { }
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  // quando arriva una versione nuova del service worker, ricarica una volta
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
