import { useMemo, useState } from 'react';
import DynamicIsland from './components/DynamicIsland.jsx';
import ProjectStrip from './components/ProjectStrip.jsx';
import { categories, projects } from './data/projects.js';
import braceLeft from './assets/brace-left.svg';
import braceRight from './assets/brace-right.svg';
import styles from './App.module.css';

export default function App() {
  const [category, setCategory] = useState(categories[0]);
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleProjects = useMemo(() => {
    const matched = projects.filter((p) => p.tags.includes(category));
    return matched.length > 0 ? matched : projects;
  }, [category]);

  const active = visibleProjects[activeIndex] ?? visibleProjects[0];

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.logo}>
          <span className={styles.logoName}>Hanlog</span>
          <span className={styles.logoSpace}> </span>
          <span className={styles.logoBy}>by</span>
        </h1>

        <nav className={styles.nav} aria-label="주요 메뉴">
          <a href="#work" className={styles.underline}>Work</a>
          <span className={styles.navSep}>
            , <a href="#about" className={styles.plainLink}>About</a>
          </span>
        </nav>

        <div className={styles.island}>
          <DynamicIsland />
        </div>

        <a href="#contact" className={`${styles.plainLink} ${styles.contactNav}`}>Contact</a>

        <div className={styles.intro}>
          <p>여기에 스튜디오 소개 문단이 들어갑니다. 프로젝트와 작업 방식을 짧게 적는 자리입니다.</p>
          <p className={styles.contact}>
            Contact:
            <br />
            <a href="mailto:hello@example.com" className={styles.underline}>hello@example.com</a>
          </p>
        </div>
      </header>

      <ul className={styles.categories} aria-label="카테고리">
        {categories.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={name === category ? styles.categoryActive : styles.category}
              aria-pressed={name === category}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.focus} aria-live="polite">
        <p className={styles.tags}>{active.tags}</p>
        <img className={styles.braceLeft} src={braceLeft} alt="" width="60" height="173" />
        <img className={styles.braceRight} src={braceRight} alt="" width="60" height="173" />
        <p className={styles.roles}>{active.roles}</p>
        <p className={styles.index}>{active.id}</p>
      </div>

      <main id="work" className={styles.main}>
        <ProjectStrip projects={visibleProjects} onActiveChange={setActiveIndex} />
      </main>

      <footer className={styles.footer}>
        <p>Vertical, Horizontal, Grid</p>
        <p className={styles.copyright}>All rights reserved. ©2026 Placeholder</p>
      </footer>
    </>
  );
}
