import { useEffect, useRef, useState } from 'react';
import styles from './DynamicIsland.module.css';

// 작은 아일랜드에 마우스를 올리거나 포커스하면 Figma "Dynamic Island" (44:788) 재생기로 펼쳐짐.
// 검은 껍데기 하나가 가운데를 기준으로 커지고, 안의 내용만 바뀜 (Figma "Island hover motion" 92:652)
// 소리와 앨범 표지는 iTunes Search API에서 받아 옴 (무료, 키 없음). 주소가 바뀔 수 있어 열 때마다 곡 ID로 새로 받음
// 표지는 저작권이 음반사에 있어 저장소에 넣지 않고 Apple 서버의 이미지를 그대로 씀
const ITUNES_TRACK_ID = 1508562516; // Glass Animals - Heat Waves (Dreamland)
const SEEK_STEP = 10;

const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Icon({ name, size }) {
  const paths = {
    backward: 'M11 6v12L2 12zM21 6v12l-9-6z',
    forward: 'M3 6v12l9-6zM13 6v12l9-6z',
    play: 'M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z',
    pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  };
  if (name === 'airplay') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.6 16.4a9 9 0 1 1 12.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.5 13.5a5 5 0 1 1 7 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 15l5 6H7z" fill="currentColor" />
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

export default function DynamicIsland({
  title = 'Heat Waves',
  artist = 'Glass Animals',
  explicit = false, // iTunes 정보상 Explicit 아님
  trackId = ITUNES_TRACK_ID,
}) {
  const audioRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(30);
  const [artwork, setArtwork] = useState('');

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
        const track = data.results?.[0];
        if (track?.previewUrl) audio.src = track.previewUrl;
        // 100×100이 기본. 큰 표지(53px)가 고해상도 화면에서도 선명하게 160으로 요청
        if (track?.artworkUrl100) setArtwork(track.artworkUrl100.replace('100x100bb', '160x160bb'));
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
      {title}
      {explicit && <span className={styles.explicit} aria-label="Explicit">E</span>}
    </>
  );

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <button
          type="button"
          className={styles.island}
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? `${title} 일시정지` : `${title} 재생`}
        >
          <Artwork className={styles.artwork} src={artwork} size={24} />
          <span className={styles.title}>{titleText}</span>
          <Waveform playing={playing} />
        </button>

        <div className={styles.expanded} role="group" aria-label="지금 재생 중">
          <div className={styles.metadata}>
            <Artwork className={styles.bigArtwork} src={artwork} size={53} />
            <div className={styles.content}>
              <div className={styles.headline}>
                <span className={styles.title}>{titleText}</span>
                <span className={styles.artist}>{artist}</span>
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
            {/* 왼쪽 빈자리: 오른쪽 AirPlay와 균형을 맞추는 투명 아이콘 */}
            <span className={styles.spacer} aria-hidden="true" />
            <div className={styles.playControls}>
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
            <button type="button" aria-label="AirPlay">
              <Icon name="airplay" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
