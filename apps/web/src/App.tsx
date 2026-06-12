import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#F5F6F8',
        color: '#1A3A8C',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Motipreca</h1>
        <p style={{ color: '#2C5AA0' }}>Esqueleto inicial — Semana 1, Día 1</p>
      </div>
    </main>
  );
}
