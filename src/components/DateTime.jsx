import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './DateTime.module.css';

// Figma "Date and time - Collapsed" (iOS 26): 날짜·시간 알약 두 개. 지금 시각을 보여 주고 1분마다 갱신
// 날짜 알약을 누르면 Figma "Date and time - Pickers" (83:635) 달력이 아래에 펼쳐짐
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HOUR = 30; // 하루 보기 한 시간 높이 (Figma Day Events 50px × 0.86 × 70%)
const FADE_MS = 150; // 나머지 주가 흐려지기 시작한 뒤 선택한 주가 올라가기 시작할 때까지
const RISE_MS = 500;
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

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

// 하루 보기 (Figma "Day Events"): 시간 눈금과 지금 시각 줄. 지금 시각이 가운데 오게 스크롤
function DayEvents({ now, date }) {
  const scrollRef = useRef(null);
  const isToday = sameDay(date, now);
  const nowY = (now.getHours() + now.getMinutes() / 60) * HOUR;

  useLayoutEffect(() => {
    const box = scrollRef.current;
    box.scrollTop = (isToday ? nowY : 8 * HOUR) - box.clientHeight / 2;
  }, [isToday, nowY]);

  return (
    <div ref={scrollRef} className={styles.dayEvents} aria-label={`${dateFormat.format(date)} 일정`}>
      <div className={styles.timeline} style={{ height: 24 * HOUR }}>
        {Array.from({ length: 25 }, (_, h) => (
          <div key={h} className={styles.hour} style={{ top: h * HOUR }}>
            <span>{hourLabel(h)}</span>
          </div>
        ))}
        {isToday && (
          <div className={styles.nowLine} style={{ top: nowY }}>
            <span>{timeFormat.format(now).replace(/ [AP]M$/, '')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Calendar({ now, selected, onSelect, phase, setPhase }) {
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() });
  const [dayWeek, setDayWeek] = useState(null);
  const weeksRef = useRef(null);
  const flip = useRef(null);
  const timer = useRef(0);
  const shift = (delta) => {
    setPhase('month');
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (phase === 'month') clearTimeout(timer.current);
  }, [phase]);

  // 날짜 더블클릭: 1) 나머지 주가 사라지고 2) 선택한 주가 위로 올라가고 3) 일정이 아래에서 올라옴
  const openDay = (w) => {
    if (phase !== 'month') return;
    setDayWeek(w);
    setPhase('fade');
    timer.current = setTimeout(() => {
      const box = weeksRef.current;
      flip.current = { top: box.children[w].offsetTop, height: box.offsetHeight };
      setPhase('day');
    }, FADE_MS);
  };

  // 나머지 주를 빼낸 뒤, 선택한 주를 원래 자리에서 새 자리로 옮기고 높이도 이어서 바꿈
  useLayoutEffect(() => {
    if (phase !== 'day' || !flip.current) return;
    const box = weeksRef.current;
    const row = box.children[0];
    const { top, height } = flip.current;
    flip.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = box.offsetHeight;
    box.style.height = `${height}px`;
    row.style.transform = `translateY(${top - row.offsetTop}px)`;
    void box.offsetHeight;
    box.style.transition = `height ${RISE_MS}ms var(--dt-ease)`;
    row.style.transition = `transform ${RISE_MS}ms var(--dt-ease)`;
    box.style.height = `${target}px`;
    row.style.transform = '';
    timer.current = setTimeout(() => {
      box.style.height = box.style.transition = row.style.transition = '';
    }, RISE_MS);
  }, [phase]);

  const weeks = monthWeeks(view.year, view.month);

  return (
    <div className={styles.calendar} role="dialog" aria-label="달력">
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.monthTitle}
          aria-label="오늘로 이동"
          onClick={() => {
            setPhase('month');
            setView({ year: now.getFullYear(), month: now.getMonth() });
          }}
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

      <div ref={weeksRef} className={styles.weeks}>
        {weeks.map((week, w) => {
          if (phase === 'day' && w !== dayWeek) return null;
          return (
            <div key={w} className={styles.week} data-fading={(phase === 'fade' && w !== dayWeek) || undefined}>
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
                    onDoubleClick={() => openDay(w)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          );
        })}
        {phase === 'day' && <DayEvents now={now} date={selected} />}
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
  const [phase, setPhase] = useState('month'); // month → fade → day
  const rootRef = useRef(null);

  useEffect(() => {
    // 다음 분이 시작될 때 맞춰 갱신
    let timer = setTimeout(function tick() {
      setNow(new Date());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, []);

  // 바깥을 누르면 닫힘. Esc는 하루 보기면 달력으로, 달력이면 닫힘
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (phase === 'month') setOpen(false);
      else setPhase('month');
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, phase]);

  useEffect(() => {
    if (!open) setPhase('month');
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
      {open && (
        <Calendar now={now} selected={selected} onSelect={setSelected} phase={phase} setPhase={setPhase} />
      )}
    </div>
  );
}
