import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScheduleCalendar } from './DateTime.jsx';
import { SCHEDULE_GRACE, addSchedule as saveSchedule, scheduleMarks, takeDue, useSchedules } from './schedules.js';
import { useCanEdit } from '../data/supabase.js';
import styles from './DynamicIsland.module.css';

// 작은 아일랜드에 마우스를 올리거나 포커스하면 Figma "Dynamic Island" (44:788) 재생기로 펼쳐짐.
// 검은 껍데기 하나가 가운데를 기준으로 커지고, 안의 내용만 바뀜 (Figma "Island hover motion" 92:652)
// 소리와 앨범 표지는 iTunes Search API에서 받아 옴 (무료, 키 없음). 주소가 바뀔 수 있어 열 때마다 곡 ID로 새로 받음
// 표지는 저작권이 음반사에 있어 저장소에 넣지 않고 Apple 서버의 이미지를 그대로 씀
const ITUNES_TRACK_ID = 1508562516; // Glass Animals - Heat Waves (Dreamland)
const SEEK_STEP = 10;
const SEARCH_LIMIT = 5; // 검색 결과 최대 개수
const SEARCH_DELAY = 300; // 입력을 멈추고 이만큼 지나면 검색 (ms)
// Figma "Island search expanded" (130:959): 입력 줄 30, 결과 53, 위·사이·아래 간격 같게
const FIELD_HEIGHT = 30;
const ROW_HEIGHT = 53;
const ROW_GAP = 21;
// 노래 예약은 schedules.js에 저장. 탭이 열려 있어야 그 시각에 재생됨
const scheduleFormat = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });

// 바탕 위에서 잘 보이게: 색상(H)·채도(S)는 두고 밝기(L)만 [min, max] 안으로
// 흰 달력의 1px 줄은 55% 이하, 검은 아일랜드의 파형은 60% 이상
const ON_WHITE = [0, 0.55];
const ON_BLACK = [0.6, 1];
function readableColor(r, g, b, [minL, maxL]) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
  }
  return `hsl(${Math.round(((h * 60) + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(Math.min(maxL, Math.max(minL, l)) * 100)}%)`;
}

// 앨범 표지의 주요 색: 작게 줄여 그린 뒤, 회색·너무 밝거나 어두운 칸을 빼고 가장 많은 색 묶음의 평균
// (Apple 이미지 서버가 CORS를 허용해서 픽셀을 읽을 수 있음. 못 읽으면 null → 기본 빨강)
function useAlbumColor(src, lightness) {
  const [color, setColor] = useState(null);
  useEffect(() => {
    setColor(null);
    if (!src) return undefined;
    // <img>로 이미 받은 표지는 CORS 없이 캐시돼 캔버스가 막힐 수 있어, fetch(CORS)로 따로 받아 읽음
    const controller = new AbortController();
    fetch(src, { mode: 'cors', signal: controller.signal })
      .then((res) => res.blob())
      .then((blob) => createImageBitmap(blob))
      .then((img) => {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 40 || max < 50 || min > 225) continue; // 회색·검정·흰색
          const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
          const bucket = buckets.get(key) ?? { score: 0, count: 0, r: 0, g: 0, b: 0 };
          bucket.score += 1 + (max - min) / 255; // 선명한 색에 조금 더 무게
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          buckets.set(key, bucket);
        }
        const best = [...buckets.values()].sort((x, y) => y.score - x.score)[0];
        if (best) setColor(readableColor(best.r / best.count, best.g / best.count, best.b / best.count, lightness));
      })
      .catch(() => {}); // 못 읽으면 기본색
    return () => controller.abort();
  }, [src]);
  return color;
}

// 아티스트가 여러 명(쉼표·&·feat.·x로 이어짐)이면 이름 줄이 오른쪽에서 왼쪽으로 계속 흐름
const MARQUEE_SPEED = 30; // px/s
const MARQUEE_GAP = 32; // 끝과 다시 시작하는 앞 사이
const multipleArtists = (artist = '') => /,|&|\bfeat\.?\s|\bft\.\s|\swith\s|\sx\s/i.test(artist);

function Artist({ name }) {
  const first = useRef(null);
  const [duration, setDuration] = useState(0);
  const scrolling = multipleArtists(name);

  // 글자 폭에 맞춰 늘 같은 빠르기로
  useLayoutEffect(() => {
    if (scrolling) setDuration((first.current.offsetWidth + MARQUEE_GAP) / MARQUEE_SPEED);
  }, [name, scrolling]);

  if (!scrolling) return <span className={styles.artist}>{name}</span>;
  return (
    <span className={`${styles.artist} ${styles.marquee}`} aria-label={name}>
      <span className={styles.marqueeTrack} style={{ '--marquee-gap': `${MARQUEE_GAP}px`, animationDuration: `${duration}s` }}>
        <span ref={first} aria-hidden="true">{name}</span>
        <span aria-hidden="true">{name}</span>
      </span>
    </span>
  );
}

const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Icon({ name, size }) {
  const paths = {
    backward: 'M11 6v12L2 12zM21 6v12l-9-6z',
    forward: 'M3 6v12l9-6zM13 6v12l9-6z',
    play: 'M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z',
    pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  };
  if (name === 'search') {
    // Figma "Component 2": 렌즈 지름 11, 선 1.4
    return (
      <svg width={size} height={size} viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9.4 9.4L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  // 검색 결과 줄의 작은 재생·일시정지 (10×12, 모서리 1.5)
  if (name === 'smallPlay') {
    return (
      <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
        <path d="M1.5 1.6v8.8l7-4.4z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'smallPause') {
    return (
      <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
        <rect x="0" y="0" width="3.5" height="12" rx="1.5" fill="currentColor" />
        <rect x="6.5" y="0" width="3.5" height="12" rx="1.5" fill="currentColor" />
      </svg>
    );
  }
  // 검색 결과 줄의 예약 타이머 (Figma "Timer icon" 231:3099, 24 → 16)
  if (name === 'timer') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.5 13.5c0 3.15-1.97 5.97-4.93 7.05-2.97 1.08-6.29.19-8.31-2.23-2.03-2.41-2.33-5.84-.75-8.57 1.58-2.73 4.69-4.18 7.8-3.64" />
          <path d="M12.6 12.92l3.94-1.04M12 6V3.5M9.5 3h5M6.53 7.5L5 6.03" />
        </g>
        <g fill="currentColor">
          <circle cx="19.26" cy="11.22" r="0.875" />
          <circle cx="18.15" cy="9.15" r="0.65" />
          <circle cx="16.45" cy="7.53" r="0.425" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}

function Waveform({ playing }) {
  return (
    <span className={`${styles.waveform} ${playing ? styles.playing : ''}`} aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

// 표지를 받기 전에는 같은 크기의 빈 자리
function Artwork({ className, src, size }) {
  if (!src) return <span className={`${className} ${styles.artworkEmpty}`} aria-hidden="true" />;
  return <img className={className} src={src} alt="" width={size} height={size} />;
}

// iTunes 결과 → 화면에 쓰는 곡 정보
const toTrack = (r) => ({
  id: r.trackId,
  title: r.trackName,
  artist: r.artistName,
  // 100×100이 기본. 큰 표지(53px)가 고해상도 화면에서도 선명하게 160으로 요청
  artwork: r.artworkUrl100?.replace('100x100bb', '160x160bb') ?? '',
  previewUrl: r.previewUrl,
});

export default function DynamicIsland({
  title = 'Heat Waves',
  artist = 'Glass Animals',
  explicit = false, // iTunes 정보상 Explicit 아님
  trackId = ITUNES_TRACK_ID,
}) {
  const rootRef = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(30);
  // 지금 재생기에 올라간 곡. 검색 결과를 재생하면 바뀜
  const [track, setTrack] = useState({ id: trackId, title, artist, artwork: '', previewUrl: '' });
  const [searching, setSearching] = useState(false);
  const [pinned, setPinned] = useState(false); // 검색창을 클릭해 고정했는지
  const [query, setQuery] = useState('');
  const fieldRef = useRef(null);
  const buttonRef = useRef(null);

  const [results, setResults] = useState([]);
  const schedules = useSchedules();
  const editable = useCanEdit();
  const [scheduling, setScheduling] = useState(null); // 달력을 연 곡 { track, top, button }
  const [wake, setWake] = useState(0);
  const pickColor = useAlbumColor(scheduling?.track.artwork, ON_WHITE);
  const waveColor = useAlbumColor(track.artwork, ON_BLACK); // 지금 재생기에 올라간 곡

  // 미리듣기 주소를 받아 오디오를 준비. 30초가 끝나면 처음부터 반복
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = true;
    audioRef.current = audio;

    const sync = () => setElapsed(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      setReady(true);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('seeked', sync);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    const controller = new AbortController();
    fetch(`https://itunes.apple.com/lookup?id=${trackId}&country=KR`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const found = data.results?.[0];
        if (!found?.previewUrl) return;
        audio.src = found.previewUrl;
        setTrack((t) => ({ ...t, artwork: toTrack(found).artwork, previewUrl: found.previewUrl }));
      })
      .catch(() => {}); // 못 받으면 재생 버튼만 비활성

    return () => {
      controller.abort();
      audio.pause();
      audio.removeAttribute('src');
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('seeked', sync);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [trackId]);

  // 예약 시각이 되면 재생. 가장 가까운 예약까지 기다리되 1분마다 다시 확인 (절전 후 깨어난 경우 대비)
  useEffect(() => {
    if (!schedules.length) return undefined;
    const now = Date.now();
    const due = takeDue(now);
    if (due.length) {
      const latest = due.filter((s) => s.at > now - SCHEDULE_GRACE).at(-1);
      if (latest) playScheduled(latest.track);
      return undefined;
    }
    const next = Math.min(...schedules.map((s) => s.at));
    const timer = setTimeout(() => setWake((n) => n + 1), Math.min(next - now, 60000));
    return () => clearTimeout(timer);
  }, [schedules, wake]);

  // 미리듣기 주소가 바뀌었을 수 있어 곡 ID로 다시 받아 재생. 못 받으면 저장해 둔 주소로
  // (방문한 뒤 한 번도 누르지 않았다면 브라우저가 자동 재생을 막을 수 있음)
  const playScheduled = (t) => {
    const start = (url) => {
      if (!url) return;
      const audio = audioRef.current;
      audio.src = url;
      setTrack({ ...t, previewUrl: url });
      setElapsed(0);
      audio.play().catch(() => {});
    };
    fetch(`https://itunes.apple.com/lookup?id=${t.id}&country=US`)
      .then((res) => res.json())
      .then((data) => start(data.results?.[0]?.previewUrl || t.previewUrl))
      .catch(() => start(t.previewUrl));
  };

  // 타이머: 날짜 알약을 눌렀을 때 달력이 뜨는 자리(알약 6px 아래, 오른쪽 끝 맞춤)에 달력을 펼침
  // 날짜 알약이 없는 화면이면 그 줄 높이에 맞춰 아일랜드 왼쪽에. 같은 곡을 다시 누르면 닫힘
  const openSchedule = (r, button) => {
    const root = rootRef.current;
    const rect = root.getBoundingClientRect();
    const scale = rect.width / root.offsetWidth || 1; // 랜딩에서 아일랜드를 70%로 줄여 그림
    const anchor = document.querySelector('[data-calendar-anchor]')?.getBoundingClientRect();
    const place = anchor
      ? { top: (anchor.bottom + 6 - rect.top) / scale, right: (rect.right - anchor.right) / scale }
      : { top: (button.closest('li').getBoundingClientRect().top - rect.top) / scale };
    setScheduling((cur) => (cur?.track.id === r.id ? null : { track: r, place, button }));
  };
  const closeSchedule = () => {
    const button = scheduling?.button;
    setScheduling(null);
    setTimeout(() => button?.focus({ preventScroll: true })); // 달력이 사라져도 아일랜드는 펼친 채로
  };
  const addSchedule = (at) => {
    const { track: t } = scheduling;
    saveSchedule({ id: `${t.id}-${at.getTime()}`, at: at.getTime(), color: pickColor, track: t }).catch(() => {});
    closeSchedule();
  };

  // 입력을 멈추면 iTunes에서 노래 검색 (최대 5개)
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // 한국 스토어 검색은 뮤직비디오만 나와서 미국 스토어에서 노래를 찾음 (한국 노래도 나옴)
      const params = new URLSearchParams({ term, entity: 'song', limit: SEARCH_LIMIT * 2, country: 'US' });
      fetch(`https://itunes.apple.com/search?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const songs = (data.results ?? []).filter((r) => r.kind === 'song' && r.previewUrl);
          setResults(songs.slice(0, SEARCH_LIMIT).map(toTrack));
        })
        .catch(() => {});
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // 돋보기에 마우스를 올리면 검색창이 펼쳐지고, 돋보기·검색창에서 마우스가 나가면 다시 접힘
  // 검색창을 클릭하면(포커스) 고정: 마우스가 나가도 그대로, Esc나 아일랜드 밖을 누르면 닫힘
  const openSearch = () => setSearching(true);
  const closeSearch = () => {
    setScheduling(null);
    setSearching(false);
    setPinned(false);
    setQuery('');
    setResults([]);
  };
  const pinSearch = () => {
    setSearching(true);
    setPinned(true);
  };
  // 돋보기 ↔ 검색창 사이를 옮겨 갈 때는 닫지 않음
  const onSearchLeave = () => {
    if (pinned) return;
    setTimeout(() => {
      if (![fieldRef.current, buttonRef.current].some((el) => el?.matches(':hover'))) closeSearch();
    }, 60);
  };
  const onBlur = () => {
    // 다른 창으로 전환해 포커스가 사라진 경우는 그대로 둠 (돌아오면 이어서 검색)
    setTimeout(() => {
      if (!document.hasFocus()) return;
      if (!rootRef.current?.contains(document.activeElement)) closeSearch();
    });
  };

  const playResult = (r) => {
    const audio = audioRef.current;
    if (track.previewUrl !== r.previewUrl) {
      audio.src = r.previewUrl;
      setTrack(r);
      setElapsed(0);
    }
    audio.play().catch(() => {});
  };
  const pauseResult = (r) => {
    if (track.previewUrl === r.previewUrl) audioRef.current.pause();
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!ready) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  const seek = (t) => {
    const audio = audioRef.current;
    if (!ready) return;
    audio.currentTime = (t + duration) % duration;
  };

  const titleText = (
    <>
      {track.title}
      {explicit && track.id === trackId && <span className={styles.explicit} aria-label="Explicit">E</span>}
    </>
  );

  return (
    <div className={styles.root} ref={rootRef} onBlur={onBlur} style={waveColor ? { '--wave-color': waveColor } : undefined}>
      <div className={styles.shell} data-searching={searching || undefined}>
        <button
          type="button"
          className={styles.island}
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? `${track.title} 일시정지` : `${track.title} 재생`}
        >
          <Artwork className={styles.artwork} src={track.artwork} size={24} />
          <span className={styles.title}>{titleText}</span>
          <Waveform playing={playing} />
        </button>

        <div className={styles.expanded} role="group" aria-label="지금 재생 중">
          <div className={styles.metadata}>
            <Artwork className={styles.bigArtwork} src={track.artwork} size={53} />
            <div className={styles.content}>
              <div className={styles.headline}>
                <span className={styles.title}>{titleText}</span>
                <Artist name={track.artist} />
              </div>
              <Waveform playing={playing} />
            </div>
          </div>

          <div className={styles.progress}>
            <span className={styles.time}>{formatTime(elapsed)}</span>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="재생 위치"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(elapsed)}
              aria-valuetext={formatTime(elapsed)}
            >
              <span className={styles.fill} style={{ width: `${(elapsed / duration) * 100}%` }} />
            </div>
            <span className={styles.time}>-{formatTime(Math.max(0, duration - elapsed))}</span>
          </div>

          <div className={styles.controls}>
            {/* 왼쪽 빈자리: 오른쪽 돋보기와 균형을 맞추는 투명 아이콘 */}
            <span className={styles.spacer} aria-hidden="true" />
            <div className={styles.playControls} inert={searching}>
              <button type="button" aria-label="처음으로" onClick={() => seek(0)} disabled={!ready}>
                <Icon name="backward" size={20} />
              </button>
              <button type="button" aria-label={playing ? '일시정지' : '재생'} aria-pressed={playing} onClick={toggle} disabled={!ready}>
                <Icon name={playing ? 'pause' : 'play'} size={32} />
              </button>
              <button type="button" aria-label={`${SEEK_STEP}초 앞으로`} onClick={() => seek(elapsed + SEEK_STEP)} disabled={!ready}>
                <Icon name="forward" size={20} />
              </button>
            </div>
            {/* 검색창: 돋보기 자리에서 왼쪽으로 펼쳐지고, 결과가 생기면 아래로 늘어남 (아일랜드 크기는 그대로) */}
            <div
              ref={fieldRef}
              className={styles.searchField}
              onMouseLeave={onSearchLeave}
              onMouseDown={pinSearch}
              style={{ height: results.length ? FIELD_HEIGHT + results.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP : FIELD_HEIGHT }}
              inert={!searching}
            >
              <input
                ref={inputRef}
                className={styles.searchInput}
                type="search"
                value={query}
                aria-label="노래 검색"
                onFocus={pinSearch}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  closeSearch();
                  e.currentTarget.blur();
                }}
              />
              {results.length > 0 && (
                <ul className={styles.results} aria-label="검색 결과">
                  {results.map((r) => {
                    const current = playing && track.previewUrl === r.previewUrl;
                    const pending = schedules.filter((s) => s.track.id === r.id);
                    return (
                      <li key={r.id} className={styles.result}>
                        <Artwork className={styles.bigArtwork} src={r.artwork} size={53} />
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}>{r.title}</span>
                          <Artist name={r.artist} />
                        </span>
                        <span className={styles.resultControls}>
                          <button
                            type="button"
                            aria-label={current ? `${r.title} 일시정지` : `${r.title} 재생`}
                            aria-pressed={current}
                            onClick={() => (current ? pauseResult(r) : playResult(r))}
                          >
                            <Icon name={current ? 'smallPause' : 'smallPlay'} />
                          </button>
                          {/* 예약이 걸린 곡은 타이머가 앨범 색으로. 예약은 주인(로그인)만 */}
                          {editable && (
                            <button
                              type="button"
                              aria-label={`${r.title} 재생 예약${pending.length ? ` (${pending.length}개 예약됨)` : ''}`}
                              aria-expanded={scheduling?.track.id === r.id}
                              title={pending.map((s) => scheduleFormat.format(s.at)).join('\n') || undefined}
                              style={pending.length && pending[0].color ? { color: pending[0].color } : undefined}
                              onClick={(e) => openSchedule(r, e.currentTarget)}
                            >
                              <Icon name="timer" />
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 돋보기: 마우스를 올리면 검색창이 펼쳐짐 (키보드는 포커스, 터치는 탭) */}
            <button
              type="button"
              className={styles.searchButton}
              aria-label="노래 검색 열기"
              aria-expanded={searching}
              ref={buttonRef}
              onMouseEnter={openSearch}
              onMouseLeave={onSearchLeave}
              onFocus={openSearch}
              onClick={() => {
                // 터치·클릭: 바로 고정하고 입력할 수 있게
                pinSearch();
                setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450);
              }}
            >
              <Icon name="search" size={15} />
            </button>
          </div>
        </div>
      </div>

      {scheduling && editable && (
        <ScheduleCalendar
          key={scheduling.track.id}
          className={styles.scheduler}
          style={{ ...scheduling.place, ...(pickColor && { '--dt-red': pickColor }) }}
          label={scheduling.track.title}
          marks={scheduleMarks(schedules)}
          onConfirm={addSchedule}
          onClose={closeSchedule}
        />
      )}
    </div>
  );
}
