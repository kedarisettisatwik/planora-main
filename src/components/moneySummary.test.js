import { amountToPaise, monthlySummary } from './moneySummary';

test('amounts keep two decimal places without rounding invalid input', () => {
    expect(amountToPaise('12.34')).toBe(1234);
    expect(amountToPaise('0.01')).toBe(1);
    for (const value of ['0', '-1', '1.234', 'abc', 'Infinity']) {
        expect(amountToPaise(value)).toBeNull();
    }
});

test('monthly totals exclude transactions in other months', () => {
    const transactions = [
        { date: '2026-10-01', type: 'income', amountPaise: 100000 },
        { date: '2026-10-09', type: 'expense', amountPaise: 12345 },
        { date: '2026-09-30', type: 'income', amountPaise: 200000 },
    ];
    const summary = monthlySummary(transactions, '2026-10');
    expect(summary.income).toBe(100000);
    expect(summary.deductions).toBe(12345);
    expect(summary.savings).toBe(87655);
    expect(summary.records).toHaveLength(2);
    expect(monthlySummary(transactions, '2026-11').savings).toBe(0);
});

test('savings can be negative when expenses exceed income', () => {
    expect(monthlySummary([{ date: '2026-10-01', type: 'expense', amountPaise: 100 }], '2026-10').savings).toBe(-100);
});
