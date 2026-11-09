import { useEffect, useRef, useState } from 'react';
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
    <div className={styles.root} ref={rootRef} onBlur={onBlur}>
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
                <span className={styles.artist}>{track.artist}</span>
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
                    return (
                      <li key={r.id} className={styles.result}>
                        <Artwork className={styles.bigArtwork} src={r.artwork} size={53} />
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}>{r.title}</span>
                          <span className={styles.artist}>{r.artist}</span>
                        </span>
                        <span className={styles.resultControls}>
                          <button type="button" aria-label={`${r.title} 재생`} aria-pressed={current} onClick={() => playResult(r)}>
                            <Icon name="smallPlay" />
                          </button>
                          <button type="button" aria-label={`${r.title} 일시정지`} onClick={() => pauseResult(r)} disabled={!current}>
                            <Icon name="smallPause" />
                          </button>
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
    </div>
  );
}
