/* Scheda iniziale: trascritta dal foglio Google (settimane 1 e 2) */
'use strict';
function seedProgram() {
  const id = () => Math.random().toString(36).slice(2, 10);
  const R = (n, s) => Array(n).fill(s).join(',');
  // "57.5x6,57.5x6" ; extra dopo "+": "9x10+7x2" (drop) o "55x11+3+3" (rest-pause)
  const parse = str => !str ? [] : str.split(',').map(t => {
    const [main, ...ext] = t.split('+');
    const [kg, reps] = main.split('x').map(Number);
    return {
      kg, reps, done: true,
      extras: ext.map(e => e.includes('x') ? { kg: +e.split('x')[0], reps: +e.split('x')[1] } : { kg: null, reps: +e })
    };
  });
  const p = { id: id(), name: 'Scheda attuale', weeks: 4, days: [], logs: {} };
  const day = (name, warmup, list) => {
    const d = { id: id(), name, warmup, exercises: [] };
    p.logs[d.id] = {};
    list.forEach(([name, n, reps, rest, rir, opt, weeks]) => {
      const ex = { id: id(), name, note: opt.note || '', technique: opt.tech || '',
        sets: Array.from({ length: n }, () => ({ reps, rest: String(rest), rir: String(rir) })) };
      d.exercises.push(ex);
      weeks.forEach((w, i) => {
        if (!w) return;
        const L = p.logs[d.id][i + 1] = p.logs[d.id][i + 1] || { date: null, ex: {}, notes: {} };
        L.ex[ex.id] = parse(w);
      });
    });
    p.days.push(d);
  };

  day('Allenamento 1', '3 min ellittica · Cat-Cow × 10 · Extra-rotazioni × 12 · Prone Cobra × 12 · 2 serie di avvicinamento', [
    ['Incline Chest Press', 4, '6-8', 90, 1, {}, [R(4, '57.5x6'), R(4, '57.5x8')]],
    ['Chest Press Neutra', 3, '8-10', 90, 1, {}, [R(3, '38x8'), R(3, '38x9')]],
    ['Shoulder Press Manubri', 3, '8-10', 90, 1, {}, [R(3, '15x8'), R(3, '15x9')]],
    ['Alzate Laterali al Cavo', 4, '10-12', 60, 0, { tech: 'Drop Set al 30%' }, ['10.25x10,10.25x10,10.25x8,9x10+7x2', '9x10,9x10,9x10,9x10+7x3']],
    ['French Press', 3, '8-10', 60, 1, {}, ['8x9,8x9,8x5', '8x8,8x8,8x7']],
    ['Pushdown Tricipiti Corda', 3, '12-15', 45, 0, {}, ['16.6x12,16.6x9,14.3x10', R(3, '12x12')]],
  ]);
  day('Allenamento 2', '3 min cyclette · Single Glute Bridge × 15 · Leg Swing × 10 · Mobilità caviglia al muro × 10 · Dead Bug a terra × 8 · 2 serie di avvicinamento', [
    ['Reverse Hyperextension alla Macchina', 4, '10-12', 90, 1, { note: '(in linea con il perno del peso)' }, [R(4, '5x11'), R(4, '5x12')]],
    ['Romanian Deadlift con Manubri', 4, '8-10', 90, 1, {}, [R(4, '15x8'), R(4, '15x9')]],
    ['Leg Extension', 3, '10-12', 90, 0, { tech: 'Rest-Pause 2x15"' }, ['55x12,55x11,55x11+3+3', '55x12,55x12,55x12+4+3']],
    ['Seated Leg Curl', 4, '10-12', 60, 1, {}, ['52.5x11,52.5x11,52.5x10,52.5x11', R(4, '52.5x12')]],
    ['Calf alla Macchina in Piedi', 4, '8-10', 60, 1, {}, [R(4, '70x10'), R(4, '75x8')]],
    ['Crunch Machine', 3, '12-15', 60, 0, {}, ['32.5x15,32.5x14,32.5x14', '32.5x15,32.5x15,32.5x10']],
  ]);
  day('Allenamento 3', '3 min ellittica · Cat-Cow × 10 · Dislocazione spalle × 10 · Band Pull-Apart × 12 · 2 serie di avvicinamento', [
    ['Lat Machine Presa Neutra', 4, '6-8', 90, 1, {}, [R(4, '50x7'), R(4, '50x8')]],
    ['Pulley Basso', 4, '8-10', 90, 1, {}, [R(4, '43x9'), R(4, '43x10')]],
    ['Pull Down alla Sbarra EZ', 3, '12-15', 60, 0, {}, [R(3, '25.3x15'), R(3, '27.6x12')]],
    ['Cable Rear Delt Fly', 3, '12-15', 60, 0, {}, [R(3, '7x12'), R(3, '7x13')]],
    ['Bayesian Curl ai Cavi', 3, '10-12', 60, 1, {}, [R(3, '14x12'), R(3, '15.25x10')]],
    ['Preacher Curl con Manubrio alla Scott', 3, '8-10', 60, 0, {}, ['9x10,9x10,9x8', R(3, '9x10')]],
  ]);
  day('Allenamento 4', '3 min ellittica · Extra-rotazioni × 12 · Flesso estensioni dei polsi e gomiti × 15 · Prone Y raise × 10 · 1 serie di avvicinamento', [
    ['Cable Pull-Through', 3, '12-15', 60, 1, {}, ['18x14,18x13,18x1']],
    ['Abductor Machine', 3, '15-20', 60, 0, { note: 'con busto in avanti' }, [R(3, '30x15')]],
    ['Alzate Laterali al Multi-Flight', 4, '12-15', 60, 0, { tech: 'Drop Set' }, ['15x15,15x13,15x10,15x13+10x2']],
    ['Incline Dumbbell Curl', 3, '10-12', 60, 1, {}, ['8x11,8x11,8x9']],
    ['Spider Curl con Bilanciere EZ', 3, '10-12', 60, 0, {}, [R(3, '2.5x11')]],
    ['Pushdown Singolo Presa Inversa', 4, '12-15', 45, 0, {}, [R(4, '10.25x14')]],
    ['Hanging Knee Rise', 3, '10-12', 60, 0, {}, []],
  ]);
  return p;
}
