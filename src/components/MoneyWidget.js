import { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { localDate } from './eventSchedule';
import { amountToPaise, monthlySummary } from './moneySummary';
import '../Styles/Money.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const money = paise => currency.format(paise / 100);
const emptyCategory = () => ({ type: 'income', name: '', emoji: '' });

export default function MoneyWidget({ email }) {
    const [month, setMonth] = useState(() => localDate().slice(0, 7));
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [ready, setReady] = useState({ transactions: false, categories: false });
    const [loadError, setLoadError] = useState(false);
    const [setup, setSetup] = useState(false);
    const [form, setForm] = useState(null);
    const [categoryForm, setCategoryForm] = useState(emptyCategory);
    const [saving, setSaving] = useState(false);
    const dialogRef = useRef(null);
    const triggerRef = useRef(null);
    const modalOpen = setup || !!form;

    useEffect(() => {
        setTransactions([]); setCategories([]); setForm(null); setSetup(false);
        setLoadError(false); setReady({ transactions: false, categories: false });
        if (!email) return;
        const subscribe = (name, setter, key) => onSnapshot(collection(db, email, 'Money', name), snapshot => {
            setter(snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
            setReady(previous => ({ ...previous, [key]: true }));
        }, () => { setLoadError(true); toast.error('Unable to load money data. Please reopen Money to try again.'); });
        const stopTransactions = subscribe('Transactions', setTransactions, 'transactions');
        const stopCategories = subscribe('Categories', setCategories, 'categories');
        return () => { stopTransactions(); stopCategories(); };
    }, [email]);

    useEffect(() => {
        if (!modalOpen) return;
        const previousFocus = triggerRef.current || document.activeElement;
        const dialog = dialogRef.current;
        dialog?.querySelector('button, input, select')?.focus();
        const onKey = event => {
            if (event.key === 'Escape' && !saving) { setSetup(false); setForm(null); }
            if (event.key !== 'Tab') return;
            const elements = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
    }, [modalOpen, saving]);

    const loaded = ready.transactions && ready.categories && !loadError;
    const summary = monthlySummary(transactions, month);
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    const availableCategories = sortedCategories.filter(item => item.type === form?.type);
    const openTransaction = (event, transaction) => {
        triggerRef.current = event.currentTarget;
        setForm(transaction ? { ...transaction, amount: (transaction.amountPaise / 100).toFixed(2) } : {
            type: 'income', amount: '', categoryId: '', note: '', date: month === localDate().slice(0, 7) ? localDate() : `${month}-01`,
        });
    };
    const updateForm = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
    const saveCategory = async event => {
        event.preventDefault();
        if (!email || saving || !loaded) return;
        const name = categoryForm.name.trim();
        if (!name) return toast.error('Enter a category name.');
        if (categories.some(item => item.type === categoryForm.type && item.name.toLowerCase() === name.toLowerCase())) return toast.error('This category already exists.');
        setSaving(true);
        try {
            const id = uuidv4();
            await setDoc(doc(db, email, 'Money', 'Categories', id), { id, type: categoryForm.type, name, emoji: categoryForm.emoji.trim() });
            setCategoryForm(previous => ({ ...previous, name: '', emoji: '' }));
            toast.success('Category added.');
        } catch { toast.error('Unable to save category.'); }
        finally { setSaving(false); }
    };
    const saveTransaction = async event => {
        event.preventDefault();
        if (!email || saving || !loaded) return;
        const amountPaise = amountToPaise(form.amount);
        if (amountPaise === null) return toast.error('Enter a positive amount with up to two decimal places.');
        const category = categories.find(item => item.id === form.categoryId && item.type === form.type);
        if (!category || !form.date) return toast.error('Select a category and date.');
        setSaving(true);
        try {
            const id = form.id || uuidv4();
            await setDoc(doc(db, email, 'Money', 'Transactions', id), {
                id, type: form.type, amountPaise, categoryId: category.id, categoryName: category.name,
                categoryEmoji: category.emoji, date: form.date, note: form.note.trim(),
            });
            setMonth(form.date.slice(0, 7)); setForm(null);
            toast.success('Transaction saved.');
        } catch { toast.error('Unable to save transaction.'); }
        finally { setSaving(false); }
    };
    const removeTransaction = async () => {
        if (saving || !window.confirm('Delete this transaction?')) return;
        setSaving(true);
        try { await deleteDoc(doc(db, email, 'Money', 'Transactions', form.id)); setForm(null); toast.success('Transaction deleted.'); }
        catch { toast.error('Unable to delete transaction.'); }
        finally { setSaving(false); }
    };

    return <section className="defaultWidgetDiv MoneyMain">
        <div className="moneyToolbar"><label>Month<input type="month" value={month} onChange={event => event.target.value && setMonth(event.target.value)} /></label><button disabled={!loaded} onClick={event => { triggerRef.current = event.currentTarget; setCategoryForm(emptyCategory()); setSetup(true); }}>Set up</button></div>
        <div className="moneyTotals" aria-live="polite">
            <div><small>Total income</small><strong>{loaded ? money(summary.income) : '—'}</strong></div>
            <div><small>Total savings</small><strong className={summary.savings < 0 ? 'moneyNegative' : ''}>{loaded ? money(summary.savings) : '—'}</strong></div>
            <div><small>Deductions</small><strong>{loaded ? money(summary.deductions) : '—'}</strong></div>
        </div>
        <h3 style={{ "marginTop":"10px"}}>Transactions</h3>
        <div className="moneyTransactions" aria-live="polite">
            {loadError ? <p>Unable to load money data. Please reopen Money to try again.</p> : !loaded ? <p>Loading…</p> : !summary.records.length && <p>No transactions for this month.</p>}
            {[...summary.records].sort((a, b) => b.date.localeCompare(a.date)).map(item => <button key={item.id} className="moneyTransaction" onClick={event => openTransaction(event, item)} aria-label={`Edit ${item.categoryName}, ${money(item.amountPaise)}, ${item.date}`}>
                <span className="moneyEmoji" aria-hidden="true">{item.categoryEmoji || (item.type === 'income' ? '💰' : '🧾')}</span>
                <span className="moneyTransactionDetail"><strong>{item.categoryName}</strong><small>{item.date} · {item.type === 'income' ? 'Income' : 'Expense'}</small>{item.note && <span>{item.note}</span>}</span>
                <strong className={item.type === 'income' ? 'moneyPositive' : 'moneyNegative'}>{item.type === 'income' ? '+' : '−'}{money(item.amountPaise)}</strong>
            </button>)}
        </div>
        <button className="moneyPrimary moneyAdd" disabled={!loaded} onClick={event => openTransaction(event)}>Add +</button>
        {modalOpen && <div className="moneyBackdrop" onClick={() => { if (!saving) { setSetup(false); setForm(null); } }}><div ref={dialogRef} className="moneyModal" role="dialog" aria-modal="true" aria-labelledby="moneyDialogTitle" onClick={event => event.stopPropagation()}>
            <div className="moneyToolbar"><h3 id="moneyDialogTitle">{setup ? 'Set up categories' : form.id ? 'Edit transaction' : 'Add transaction'}</h3><button disabled={saving} onClick={() => { setSetup(false); setForm(null); }} aria-label="Close">×</button></div>
            {setup ? <>
                <form onSubmit={saveCategory}>
                    <label>Category type<select value={categoryForm.type} onChange={event => setCategoryForm(previous => ({ ...previous, type: event.target.value }))}><option value="income">Income</option><option value="expense">Expense</option></select></label>
                    <label>Category name<input required maxLength={80} placeholder={categoryForm.type === 'income' ? 'Salary, rent…' : 'Food, electricity bill…'} value={categoryForm.name} onChange={event => setCategoryForm(previous => ({ ...previous, name: event.target.value }))} /></label>
                    <label>Emoji<input maxLength={20} placeholder="💰" value={categoryForm.emoji} onChange={event => setCategoryForm(previous => ({ ...previous, emoji: event.target.value }))} /></label>
                    <button type="submit" className="moneyPrimary" disabled={saving}>{saving ? 'Saving…' : 'Add category'}</button>
                </form>
                {['income', 'expense'].map(type => <div className="moneyCategoryGroup" key={type}><h3>{type === 'income' ? 'Income' : 'Expense'}</h3>{sortedCategories.filter(item => item.type === type).length ? <ul>{sortedCategories.filter(item => item.type === type).map(item => <li key={item.id}>{item.emoji} {item.name}</li>)}</ul> : <p>No categories yet.</p>}</div>)}
            </> : <form onSubmit={saveTransaction}>
                <div className="moneyTypeSwitch">{['income', 'expense'].map(type => <button key={type} type="button" aria-pressed={form.type === type} className={form.type === type ? 'moneyPrimary' : ''} onClick={() => setForm(previous => ({ ...previous, type, categoryId: '' }))}>{type === 'income' ? 'Income' : 'Expense'}</button>)}</div>
                <label>Amount (₹)<input type="number" min="0.01" step="0.01" inputMode="decimal" required value={form.amount} onChange={event => updateForm('amount', event.target.value)} /></label>
                <label>Category<select required value={form.categoryId} onChange={event => updateForm('categoryId', event.target.value)}><option value="">Select category</option>{availableCategories.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label>
                {!availableCategories.length && <p className="moneyHint">Create an {form.type} category in Set up first. <button type="button" onClick={() => { setForm(null); setCategoryForm({ ...emptyCategory(), type: form.type }); setSetup(true); }}>Set up categories</button></p>}
                <label>Date<input type="date" required value={form.date} onChange={event => updateForm('date', event.target.value)} /></label>
                <label>Note (optional)<textarea maxLength={1000} value={form.note} onChange={event => updateForm('note', event.target.value)} /></label>
                <div className="moneyToolbar">{form.id && <button type="button" disabled={saving} onClick={removeTransaction}>Delete</button>}<button type="submit" className="moneyPrimary" disabled={saving || !availableCategories.length}>{saving ? 'Saving…' : 'Save transaction'}</button></div>
            </form>}
        </div></div>}
    </section>;
}
