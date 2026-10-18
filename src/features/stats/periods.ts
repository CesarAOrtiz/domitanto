import type { Period } from '../../domain';

export type PeriodUnit = 'month' | 'quarter' | 'year';

export interface CalendarPeriod extends Period {
  label: string;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const SPAN: Record<PeriodUnit, number> = { month: 1, quarter: 3, year: 12 };

/**
 * Mes, trimestre o año de calendario en la hora local del teléfono. `offset` 0 es el actual,
 * -1 el anterior. Dos periodos de la misma unidad con distinto `offset` nunca se cruzan.
 */
export function calendarPeriod(unit: PeriodUnit, offset: number, now = Date.now()): CalendarPeriod {
  const today = new Date(now);
  const span = SPAN[unit];
  const firstMonth = Math.floor(today.getMonth() / span) * span + offset * span;
  const start = new Date(today.getFullYear(), firstMonth, 1);
  const end = new Date(today.getFullYear(), firstMonth + span, 1);
  const year = start.getFullYear();
  const label =
    unit === 'year'
      ? String(year)
      : unit === 'month'
        ? `${MONTHS_LONG[start.getMonth()]} ${year}`
        : `${MONTHS[start.getMonth()]}–${MONTHS[(start.getMonth() + 2) % 12]} ${year}`;
  return { from: start.getTime(), to: end.getTime(), label };
}

/** Zona horaria con que se cortan los días, para mostrarla junto a la comparación. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'hora local';
  } catch {
    return 'hora local';
  }
}
