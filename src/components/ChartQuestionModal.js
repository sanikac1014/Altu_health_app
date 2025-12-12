import { useState } from 'react'
import { askChartQuestion } from '../utils/llm'
import './ChartQuestionModal.css'

export default function ChartQuestionModal({ isOpen, onClose, chartTitle, chartContext, healthData, screenTimeData, metrics }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError('')
    setAnswer('')

    try {
      const response = await askChartQuestion(question, chartTitle, chartContext, metrics, healthData, screenTimeData)
      setAnswer(response)
    } catch (err) {
      setError(err.message || 'Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setQuestion('')
    setAnswer('')
    setError('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ask about: {chartTitle}</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="chart-question-form">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this chart..."
              className="chart-question-input"
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="chart-question-submit" disabled={loading || !question.trim()}>
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </form>

          {error && (
            <div className="chart-error">
              {error}
            </div>
          )}

          {answer && (
            <div className="chart-answer">
              <h4>Answer</h4>
              <p>{answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

