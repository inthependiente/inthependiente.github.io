import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bannerCopy,
  computePlan,
  elapsedMinutes,
  formatClock,
  parseCompletion,
  parseTimeOfDay,
  statusText,
  statusTone,
  toMinutes,
  zonedToInstant,
  type Plan,
  type RowInput,
} from './index';

const TZ = 'America/Santiago';
const FECHA = '2026-11-10';

function at(hour: number, minute: number, second = 0, day = 10, month = 11, year = 2026): number {
  return zonedToInstant({ year, month, day, hour, minute, second }, TZ);
}

function rows(
  durations: number[],
  completions: (string | null)[] = [],
  completedFlags?: boolean[],
): RowInput[] {
  return durations.map((duration, index) => ({
    id: index + 1,
    order: index + 1,
    plannedDurationMinutes: duration,
    isCompleted: completedFlags?.[index] ?? completions[index] != null,
    completedAt: completions[index] ?? null,
  }));
}

function plan(
  durations: number[],
  completions: (string | null)[],
  now: number,
  options: {
    callTime?: string;
    date?: string;
    flags?: boolean[];
    orders?: number[];
  } = {},
): Plan {
  const inputs = rows(durations, completions, options.flags);
  if (options.orders) inputs.forEach((row, index) => (row.order = options.orders![index]));

  return computePlan({
    rows: inputs,
    date: options.date ?? FECHA,
    callTime: options.callTime ?? '08:00',
    timeZone: TZ,
    now,
  });
}

const minutes = (value: number | null) => toMinutes(value);

/* ───────────────────── §11.1 Estado y desvío ───────────────────── */

test('1. sin filas → noPlan', () => {
  const p = plan([], [], at(8, 0));
  assert.equal(p.status.situation, 'noPlan');
  assert.equal(p.status.deviation, null);
  assert.equal(statusText(p.status), 'SIN PLANOS CARGADOS');
});

test('2. toma anterior cerrada 08:40, ahora 09:10 → +10', () => {
  const p = plan([30, 45, 15, 60], ['08:40'], at(9, 10));
  assert.equal(p.status.situation, 'inProgress');
  assert.equal(minutes(p.status.deviation), 10);
  assert.equal(statusText(p.status), '10 MINUTOS ATRASADO');
});

test('3. el mismo caso a las 11:00 → +105', () => {
  const p = plan([30, 45, 15, 60], ['08:40'], at(11, 0));
  assert.equal(minutes(p.status.deviation), 105);
  assert.equal(statusText(p.status), '105 MINUTOS ATRASADO');
});

test('4. todo según plan → 0', () => {
  const p = plan([30, 45], ['08:30'], at(9, 0));
  assert.equal(minutes(p.status.deviation), 0);
  assert.equal(statusText(p.status), 'RODAJE A TIEMPO');
});

test('5. antes del llamado → notStarted', () => {
  const p = plan([30], [], at(7, 30));
  assert.equal(p.status.situation, 'notStarted');
  assert.equal(p.status.minutesUntilStart, 30);
  assert.equal(statusText(p.status), 'INICIA EN 30 MINUTOS');
});

test('6. llamado exacto sin cierres → inProgress a tiempo', () => {
  const p = plan([30], [], at(8, 0));
  assert.equal(p.status.situation, 'inProgress');
  assert.equal(minutes(p.status.deviation), 0);
  assert.equal(statusText(p.status), 'RODAJE A TIEMPO');
});

test('7. sin progreso y fuera de la ventana → +30', () => {
  const p = plan([30], [], at(9, 0));
  assert.equal(minutes(p.status.deviation), 30);
  assert.equal(statusText(p.status), '30 MINUTOS ATRASADO');
});

test('8. terminado adelantado → −15', () => {
  const p = plan([30, 45, 15], ['08:20', '09:15', '09:15'], at(12, 0));
  assert.equal(p.status.situation, 'finished');
  assert.equal(minutes(p.status.deviation), -15);
  assert.equal(statusText(p.status), 'FINALIZADO: 15 MINUTOS ADELANTADO');
});

test('9. terminado a tiempo → 0', () => {
  const p = plan([30, 45, 15], ['08:20', '09:15', '09:30'], at(12, 0));
  assert.equal(minutes(p.status.deviation), 0);
  assert.equal(statusText(p.status), 'FINALIZADO A TIEMPO');
});

test('10. terminado atrasado → +30', () => {
  const p = plan([30, 45, 15], ['08:20', '09:15', '10:00'], at(12, 0));
  assert.equal(minutes(p.status.deviation), 30);
  assert.equal(statusText(p.status), 'FINALIZADO: 30 MINUTOS ATRASADO');
});

test('11. terminado sin cierres → finishedWithoutCompletion', () => {
  const p = plan([30, 30], [null, null], at(12, 0), { flags: [true, true] });
  assert.equal(p.status.situation, 'finishedWithoutCompletion');
  assert.equal(statusText(p.status), 'FINALIZADO SIN HORA DE CIERRE');
});

test('12. rodaje nocturno que cruza medianoche', () => {
  const p = plan([90, 60], ['23:30'], at(0, 15, 0, 11), { callTime: '22:00' });
  assert.equal(p.status.situation, 'inProgress');
  assert.equal(minutes(p.status.deviation), 0);
  assert.equal(statusText(p.status), 'RODAJE A TIEMPO');
});

test('13. tolerancia de 2 minutos', () => {
  const p = plan([30, 30], ['08:31'], at(9, 0));
  assert.equal(minutes(p.status.deviation), 1);
  assert.equal(p.status.isOnTime, true);
  assert.equal(statusText(p.status), 'RODAJE A TIEMPO');
});

test('14. día futuro → scheduled', () => {
  const p = plan([30], [], at(9, 0), { date: '2026-11-12' });
  assert.equal(p.status.situation, 'scheduled');
  assert.equal(statusText(p.status), 'PROGRAMADO PARA 12/11');
});

test('15. día pasado sin cierres → concludedDay', () => {
  const p = plan([30], [], at(9, 0), { date: '2026-11-08' });
  assert.equal(p.status.situation, 'concludedDay');
  assert.equal(statusText(p.status), 'CONCLUIDO: 08/11');
});

/* ───────────────────── §11.2 Proyección ───────────────────── */

function projected(p: Plan, index: number): string {
  const row = p.rows[index];
  return `${formatClock(row.projectedStart, p.timeZone)}–${formatClock(row.projectedEnd, p.timeZone)}`;
}

test('P1. activa 2 estimada 08:40–09:25, siguiente 09:25–09:40', () => {
  const p = plan([30, 45, 15, 60], ['08:40'], at(9, 10));
  assert.equal(p.rows[1].isActive, true);
  assert.equal(projected(p, 1), '08:40–09:25');
  assert.equal(projected(p, 2), '09:25–09:40');
});

test('P2. activa 2 con el reloj adelantado termina en "ahora"', () => {
  const p = plan([30, 45, 15, 60], ['08:40'], at(11, 0));
  assert.equal(projected(p, 1), '08:40–11:00');
  assert.equal(projected(p, 2), '11:00–11:15');
});

test('P3. sin cierres, la primera toma es la activa', () => {
  const p = plan([30, 45, 15, 60], [], at(8, 10));
  assert.equal(p.rows[0].isActive, true);
  assert.equal(projected(p, 0), '08:00–08:30');
  assert.equal(projected(p, 1), '08:30–09:15');
});

test('P4. el ancla es el cierre anterior', () => {
  const p = plan([30, 45, 15, 60], ['09:00'], at(9, 10));
  assert.equal(projected(p, 1), '09:00–09:45');
  assert.equal(projected(p, 2), '09:45–10:00');
});

/* ───────────────────── §11.3 Presentación ───────────────────── */

test('F1/F2. formatClock redondea al minuto más cercano', () => {
  assert.equal(formatClock(at(8, 12, 54), TZ), '08:13');
  assert.equal(formatClock(at(8, 43, 36), TZ), '08:44');
});

test('F3/F4/F5. toMinutes redondea alejándose de cero', () => {
  assert.equal(toMinutes(90_000), 2);
  assert.equal(toMinutes(-90_000), -2);
  assert.equal(toMinutes(89_999), 1);
});

test('F6/F7/F8. parseo estricto de horas', () => {
  assert.deepEqual(parseTimeOfDay('8:5'), { hour: 8, minute: 5, second: 0 });
  assert.equal(parseTimeOfDay('25:00'), null);
  assert.equal(parseTimeOfDay('2026-11-10T14:30:00'), null);
});

test('F9. cierre con hora suelta después de medianoche', () => {
  const calledAt = at(22, 0);
  const completion = parseCompletion('00:45', calledAt, TZ);
  assert.notEqual(completion, null);
  assert.equal(toMinutes(completion! - calledAt), 165);
});

/* ───────────────────── §8.7 Toma activa ───────────────────── */

test('el tiempo transcurrido se mide desde el ancla', () => {
  const p = plan([30, 45], ['08:40'], at(9, 10));
  assert.equal(elapsedMinutes(p, at(9, 10)), 30);
});

/* ───────────────────── Banner "En vivo" ───────────────────── */

test('el banner usa la forma pedida por producción', () => {
  const atrasado = plan([30, 45, 15, 60], ['08:40'], at(9, 10));
  assert.deepEqual(bannerCopy(atrasado.status), {
    eyebrow: 'AL INICIAR EL PLANO ACTUAL VAMOS:',
    headline: '10 MINUTOS ATRASADOS',
  });
  assert.equal(statusTone(atrasado.status), 'danger');

  const aTiempo = plan([30, 45], ['08:30'], at(9, 0));
  assert.equal(bannerCopy(aTiempo.status).headline, 'A TIEMPO');
  assert.equal(statusTone(aTiempo.status), 'info');

  const adelantado = plan([30, 45], ['08:10'], at(8, 40));
  assert.equal(bannerCopy(adelantado.status).headline, '20 MINUTOS ADELANTADOS');
  assert.equal(statusTone(adelantado.status), 'success');
});

test('el banner singulariza un minuto', () => {
  const p = computePlan({
    rows: rows([30, 30], ['08:31']),
    date: FECHA,
    callTime: '08:00',
    timeZone: TZ,
    now: at(9, 0),
    toleranceMinutes: 0,
  });
  assert.equal(bannerCopy(p.status).headline, '1 MINUTO ATRASADO');
});

/* ───────────────────── §11.4 Avisos ───────────────────── */

test('W1. hora de llamado inválida → defaultCalledTime', () => {
  const p = plan([30], [], at(8, 0), { callTime: '25:99' });
  assert.ok(p.warnings.includes('defaultCalledTime'));
});

test('W2. duración cero es válida y no avisa', () => {
  const p = plan([0], [], at(8, 0));
  assert.deepEqual(p.warnings, []);
});

test('W3. órdenes duplicados → duplicateOrder', () => {
  const p = plan([30, 45, 15], [], at(8, 0), { orders: [1, 1, 2] });
  assert.ok(p.warnings.includes('duplicateOrder'));
});

test('W4. terminada → pendiente → terminada → pendingBeforeCompleted', () => {
  const p = plan([30, 45, 15], ['08:20', null, '09:30'], at(10, 0), {
    flags: [true, false, true],
  });
  assert.ok(p.warnings.includes('pendingBeforeCompleted'));
});

test('W5. cierre ilegible → unreadableCompletion', () => {
  const p = plan([30], ['abc'], at(9, 0), { flags: [true] });
  assert.ok(p.warnings.includes('unreadableCompletion'));
});

test('W6. cierre anterior al llamado − 6 h → completionBeforeCalled', () => {
  const p = plan([30], ['2026-11-10T00:00:00-03:00'], at(9, 0));
  assert.ok(p.warnings.includes('completionBeforeCalled'));
});

test('W7. cierre futuro → completionInFuture', () => {
  const p = plan([30], ['09:30'], at(9, 0), { flags: [true] });
  assert.ok(p.warnings.includes('completionInFuture'));
});
