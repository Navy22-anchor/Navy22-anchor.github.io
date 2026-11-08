import { useEffect, useState } from 'react';
import artwork from '../assets/music-artwork.png';
import styles from './DynamicIsland.module.css';

// 작은 아일랜드에 마우스를 올리거나 포커스하면 Figma "Dynamic Island" (44:788) 재생기로 펼쳐짐.
// 검은 껍데기 하나가 가운데를 기준으로 커지고, 안의 내용만 바뀜 (Figma "Island hover motion" 92:652)
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

export default function DynamicIsland({
  title = 'Heat Waves',
  artist = 'Glass Animals',
  explicit = true,
  duration = 241,
}) {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(50);

  // 재생 중이면 1초마다 진행. 끝나면 처음부터
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed((t) => (t + 1) % duration), 1000);
    return () => clearInterval(timer);
  }, [playing, duration]);

  const toggle = () => setPlaying((p) => !p);
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
          <img className={styles.artwork} src={artwork} alt="" width="24" height="24" />
          <span className={styles.title}>{titleText}</span>
          <Waveform playing={playing} />
        </button>

        <div className={styles.expanded} role="group" aria-label="지금 재생 중">
          <div className={styles.metadata}>
            <img className={styles.bigArtwork} src={artwork} alt="" width="53" height="53" />
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
              aria-valuenow={elapsed}
              aria-valuetext={formatTime(elapsed)}
            >
              <span className={styles.fill} style={{ width: `${(elapsed / duration) * 100}%` }} />
            </div>
            <span className={styles.time}>-{formatTime(duration - elapsed)}</span>
          </div>

          <div className={styles.controls}>
            {/* 왼쪽 빈자리: 오른쪽 AirPlay와 균형을 맞추는 투명 아이콘 */}
            <span className={styles.spacer} aria-hidden="true" />
            <div className={styles.playControls}>
              <button type="button" aria-label="처음으로" onClick={() => setElapsed(0)}>
                <Icon name="backward" size={20} />
              </button>
              <button type="button" aria-label={playing ? '일시정지' : '재생'} aria-pressed={playing} onClick={toggle}>
                <Icon name={playing ? 'pause' : 'play'} size={32} />
              </button>
              <button type="button" aria-label="다음 곡" onClick={() => setElapsed(0)}>
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
