export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function occurrenceTime(event, date) {
    return {
        allDay: event.allDay || false,
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        ...event.timeOverrides?.[date],
    };
}

export function occursOn(event, date) {
    if (!event.date || date < event.date) return false;
    switch (event.repeat) {
        case 'daily': return true;
        case 'weekly': return (event.weekdays || []).includes(new Date(`${date}T12:00:00`).getDay());
        case 'dates': return (event.dates || []).includes(date);
        default: return event.date === date;
    }
}
