import { useState, useEffect } from 'react'
import { loadHealthData, loadScreenTimeData, computeMetrics } from '../utils/data'
import { askQuestion } from '../utils/llm'
import './AskAltu.css'

export default function AskAltu() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [healthData, setHealthData] = useState([])
  const [screenTimeData, setScreenTimeData] = useState([])
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [health, screenTime] = await Promise.all([
        loadHealthData(),
        loadScreenTimeData(),
      ])
      setHealthData(health)
      setScreenTimeData(screenTime)
      setMetrics(computeMetrics(health, screenTime))
    }
    fetchData()
  }, [])

  const examples = [
    'How does exercise relate to sleep?',
    'How have my steps trended over the past month?',
    'How does time using Twitter differ weekday vs. weekend?',
    'What is my average screen time per day?',
    'Which app do I use the most?',
    'How many days did I work out in the last 90 days?',
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim() || !metrics) return

    setLoading(true)
    setError('')
    setAnswer('')

    try {
      const response = await askQuestion(question, metrics, healthData, screenTimeData)
      setAnswer(response)
    } catch (err) {
      setError(err.message || 'Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ask-altu">
      <h2>Ask Altu</h2>
      <p className="subtitle">Ask questions about your health and screen time data</p>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="input-group">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your health data..."
            className="input"
            disabled={loading || !metrics}
          />
          <button type="submit" className="submit-btn" disabled={loading || !question.trim() || !metrics}>
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </form>

      {error && (
        <div className="error">
          {error}
          {error.includes('API key') && (
            <div className="api-hint">
              <p>Set your OpenAI API key in a <code>.env</code> file:</p>
              <code>REACT_APP_OPENAI_API_KEY=your_key_here</code>
            </div>
          )}
        </div>
      )}

      {answer && (
        <div className="answer">
          <h3>Answer</h3>
          <p>{answer}</p>
        </div>
      )}

      <div className="examples">
        <h3>Example Questions</h3>
        <div className="examples-grid">
          {examples.map((example, i) => (
            <button
              key={i}
              className="example-btn"
              onClick={() => setQuestion(example)}
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

