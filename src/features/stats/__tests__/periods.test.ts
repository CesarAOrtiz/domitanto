import { periodProblem } from '../../../domain';
import { calendarPeriod } from '../periods';

const NOW = new Date(2026, 9, 18, 15, 0).getTime();

test('mes actual y anterior, contiguos y sin cruce', () => {
  const current = calendarPeriod('month', 0, NOW);
  const previous = calendarPeriod('month', -1, NOW);
  expect(current.label).toBe('octubre 2026');
  expect(previous.label).toBe('septiembre 2026');
  expect(previous.to).toBe(current.from);
  expect(periodProblem(previous, current)).toBeNull();
});

test('trimestre y año, cruzando el cambio de año', () => {
  expect(calendarPeriod('quarter', 0, NOW).label).toBe('oct–dic 2026');
  expect(calendarPeriod('quarter', -4, NOW).label).toBe('oct–dic 2025');
  expect(calendarPeriod('month', -10, NOW).label).toBe('diciembre 2025');
  expect(calendarPeriod('year', -1, NOW)).toMatchObject({
    label: '2025',
    from: new Date(2025, 0, 1).getTime(),
    to: new Date(2026, 0, 1).getTime(),
  });
});
