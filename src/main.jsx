import './router.js'; // 맨 먼저: 예전 #/ 주소를 새 주소로 바꾼 뒤 나머지가 주소를 읽도록
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
