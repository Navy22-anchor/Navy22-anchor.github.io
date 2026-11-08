import { useState } from 'react';
import artwork from '../assets/music-artwork.png';
import styles from './DynamicIsland.module.css';

export default function DynamicIsland({ title = 'Heat Waves', explicit = true }) {
  const [playing, setPlaying] = useState(true);

  return (
    <button
      type="button"
      className={styles.island}
      onClick={() => setPlaying((p) => !p)}
      aria-pressed={playing}
      aria-label={playing ? `${title} 일시정지` : `${title} 재생`}
    >
      <img className={styles.artwork} src={artwork} alt="" width="24" height="24" />
      <span className={styles.title}>
        {title}
        {explicit && <span className={styles.explicit} aria-label="Explicit">E</span>}
      </span>
      <span className={`${styles.waveform} ${playing ? styles.playing : ''}`} aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
    </button>
  );
}
