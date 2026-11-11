import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scheduleMarks, useSchedules } from './schedules.js';
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
const FALL_MS = 300; // 하루 보기 닫기: 일정이 내려가는 시간
const RETURN_MS = 550;
const SWAP_MS = 400; // 다음 주로 넘어갈 때: 이전 주가 사라지는 0.2s + 새 주가 들어오는 0.25s (0.15s부터)
const MOVE_DAY_PULL = 80; // 하루 보기 맨 아래(위)에서 이만큼 더 내리면(올리면) 다음 날(전날)로 // 선택한 주가 제자리로 간 뒤 나머지 주가 다 나타날 때까지
const MAX_MARKS = 3; // 한 날짜에 보이는 예약 점 수 (넘으면 생략)
const PICK_STEP = 5; // 예약 시각을 고르는 단위 (분)
const hourLabel = (h) => `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`; // 24시는 다음 날 12 AM
const atMinutes = (date, min) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(min / 60), min % 60);
const clampPick = (min) => Math.min(24 * 60 - PICK_STEP, Math.max(0, min));

// 다음 분이 시작될 때마다 지금 시각을 갱신
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = setTimeout(function tick() {
      setNow(new Date());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, []);
  return now;
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// 그 날이 든 주의 일요일 (주가 바뀌었는지 비교하는 열쇠)
const weekStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime();
const weekIndex = (d) => Math.floor((new Date(d.getFullYear(), d.getMonth(), 1).getDay() + d.getDate() - 1) / 7);

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
// 맨 아래에서 더 내리면 다음 날 0시부터, 맨 위에서 더 올리면 전날 밤 끝부터 보여 줌
// pick(분)이 있으면 예약 모드 (Figma 231:2699): 고른 시각 줄은 가운데에 고정되고, 일정을 스크롤하면
// 줄 아래로 지나가는 시각이 고른 시각이 됨. 누른 시각은 줄로 끌려오고, ↑↓(Shift는 1시간)로도 옮김
function DayEvents({ now, date, closing, onMoveDay, pick = null, onPick }) {
  const scrollRef = useRef(null);
  const timelineRef = useRef(null);
  const [moved, setMoved] = useState(null); // null | 1 (다음 날) | -1 (전날)
  const overscroll = useRef(0);
  const idle = useRef(0);
  const touchY = useRef(null);
  const isToday = sameDay(date, now);
  const nowY = (now.getHours() + now.getMinutes() / 60) * HOUR;
  const dayKey = date.toDateString();
  const picking = pick != null;
  const pointer = useRef(null);
  const toY = (min) => (min / 60) * HOUR;
  // 위아래 여백이 보이는 높이의 절반이라, 스크롤 위치가 곧 가운데 줄의 시각
  const pickFromScroll = () => clampPick(Math.round(((scrollRef.current.scrollTop / HOUR) * 60) / PICK_STEP) * PICK_STEP);

  // 날짜가 바뀔 때만 스크롤 위치를 정함 (1분마다 시각이 바뀌어도 사용자가 둔 위치는 유지)
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (moved === 1) box.scrollTop = 0;
    else if (moved === -1) box.scrollTop = box.scrollHeight;
    else if (picking) box.scrollTop = toY(pick);
    else box.scrollTop = (isToday ? nowY : 8 * HOUR) - box.clientHeight / 2;
  }, [dayKey]);

  // 예약 모드: 열리면 바로 ↑↓·Enter를 쓸 수 있게 포커스
  useEffect(() => {
    if (picking) scrollRef.current.focus({ preventScroll: true });
  }, [picking]);

  // 스크롤이 멈추면 5분 눈금에 딱 맞춰 줄과 시각이 어긋나지 않게
  useEffect(() => {
    if (!picking) return undefined;
    const box = scrollRef.current;
    const snap = () => {
      const top = toY(pickFromScroll());
      if (Math.abs(box.scrollTop - top) > 0.5) box.scrollTo({ top, behavior: 'smooth' });
    };
    box.addEventListener('scrollend', snap);
    return () => box.removeEventListener('scrollend', snap);
  }, [picking]);

  // 누른 높이의 시각을 가운데 줄로 끌어옴 (아일랜드처럼 줄여 그린 곳에서도 맞게 화면 배율을 나눔)
  const scrollToPoint = (clientY) => {
    const line = timelineRef.current;
    const rect = line.getBoundingClientRect();
    const scale = rect.height / line.offsetHeight || 1;
    const min = ((clientY - rect.top) / scale / HOUR) * 60;
    scrollRef.current.scrollTo({ top: toY(clampPick(Math.round(min / PICK_STEP) * PICK_STEP)), behavior: 'smooth' });
  };
  const pickProps = picking && {
    tabIndex: 0,
    role: 'slider',
    'aria-label': '재생 시각',
    'aria-valuemin': 0,
    'aria-valuemax': 24 * 60 - PICK_STEP,
    'aria-valuenow': pick,
    'aria-valuetext': timeFormat.format(atMinutes(date, pick)),
    'data-picking': '',
    onScroll: () => onPick(pickFromScroll()),
    // 마우스는 끌면 일정이 따라 움직이고(줄은 그대로), 끌지 않고 떼면 그 시각으로. 터치는 원래 스크롤 + 톡 누르기
    onPointerDown: (e) => {
      const box = e.currentTarget;
      const rect = box.getBoundingClientRect();
      pointer.current = {
        y: e.clientY,
        top: box.scrollTop,
        scale: rect.height / box.offsetHeight || 1,
        mouse: e.pointerType === 'mouse',
        dragged: false,
      };
      if (pointer.current.mouse && e.button === 0) box.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const p = pointer.current;
      if (!p?.mouse || !(e.buttons & 1)) return;
      if (Math.abs(e.clientY - p.y) > 4) p.dragged = true;
      if (p.dragged) e.currentTarget.scrollTop = p.top - (e.clientY - p.y) / p.scale;
    },
    onPointerUp: (e) => {
      const p = pointer.current;
      pointer.current = null;
      if (p && !p.dragged && Math.abs(e.clientY - p.y) < 6) scrollToPoint(e.clientY);
    },
    onKeyDown: (e) => {
      const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
      if (!step) return;
      e.preventDefault();
      scrollRef.current.scrollTop = toY(clampPick(pickFromScroll() + step * (e.shiftKey ? 60 : PICK_STEP)));
    },
  };

  useEffect(() => () => clearTimeout(idle.current), []);

  // 끝에 닿은 쪽으로 더 당기면 (아래 +1, 위 -1)
  const edge = (dy) => {
    const box = scrollRef.current;
    if (dy > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) return 1;
    if (dy < 0 && box.scrollTop <= 0) return -1;
    return 0;
  };

  // 같은 쪽 끝에서 더 당긴 거리가 쌓이면 그 쪽 날로
  const pull = (dy) => {
    const dir = closing ? 0 : edge(dy);
    if (!dir || Math.sign(overscroll.current) === -dir) overscroll.current = 0;
    if (!dir) return;
    overscroll.current += dy;
    clearTimeout(idle.current);
    idle.current = setTimeout(() => (overscroll.current = 0), 300);
    if (Math.abs(overscroll.current) < MOVE_DAY_PULL) return;
    overscroll.current = 0;
    setMoved(dir);
    onMoveDay(dir);
  };

  return (
    <div
      ref={scrollRef}
      className={styles.dayEvents}
      data-closing={closing || undefined}
      aria-label={`${dateFormat.format(date)} 일정`}
      onWheel={(e) => pull(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY)}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchMove={(e) => {
        const y = e.touches[0].clientY;
        pull(touchY.current - y);
        touchY.current = y;
      }}
      {...pickProps}
    >
      {/* 예약 모드의 고른 시각 줄: 스크롤해도 가운데에 그대로 */}
      {picking && (
        <div className={`${styles.nowLine} ${styles.pickLine}`} aria-hidden="true">
          <span>{timeFormat.format(atMinutes(date, pick)).replace(/ [AP]M$/, '')}</span>
        </div>
      )}
      <div
        ref={timelineRef}
        key={dayKey}
        className={`${styles.timeline} ${moved === 1 ? styles.timelineNext : ''} ${moved === -1 ? styles.timelinePrev : ''}`}
        style={{ height: 24 * HOUR }}
      >
        {Array.from({ length: 25 }, (_, h) => (
          <div key={h} className={styles.hour} style={{ top: h * HOUR }}>
            <span>{hourLabel(h)}</span>
          </div>
        ))}
        {!picking && isToday && (
          <div className={styles.nowLine} style={{ top: nowY }}>
            <span>{timeFormat.format(now).replace(/ [AP]M$/, '')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// schedule이면 예약 모드: 날짜를 한 번 누르면 바로 하루 보기가 열리고, 시각을 고른 뒤 Enter로 onConfirm
// marks: 날짜(toDateString) → 그날 예약들의 앨범 색 목록. 날짜 아래에 작은 점으로 (최대 3개)
function Calendar({ now, selected, onSelect, phase, setPhase, schedule = false, label = '달력', pick, onPick, onConfirm, marks }) {
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() });
  const [dayWeek, setDayWeek] = useState(null);
  const [leaving, setLeaving] = useState(null); // 하루 보기에서 주가 바뀔 때 사라지는 이전 주 { year, month, w, dir, selected }
  const swapTimer = useRef(0);
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

  // 선택한 주를 이전 자리(top)에서 지금 자리로, 묶음 높이를 이전 높이에서 지금 높이로 미끄러지듯 옮김
  const slideWeek = (row, top, height) => {
    const box = weeksRef.current;
    const target = box.offsetHeight;
    box.style.height = `${height}px`;
    row.style.transform = `translateY(${top - row.offsetTop}px)`;
    void box.offsetHeight;
    box.style.transition = `height ${RISE_MS}ms var(--dt-ease)`;
    row.style.transition = `transform ${RISE_MS}ms var(--dt-ease)`;
    box.style.height = `${target}px`;
    row.style.transform = '';
  };

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(swapTimer.current);
    },
    [],
  );

  // 달력 상태로 돌아오면 남은 타이머와 움직임용 인라인 스타일을 정리
  useEffect(() => {
    if (phase !== 'month') return;
    clearTimeout(timer.current);
    const box = weeksRef.current;
    for (const el of [box, ...box.children]) el.style.height = el.style.transform = el.style.transition = '';
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

  // 하루 보기 닫기: 1) 일정이 아래로 내려가며 닫히고 2) 선택한 주가 제자리로 미끄러지고 3) 나머지 주가 나타남
  useEffect(() => {
    if (phase !== 'closing') return;
    if (reducedMotion()) {
      setPhase('month');
      return;
    }
    timer.current = setTimeout(() => {
      const box = weeksRef.current;
      flip.current = { top: box.children[0].offsetTop, height: box.offsetHeight };
      setPhase('return');
    }, FALL_MS);
  }, [phase, setPhase]);

  useLayoutEffect(() => {
    if ((phase !== 'day' && phase !== 'return') || !flip.current) return;
    const { top, height } = flip.current;
    flip.current = null;
    if (reducedMotion()) {
      if (phase === 'return') setPhase('month');
      return;
    }
    const box = weeksRef.current;
    slideWeek(phase === 'day' ? box.children[0] : box.children[dayWeek], top, height);
    timer.current = setTimeout(() => {
      if (phase === 'return') setPhase('month');
      else box.style.height = box.style.transition = box.children[0].style.transition = '';
    }, phase === 'day' ? RISE_MS : RETURN_MS);
  }, [phase, dayWeek, setPhase]);

  // 하루 보기에서 다음 날(+1)·전날(-1)로: 달이 바뀌면 그 달로, 선택한 주도 그 날이 있는 주로
  // 주가 바뀌면 1) 이전 주가 넘어가는 쪽(다음 주면 위)으로 흐려지며 사라지고 2) 그 자리에 새 주가 흐려진 채로 들어옴
  const moveDay = (delta) => {
    const d = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + delta);
    if (weekStart(d) !== weekStart(selected) && !reducedMotion()) {
      clearTimeout(swapTimer.current);
      setLeaving({ year: view.year, month: view.month, w: dayWeek, dir: delta > 0 ? 'next' : 'prev', selected });
      swapTimer.current = setTimeout(() => setLeaving(null), SWAP_MS);
    }
    onSelect(d);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setDayWeek(weekIndex(d));
  };

  const weeks = monthWeeks(view.year, view.month);
  const inDay = phase === 'day' || phase === 'closing';

  // 한 주 줄. 날짜 단추는 그 주가 속한 달(year, month) 기준
  const weekRow = (week, w, { year, month }, sel, props) => (
    <div key={weekStart(new Date(year, month, 1 + 7 * w))} className={styles.week} {...props}>
      {week.map((day, i) => {
        if (!day) return <span key={i} className={styles.day} />;
        const date = new Date(year, month, day);
        const dots = marks?.get(date.toDateString()) ?? [];
        return (
          <button
            key={i}
            type="button"
            className={styles.day}
            data-today={sameDay(date, now) || undefined}
            data-selected={sameDay(date, sel) || undefined}
            aria-pressed={sameDay(date, sel)}
            aria-label={`${dateFormat.format(date)}${dots.length ? `, 예약 ${dots.length}개` : ''}`}
            onClick={() => {
              onSelect(date);
              if (schedule && phase === 'month') openDay(w);
            }}
            onDoubleClick={schedule ? undefined : () => (phase === 'day' ? setPhase('closing') : openDay(w))}
          >
            {day}
            {dots.length > 0 && (
              <span className={styles.marks} aria-hidden="true">
                {dots.slice(0, MAX_MARKS).map((color, k) => (
                  <i key={k} style={color ? { background: color } : undefined} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={styles.calendar}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (!schedule || e.key !== 'Enter' || phase !== 'day') return;
        e.preventDefault();
        onConfirm();
      }}
    >
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
        {weeks.map((week, w) =>
          inDay && w !== dayWeek
            ? null
            : weekRow(week, w, view, selected, {
                'data-fading': (phase === 'fade' && w !== dayWeek) || undefined,
                'data-entering': (phase === 'return' && w !== dayWeek) || undefined,
                'data-swap': (inDay && leaving?.dir) || undefined,
              }),
        )}
        {(phase === 'day' || phase === 'closing') && (
          <DayEvents
            now={now}
            date={selected}
            closing={phase === 'closing'}
            onMoveDay={moveDay}
            pick={schedule ? pick : null}
            onPick={onPick}
          />
        )}
        {/* 사라지는 이전 주: 새 주 자리에 겹쳐 그림 (맨 뒤에 둬서 첫 줄 계산에 끼지 않게) */}
        {inDay &&
          leaving &&
          weekRow(monthWeeks(leaving.year, leaving.month)[leaving.w], leaving.w, leaving, leaving.selected, {
            'data-leaving': leaving.dir,
            'aria-hidden': true,
            inert: true,
          })}
      </div>

      <div className={styles.timeRow}>
        <span>Time</span>
        <span className={styles.pill} aria-live={schedule ? 'polite' : undefined}>
          {timeFormat.format(schedule ? atMinutes(selected, pick) : now)}
        </span>
      </div>
    </div>
  );
}

// 노래 예약용 달력 (아일랜드 검색 결과의 타이머). 날짜 → 시각(줄 색은 --dt-red로 바꿈) → Enter
// Esc: 하루 보기면 달력으로, 달력이면 onClose
export function ScheduleCalendar({ className = '', style, label, marks, onConfirm, onClose }) {
  const now = useNow();
  const [selected, setSelected] = useState(now);
  const [phase, setPhase] = useState('month');
  // 처음 시각: 지금 바로 다음 5분 단위
  const [pick, setPick] = useState(() => clampPick(Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / PICK_STEP) * PICK_STEP));

  return (
    <div
      className={`${styles.dateTime} ${styles.scheduler} ${className}`}
      style={style}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        if (phase === 'month') onClose();
        else if (phase === 'day') setPhase('closing');
      }}
    >
      <Calendar
        now={now}
        selected={selected}
        onSelect={setSelected}
        phase={phase}
        setPhase={setPhase}
        schedule
        label={`${label} 재생 예약`}
        marks={marks}
        pick={pick}
        onPick={setPick}
        onConfirm={() => onConfirm(atMinutes(selected, pick))}
      />
    </div>
  );
}

export default function DateTime({ className = '' }) {
  const now = useNow();
  const schedules = useSchedules();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(now);
  const [phase, setPhase] = useState('month'); // 열기 month → fade → day, 닫기 day → closing → return → month
  const rootRef = useRef(null);

  // 바깥을 누르면 닫힘. Esc는 하루 보기면 달력으로 (닫는 모션), 달력이면 닫힘
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (phase === 'month') setOpen(false);
      else if (phase === 'day') setPhase('closing');
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
        <Calendar
          now={now}
          selected={selected}
          onSelect={setSelected}
          phase={phase}
          setPhase={setPhase}
          marks={scheduleMarks(schedules)}
        />
      )}
    </div>
  );
}
