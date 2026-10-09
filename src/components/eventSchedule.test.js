import { occursOn, localDate, occurrenceTime } from './eventSchedule';

test('time overrides change only the selected occurrence', () => {
    const event = { allDay: false, startTime: '09:00', endTime: '10:00', timeOverrides: {
        '2026-10-09': { allDay: false, startTime: '14:00', endTime: '15:00' },
        '2026-10-10': { allDay: true, startTime: '', endTime: '' },
    } };
    expect(occurrenceTime(event, '2026-10-09').startTime).toBe('14:00');
    expect(occurrenceTime(event, '2026-10-10').allDay).toBe(true);
    expect(occurrenceTime(event, '2026-10-11')).toEqual({ allDay: false, startTime: '09:00', endTime: '10:00' });
    expect(event.startTime).toBe('09:00');
});

test('one-time and daily events respect their start date', () => {
    const event = { date: '2026-10-09', repeat: 'none' };
    expect(occursOn(event, '2026-10-09')).toBe(true);
    expect(occursOn(event, '2026-10-10')).toBe(false);
    expect(occursOn({ ...event, repeat: 'daily' }, '2026-10-08')).toBe(false);
    expect(occursOn({ ...event, repeat: 'daily' }, '2026-10-10')).toBe(true);
});

test('weekly events match selected weekdays across month boundaries', () => {
    const event = { date: '2026-10-09', repeat: 'weekly', weekdays: [5] };
    expect(occursOn(event, '2026-10-09')).toBe(true);
    expect(occursOn(event, '2026-10-10')).toBe(false);
    expect(occursOn(event, '2026-11-06')).toBe(true);
    expect(occursOn(event, '2026-10-02')).toBe(false);
});

test('particular dates match only explicit calendar dates', () => {
    const event = { date: '2026-10-09', repeat: 'dates', dates: ['2026-10-12', '2026-11-12'] };
    expect(occursOn(event, '2026-10-09')).toBe(false);
    expect(occursOn(event, '2026-10-12')).toBe(true);
    expect(occursOn(event, '2026-11-12')).toBe(true);
    expect(occursOn(event, '2026-12-12')).toBe(false);
});

test('local date uses local calendar fields', () => {
    expect(localDate(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09');
});
