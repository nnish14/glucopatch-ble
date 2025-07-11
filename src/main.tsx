import React from 'react'
import ReactDOM from 'react-dom/client'
import GlucoPatchBLE from './GlucoPatchBLE'

const rootEl = document.getElementById('root');

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <GlucoPatchBLE />
    </React.StrictMode>,
  );
} else {
  console.error("❌ No root element found!");
}

