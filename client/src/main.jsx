import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root'))

// Firebase throws on import when the API key is missing, which used to leave a blank page.
// Check first and show a readable message instead.
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  root.render(
    <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#b91c1c' }}>
      <h2>Missing Firebase configuration</h2>
      <p>
        Set <code>VITE_FIREBASE_API_KEY</code> in <code>client/.env</code> (see{' '}
        <code>client/.env.example</code>) and restart the dev server.
      </p>
    </div>,
  )
} else {
  await import('./config/axiosAuth.js')
  const { default: App } = await import('./App.jsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
