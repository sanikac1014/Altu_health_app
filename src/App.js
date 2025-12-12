import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import AskAltu from './pages/AskAltu'
import './App.css'

function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-buttons">
            <button 
              className={page === 'dashboard' ? 'active' : ''}
              onClick={() => setPage('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={page === 'ask' ? 'active' : ''}
              onClick={() => setPage('ask')}
            >
              Ask Altu
            </button>
          </div>
        </div>
      </nav>
      <main className="main">
        {page === 'dashboard' ? <Dashboard /> : <AskAltu />}
      </main>
    </div>
  )
}

export default App

