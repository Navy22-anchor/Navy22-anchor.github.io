import { useEffect, useRef, useState } from 'react';
import styles from './DateTime.module.css';

// Figma "Date and time - Collapsed" (iOS 26): 날짜·시간 알약 두 개. 지금 시각을 보여 주고 1분마다 갱신
// 날짜 알약을 누르면 Figma "Date and time - Pickers" (83:635) 달력이 아래에 펼쳐짐
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// 일요일부터 시작하는 주 단위 칸. 그 달이 아닌 칸은 null
function monthWeeks(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function Chevron({ direction }) {
  const d = { left: 'M7 1L1 7L7 13', right: 'M1 1L7 7L1 13' }[direction];
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Calendar({ now, selected, onSelect }) {
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() });
  const shift = (delta) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className={styles.calendar} role="dialog" aria-label="달력">
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.monthTitle}
          aria-label="오늘로 이동"
          onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}
        >
          {monthFormat.format(new Date(view.year, view.month, 1))}
          <span className={styles.accent}>
            <Chevron direction="right" />
          </span>
        </button>
        <div className={styles.arrows}>
          <button type="button" className={styles.accent} aria-label="이전 달" onClick={() => shift(-1)}>
            <Chevron direction="left" />
          </button>
          <button type="button" className={styles.accent} aria-label="다음 달" onClick={() => shift(1)}>
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className={styles.weeks}>
        {monthWeeks(view.year, view.month).map((week, w) => (
          <div key={w} className={styles.week}>
            {week.map((day, i) => {
              if (!day) return <span key={i} className={styles.day} />;
              const date = new Date(view.year, view.month, day);
              return (
                <button
                  key={i}
                  type="button"
                  className={styles.day}
                  data-today={sameDay(date, now) || undefined}
                  data-selected={sameDay(date, selected) || undefined}
                  aria-pressed={sameDay(date, selected)}
                  aria-label={dateFormat.format(date)}
                  onClick={() => onSelect(date)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.timeRow}>
        <span>Time</span>
        <span className={styles.pill}>{timeFormat.format(now)}</span>
      </div>
    </div>
  );
}

export default function DateTime({ className = '' }) {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(now);
  const rootRef = useRef(null);

  useEffect(() => {
    // 다음 분이 시작될 때 맞춰 갱신
    let timer = setTimeout(function tick() {
      setNow(new Date());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, []);

  // 바깥을 누르거나 Esc를 누르면 닫힘
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`${styles.dateTime} ${className}`}>
      <button
        type="button"
        className={`${styles.pill} ${styles.dateButton}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <time dateTime={now.toISOString()}>{dateFormat.format(now)}</time>
      </button>
      <span className={styles.pill}>{timeFormat.format(now)}</span>
      {open && <Calendar now={now} selected={selected} onSelect={setSelected} />}
    </div>
  );
}
