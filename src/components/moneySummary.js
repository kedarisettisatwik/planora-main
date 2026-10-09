// Store amounts as integer paise so repeated additions stay exact.
export function amountToPaise(value) {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
    const [rupees, paise = ''] = value.split('.');
    const amount = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function monthlySummary(transactions, month) {
    const records = transactions.filter(item => item.date?.slice(0, 7) === month);
    const income = records.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amountPaise, 0);
    const deductions = records.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amountPaise, 0);
    return { records, income, deductions, savings: income - deductions };
}
