import type { DayOfWeek, ScheduleSlot } from '$lib/types/schedule';

const DAYS: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** ¿El instante cae dentro de alguna franja del horario semanal? `span` = minutos que deben caber. */
export function isWithinSchedule(slots: ScheduleSlot[], at: Date, span = 0): boolean {
  const day = DAYS[at.getDay()];
  const minutes = at.getHours() * 60 + at.getMinutes();
  return slots.some(
    (s) =>
      s.dayOfWeek === day && minutes >= toMinutes(s.startTime) && minutes + span <= toMinutes(s.endTime)
  );
}
