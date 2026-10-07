import {StrictMode, Suspense, lazy, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App, {getInitialLanguage, TRANSLATIONS} from './App.tsx';
import './index.css';

const PdfCalibrationPage = lazy(() => import('./components/PdfCalibrationPage'));

function RootSurface() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (hash !== '#/pdf-calibration') return <App />;
  const labels = TRANSLATIONS[getInitialLanguage()].pdf;
  return <Suspense fallback={<p className="p-6">{labels.loading}</p>}>
    <PdfCalibrationPage labels={labels} />
  </Suspense>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootSurface />
  </StrictMode>,
);
