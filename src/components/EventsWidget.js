import { useEffect, useState } from "react";
import {
    collection,
    doc,
    onSnapshot,
    setDoc,
    deleteDoc,
    updateDoc,
    FieldPath,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { db } from "../firebase";
import { localDate, occursOn, occurrenceTime } from "./eventSchedule";
import "../Styles/DailyGoals.css";
import "../Styles/Events.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REPEATS = [
    ["none", "Once"],
    ["daily", "Every day"],
    ["weekly", "Days of week"],
    ["dates", "Particular dates"],
];
const blankEvent = (date) => ({
    title: "",
    description: "",
    type: "reminder",
    date,
    repeat: "none",
    weekdays: [],
    dates: [],
    allDay: false,
    startTime: "",
    endTime: "",
});

export default function EventsWidget({ email }) {
    const [date, setDate] = useState(localDate);
    const [events, setEvents] = useState([]);
    const [form, setForm] = useState(null);
    const [extraDate, setExtraDate] = useState("");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [viewAll, setViewAll] = useState(false);
    const [instance, setInstance] = useState(null);
    useEffect(() => {
        setEvents([]);
        setForm(null);
        setInstance(null);
        setViewAll(false);
        if (!email) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(false);
        return onSnapshot(
            collection(db, email, "Events", "List"),
            (snapshot) => {
                setEvents(
                    snapshot.docs.map((item) => ({
                        ...item.data(),
                        id: item.id,
                    })),
                );
                setLoading(false);
            },
            () => {
                setLoading(false);
                setLoadError(true);
                toast.error("Unable to load events.");
            },
        );
    }, [email]);
    const update = (key, value) =>
        setForm((previous) => ({ ...previous, [key]: value }));
    const open = (event) => {
        setInstance(null);
        setForm(event || blankEvent(date));
        setExtraDate("");
    };
    const openInstance = (event) => {
        setInstance({
            id: event.id,
            title: event.title,
            type: event.type,
            date,
            ...occurrenceTime(event, date),
        });
    };
    const saveInstance = async (e) => {
        e.preventDefault();
        if (!email || saving) return;
        if (
            !instance.allDay &&
            (!instance.startTime ||
                (instance.type === "meeting" &&
                    (!instance.endTime ||
                        instance.endTime <= instance.startTime)))
        ) {
            return toast.error(
                instance.type === "meeting"
                    ? "Choose an end time after the start time."
                    : "Choose a reminder time.",
            );
        }
        setSaving(true);
        try {
            await updateDoc(
                doc(db, email, "Events", "List", instance.id),
                new FieldPath("timeOverrides", instance.date),
                {
                    allDay: instance.allDay,
                    startTime: instance.allDay ? "" : instance.startTime,
                    endTime:
                        instance.allDay || instance.type !== "meeting"
                            ? ""
                            : instance.endTime,
                },
            );
            setInstance(null);
            toast.success("Time updated for this date only.");
        } catch {
            toast.error("Unable to update this occurrence.");
        } finally {
            setSaving(false);
        }
    };
    const save = async (e) => {
        e.preventDefault();
        if (!email || saving) return;
        if (!form.title.trim() || !form.date)
            return toast.error("Enter a title and date.");
        if (form.repeat === "weekly" && !form.weekdays.length)
            return toast.error("Select at least one weekday.");
        if (form.repeat === "dates" && !form.dates.length)
            return toast.error("Add at least one date.");
        if (
            form.repeat === "dates" &&
            form.dates.some((day) => day < form.date)
        )
            return toast.error(
                "Selected dates must be on or after the start date.",
            );
        if (
            form.type === "meeting" &&
            !form.allDay &&
            (!form.startTime || !form.endTime || form.endTime <= form.startTime)
        )
            return toast.error("Choose an end time after the start time.");
        setSaving(true);
        try {
            const id = form.id || uuidv4();
            await setDoc(doc(db, email, "Events", "List", id), {
                ...form,
                id,
                title: form.title.trim(),
                description: form.description.trim(),
                weekdays: form.repeat === "weekly" ? form.weekdays : [],
                dates: form.repeat === "dates" ? [...form.dates].sort() : [],
                allDay: form.type === "meeting" && form.allDay,
                startTime:
                    form.type === "meeting" && !form.allDay
                        ? form.startTime
                        : "",
                endTime:
                    form.type === "meeting" && !form.allDay ? form.endTime : "",
            });
            setForm(null);
            toast.success("Event saved.");
        } catch {
            toast.error("Unable to save event. Please try again.");
        } finally {
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!window.confirm(`Delete "${form.title}" and all its occurrences?`))
            return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, email, "Events", "List", form.id));
            setForm(null);
        } catch {
            toast.error("Unable to delete event.");
        } finally {
            setSaving(false);
        }
    };
    const visible = events
        .filter((event) => occursOn(event, date))
        .map((event) => ({ ...event, ...occurrenceTime(event, date) }))
        .sort(
            (a, b) =>
                (a.startTime || "").localeCompare(b.startTime || "") ||
                a.title.localeCompare(b.title),
        );
    return (
        <div
            className={`defaultWidgetDiv DailyGoalsMain mobile EventsMain ${form || instance ? "add" : ""}`}
        >
            <div className="eventsToolbar">
                <label className="eventsDate">
                    <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) =>
                            e.target.value && setDate(e.target.value)
                        }
                    />
                </label>
                <button onClick={() => setViewAll(true)}>View All</button>
            </div>
            <div className="GoalsAsOfDate eventsList" aria-live="polite">
                {loading ? (
                    <p>Loading events…</p>
                ) : loadError ? (
                    <p>
                        Unable to load events. Please reopen Events to try
                        again.
                    </p>
                ) : (
                    !visible.length && (
                        <p>No meetings or reminders for this date.</p>
                    )
                )}
                {visible.map((event) => (
                    <button
                        key={event.id}
                        className="goalListItem eventCard"
                        onClick={() => openInstance(event)}
                    >
                        <small>
                            {event.type === "meeting" ? "Meeting" : "Reminder"}
                            {event.repeat !== "none" ? " · Repeats" : ""}
                        </small>
                        <strong>{event.title}</strong>
                        {event.description && <p>{event.description}</p>}
                        {event.type === "meeting" && (
                            <small>
                                {event.allDay
                                    ? "Full day"
                                    : `${event.startTime} – ${event.endTime}`}
                            </small>
                        )}
                        {event.type === "reminder" && event.startTime && (
                            <small>{event.startTime}</small>
                        )}
                    </button>
                ))}
            </div>
            {!form && !instance && !viewAll && (
                <button
                    className="eventPrimary eventAddButton"
                    onClick={() => open()}
                    style={{ "marginTop":"10px"}}
                >
                    Add Event +
                </button>
            )}
            {viewAll && !form && !instance && (
                <div className="eventsAllPanel">
                    <div className="eventsToolbar">
                        <button onClick={() => setViewAll(false)}>
                            ‹ Back
                        </button>
                        <h3>All Events</h3>
                    </div>
                    <p>
                        Manage all meetings and reminders, including repeating
                        events.
                    </p>
                    {loading ? (
                        <p>Loading events…</p>
                    ) : loadError ? (
                        <p>Unable to load events.</p>
                    ) : (
                        !events.length && <p>No events yet.</p>
                    )}
                    {[...events]
                        .sort(
                            (a, b) =>
                                a.date.localeCompare(b.date) ||
                                a.title.localeCompare(b.title),
                        )
                        .map((event) => (
                            <div
                                className="goalListItem eventCard"
                                key={event.id}
                            >
                                <small>
                                    {event.type === "meeting"
                                        ? "Meeting"
                                        : "Reminder"}{" "}
                                    ·{" "}
                                    {REPEATS.find(
                                        ([value]) => value === event.repeat,
                                    )?.[1] || "Once"}
                                </small>
                                <strong>{event.title}</strong>
                                {event.description && (
                                    <p>{event.description}</p>
                                )}
                                <small>
                                    {event.date}
                                    {event.repeat === "weekly"
                                        ? ` · ${(event.weekdays || []).map((day) => DAYS[day]).join(", ")}`
                                        : ""}
                                    {event.repeat === "dates"
                                        ? ` · ${(event.dates || []).join(", ")}`
                                        : ""}
                                </small>
                                {event.type === "meeting" && (
                                    <small>
                                        {event.allDay
                                            ? "Full day"
                                            : `${event.startTime} – ${event.endTime}`}
                                    </small>
                                )}
                                <button onClick={() => open(event)}>
                                    Edit / Delete
                                </button>
                            </div>
                        ))}
                </div>
            )}
            {instance && (
                <form className="addNewGoal eventForm" onSubmit={saveInstance}>
                    <div className="eventsToolbar">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setInstance(null)}
                        >
                            ‹ Back
                        </button>
                        <h3>Change time</h3>
                    </div>
                    <strong>{instance.title}</strong>
                    <p>{instance.date} · This occurrence only</p>
                    <fieldset>
                        <legend>
                            {instance.type === "meeting"
                                ? "Meeting time"
                                : "Reminder time"}
                        </legend>
                        <label className="eventCheckbox">
                            <input
                                type="checkbox"
                                checked={instance.allDay}
                                onChange={(e) =>
                                    setInstance((previous) => ({
                                        ...previous,
                                        allDay: e.target.checked,
                                    }))
                                }
                            />
                            Full day
                        </label>
                        {!instance.allDay && (
                            <div className="eventTimes">
                                <label>
                                    {instance.type === "meeting"
                                        ? "Start time"
                                        : "Time"}
                                    <input
                                        type="time"
                                        required
                                        value={instance.startTime}
                                        onChange={(e) =>
                                            setInstance((previous) => ({
                                                ...previous,
                                                startTime: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                {instance.type === "meeting" && (
                                    <label>
                                        End time
                                        <input
                                            type="time"
                                            required
                                            value={instance.endTime}
                                            onChange={(e) =>
                                                setInstance((previous) => ({
                                                    ...previous,
                                                    endTime: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                )}
                            </div>
                        )}
                    </fieldset>
                    <button
                        className="eventPrimary"
                        disabled={saving}
                        type="submit"
                    style={{ "marginTop":"10px"}}
                    >
                        {saving ? "Saving…" : "Save time for this date"}
                    </button>
                </form>
            )}
            {form && (
                <form className="addNewGoal eventForm" onSubmit={save}>
                    <div className="eventsToolbar">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setForm(null)}
                        >
                            ‹ Back
                        </button>
                        <h3>{form.id ? "Edit event" : "New event"}</h3>
                    </div>
                    {form.id && form.repeat !== "none" && (
                        <p style={{ fontSize: "10px", opacity: "0.5" }}>
                            Changes apply to every occurrence.
                        </p>
                    )}
                    <label>
                        Title
                        <input
                            required
                            value={form.title}
                            onChange={(e) => update("title", e.target.value)}
                        />
                    </label>
                    <label>
                        Description
                        <textarea
                            value={form.description}
                            onChange={(e) =>
                                update("description", e.target.value)
                            }
                        />
                    </label>
                    <label>
                        Event type
                        <select
                            value={form.type}
                            onChange={(e) => update("type", e.target.value)}
                        >
                            <option value="reminder">Reminder</option>
                            <option value="meeting">Meeting</option>
                        </select>
                    </label>
                    <label>
                        {form.repeat === "none" ? "Date" : "Starts from"}
                        <input
                            type="date"
                            required
                            value={form.date}
                            onChange={(e) => update("date", e.target.value)}
                        />
                    </label>
                    <div className="repeats">
                        <span className="repeatLabel">Repeats</span>
                        <div className="repeatSegment">
                            {REPEATS.map(([value, label]) => (
                                <button
                                    type="button"
                                    key={value}
                                    aria-pressed={form.repeat === value}
                                    className={`repeatSegBtn ${form.repeat === value ? "repeatSegBtnActive" : ""}`}
                                    onClick={() => update("repeat", value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {form.repeat === "weekly" && (
                            <div className="repeatSubPanel angWeekdays">
                                {DAYS.map((day, index) => (
                                    <button
                                        type="button"
                                        key={day}
                                        aria-pressed={form.weekdays.includes(
                                            index,
                                        )}
                                        className={`repeatDayDot ${form.weekdays.includes(index) ? "repeatDayDotActive" : ""}`}
                                        onClick={() =>
                                            update(
                                                "weekdays",
                                                form.weekdays.includes(index)
                                                    ? form.weekdays.filter(
                                                          (value) =>
                                                              value !== index,
                                                      )
                                                    : [...form.weekdays, index],
                                            )
                                        }
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        )}
                        {form.repeat === "dates" && (
                            <div className="repeatSubPanel">
                                <label>
                                    Add calendar date
                                    <input
                                        type="date"
                                        min={form.date}
                                        value={extraDate}
                                        onChange={(e) =>
                                            setExtraDate(e.target.value)
                                        }
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            extraDate &&
                                            extraDate >= form.date
                                        ) {
                                            update(
                                                "dates",
                                                [
                                                    ...new Set([
                                                        ...form.dates,
                                                        extraDate,
                                                    ]),
                                                ].sort(),
                                            );
                                            setExtraDate("");
                                        }
                                    }}
                                >
                                    Add date
                                </button>
                                <div className="eventDates">
                                    {form.dates.map((day) => (
                                        <button
                                            type="button"
                                            key={day}
                                            aria-label={`Remove ${day}`}
                                            onClick={() =>
                                                update(
                                                    "dates",
                                                    form.dates.filter(
                                                        (value) =>
                                                            value !== day,
                                                    ),
                                                )
                                            }
                                        >
                                            {day} ×
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {form.type === "meeting" && (
                        <fieldset>
                            <legend>Meeting time</legend>
                            <label className="eventCheckbox">
                                <input
                                    type="checkbox"
                                    checked={form.allDay}
                                    onChange={(e) =>
                                        update("allDay", e.target.checked)
                                    }
                                />
                                Full day
                            </label>
                            {!form.allDay && (
                                <div className="eventTimes">
                                    <label>
                                        Start time
                                        <input
                                            type="time"
                                            required
                                            value={form.startTime}
                                            onChange={(e) =>
                                                update(
                                                    "startTime",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        End time
                                        <input
                                            type="time"
                                            required
                                            value={form.endTime}
                                            onChange={(e) =>
                                                update(
                                                    "endTime",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                </div>
                            )}
                        </fieldset>
                    )}
                    <div className="eventsToolbar">
                        {form.id && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={remove}
                            >
                                Delete event
                            </button>
                        )}
                        <button
                            className="eventPrimary"
                            disabled={saving}
                            
                    style={{ "marginTop":"10px"}}
                            type="submit"
                        >
                            {saving ? "Saving…" : "Save event"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
