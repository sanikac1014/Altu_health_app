import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { loadHealthData, loadScreenTimeData, computeMetrics } from '../utils/data'
import ChartQuestionModal from '../components/ChartQuestionModal'
import './Dashboard.css'

export default function Dashboard() {
  const [healthData, setHealthData] = useState([])
  const [screenTimeData, setScreenTimeData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedChart, setSelectedChart] = useState({ title: '', context: '' })
  const [streaksOpen, setStreaksOpen] = useState(false)
  const [expandedChart, setExpandedChart] = useState(null)
  const [customChartOpen, setCustomChartOpen] = useState(false)
  const [selectedColumn1, setSelectedColumn1] = useState('')
  const [selectedColumn2, setSelectedColumn2] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [dayRange, setDayRange] = useState(30)

  useEffect(() => {
    async function fetchData() {
      try {
        const [health, screenTime] = await Promise.all([
          loadHealthData(),
          loadScreenTimeData(),
        ])
        setHealthData(health)
        setScreenTimeData(screenTime)
        setMetrics(computeMetrics(health, screenTime))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="loading">Loading data...</div>
  }

  if (!metrics || healthData.length === 0) {
    return <div className="loading">No data available</div>
  }

  // Prepare chart data based on selected day range
  const formatDate = (dateStr) => 
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const chartData = healthData.slice(-dayRange).map(d => ({
    date: formatDate(d.date),
    steps: d.steps,
    sleep: d.sleep,
    workout: d.workout,
  }))

  // Original screen time chart data (unfiltered)
  const screenTimeChartData = metrics.screenTime.dailyTotals.slice(-dayRange).map(d => ({
    date: formatDate(d.date),
    minutes: d.total,
  }))

  // Get unique categories for filter
  const categories = ['All', ...new Set(screenTimeData.map(item => item.category))].sort()

  // Filter screen time data by category
  const filteredScreenTime = selectedCategory === 'All' 
    ? screenTimeData
    : screenTimeData.filter(item => item.category === selectedCategory)

  // Compute filtered metrics for Top Apps chart
  const appTotals = {}
  filteredScreenTime.forEach(item => {
    appTotals[item.app] = (appTotals[item.app] || 0) + item.minutes
  })
  const filteredTopApps = Object.entries(appTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([app, minutes]) => ({ app, minutes }))

  // Define metric relationships for custom chart
  const metricRelationships = {
    steps: ['workout', 'sleep', 'energy', 'screenTime'],
    workout: ['steps', 'sleep', 'energy'],
    sleep: ['steps', 'workout', 'energy', 'screenTime'],
    energy: ['steps', 'workout', 'sleep'],
    screenTime: ['steps', 'sleep']
  }

  const metricLabels = {
    steps: 'Steps',
    workout: 'Workout (min)',
    sleep: 'Sleep (min)',
    energy: 'Energy (kcal)',
    screenTime: 'Screen Time (min)'
  }

  // Get available columns for second selection based on first
  const getAvailableColumns = (firstColumn) => {
    if (!firstColumn) return []
    return metricRelationships[firstColumn] || []
  }

  // Prepare custom chart data
  const customChartData = selectedColumn1 && selectedColumn2 ? healthData.slice(-dayRange).map(d => {
    const dataPoint = {
      date: formatDate(d.date),
    }
    
    if (selectedColumn1 === 'steps') dataPoint[selectedColumn1] = d.steps
    else if (selectedColumn1 === 'workout') dataPoint[selectedColumn1] = d.workout
    else if (selectedColumn1 === 'sleep') dataPoint[selectedColumn1] = d.sleep
    else if (selectedColumn1 === 'energy') dataPoint[selectedColumn1] = d.energy
    else if (selectedColumn1 === 'screenTime') {
      const dayScreenTime = screenTimeData
        .filter(item => item.date === d.date)
        .reduce((sum, item) => sum + item.minutes, 0)
      dataPoint[selectedColumn1] = dayScreenTime
    }

    if (selectedColumn2 === 'steps') dataPoint[selectedColumn2] = d.steps
    else if (selectedColumn2 === 'workout') dataPoint[selectedColumn2] = d.workout
    else if (selectedColumn2 === 'sleep') dataPoint[selectedColumn2] = d.sleep
    else if (selectedColumn2 === 'energy') dataPoint[selectedColumn2] = d.energy
    else if (selectedColumn2 === 'screenTime') {
      const dayScreenTime = screenTimeData
        .filter(item => item.date === d.date)
        .reduce((sum, item) => sum + item.minutes, 0)
      dataPoint[selectedColumn2] = dayScreenTime
    }

    return dataPoint
  }) : []

  // Generate notifications based on data
  const generateNotifications = () => {
    if (!metrics || !healthData.length) return []
    
    const notifications = []
    const recentData = healthData.slice(-7)
    const today = recentData[recentData.length - 1]
    const avgSteps = recentData.reduce((sum, d) => sum + d.steps, 0) / recentData.length
    const avgSleep = recentData.reduce((sum, d) => sum + d.sleep, 0) / recentData.length

    // Streak notifications
    if (metrics.streaks?.current?.workout >= 3) {
      notifications.push({
        id: 'workout-streak',
        type: 'success',
        icon: '🔥',
        title: 'Workout Streak!',
        message: `You've maintained your workout streak for ${metrics.streaks.current.workout} days! Keep it up!`,
        time: 'Just now'
      })
    }

    if (metrics.streaks?.current?.sleep >= 5) {
      notifications.push({
        id: 'sleep-streak',
        type: 'success',
        icon: '😴',
        title: 'Sleep Streak!',
        message: `Great sleep consistency! ${metrics.streaks.current.sleep} days of good sleep.`,
        time: 'Just now'
      })
    }

    // Goal achievement notifications
    if (today && today.steps >= 10000) {
      notifications.push({
        id: 'steps-goal',
        type: 'success',
        icon: '🎯',
        title: 'Step Goal Achieved!',
        message: `Congratulations! You've reached ${today.steps.toLocaleString()} steps today.`,
        time: 'Today'
      })
    }

    // Warning notifications
    if (avgSteps < 8000 && recentData.length >= 3) {
      notifications.push({
        id: 'steps-warning',
        type: 'warning',
        icon: '⚠️',
        title: 'Low Step Count',
        message: `Your average steps (${Math.round(avgSteps).toLocaleString()}) have been below 8,000 for the past week.`,
        time: 'Today'
      })
    }

    if (avgSleep < 420 && recentData.length >= 3) {
      notifications.push({
        id: 'sleep-warning',
        type: 'warning',
        icon: '⚠️',
        title: 'Sleep Alert',
        message: `Your average sleep (${Math.round(avgSleep / 60)}h ${avgSleep % 60}m) has been below 7 hours.`,
        time: 'Today'
      })
    }

    // Best streak notification
    if (metrics.streaks?.best?.workout > 0 && metrics.streaks?.current?.workout === 0) {
      notifications.push({
        id: 'streak-reminder',
        type: 'info',
        icon: '💪',
        title: 'Start a New Streak!',
        message: `Your best workout streak was ${metrics.streaks.best.workout} days. You can beat it!`,
        time: 'Today'
      })
    }

    return notifications
  }

  const notifications = generateNotifications()

  return (
    <div className="dashboard">
      {/* SVG Gradient for Wellness Ring */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="wellnessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      
      <div className="dashboard-header">
        <div className="header-right">
          <div className="notification-container">
            <button 
              className="notification-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM10 20H14C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20Z" fill="currentColor"/>
                <path d="M18 8C18 4.69 15.31 2 12 2C8.69 2 6 4.69 6 8C6 9.74 5.5 11.37 4.64 12.74C4.34 13.18 4.56 13.75 5.05 13.75H18.95C19.44 13.75 19.66 13.18 19.36 12.74C18.5 11.37 18 9.74 18 8Z" fill="currentColor"/>
              </svg>
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h4>Notifications</h4>
                  <button onClick={() => setNotificationsOpen(false)}>×</button>
                </div>
                <div className="notification-list">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div key={notif.id} className={`notification-item notification-${notif.type}`}>
                        <div className="notification-icon">{notif.icon}</div>
                        <div className="notification-content">
                          <div className="notification-title">{notif.title}</div>
                          <div className="notification-message">{notif.message}</div>
                          <div className="notification-time">{notif.time}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="notification-empty">No new notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="dashboard-title-section">
          <img src="/altu.png" alt="Altu Life" className="dashboard-logo" />
          <h2>Altu Life</h2>
        </div>
        <h2 className="dashboard-title">Health Dashboard</h2>
        <p className="subtitle">Last 90 days of health and screen time data</p>
      </div>

      {/* Summary Cards */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Avg Steps/Day</div>
          <div className="card-value">{metrics.health.avgSteps.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Avg Sleep</div>
          <div className="card-value">
            {Math.floor(metrics.health.avgSleep / 60)}h {metrics.health.avgSleep % 60}m
          </div>
        </div>
        <div className="card">
          <div className="card-label">Avg Energy</div>
          <div className="card-value">{metrics.health.avgEnergy} kcal</div>
        </div>
        <div className="card">
          <div className="card-label">Workout Days</div>
          <div className="card-value">
            {metrics.health.workoutDays}/{metrics.health.totalDays}
          </div>
        </div>
      </div>

      {/* Wellness Score Card */}
      <div className="wellness-score-container">
        <div className="wellness-score-card">
          <div className="wellness-score-header">
            <h3>Wellness Score</h3>
          </div>
          <div className="wellness-score-display">
            <div className="wellness-circle">
              <svg className="wellness-ring" viewBox="0 0 120 120">
                <circle
                  className="wellness-ring-bg"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                />
                <circle
                  className="wellness-ring-progress"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - metrics.wellness.score / 100)}`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="wellness-score-value">
                <span className="wellness-number">{metrics.wellness.score}</span>
                <span className="wellness-max">/100</span>
              </div>
            </div>
            <div className="wellness-breakdown">
              <div className="wellness-metric">
                <span className="wellness-metric-label">Steps</span>
                <div className="wellness-metric-bar">
                  <div 
                    className="wellness-metric-fill" 
                    style={{ width: `${metrics.wellness.stepsScore}%` }}
                  />
                </div>
                <span className="wellness-metric-score">{Math.round(metrics.wellness.stepsScore)}<span className="wellness-metric-unit">%</span></span>
              </div>
              <div className="wellness-metric">
                <span className="wellness-metric-label">Sleep</span>
                <div className="wellness-metric-bar">
                  <div 
                    className="wellness-metric-fill" 
                    style={{ width: `${metrics.wellness.sleepScore}%` }}
                  />
                </div>
                <span className="wellness-metric-score">{Math.round(metrics.wellness.sleepScore)}<span className="wellness-metric-unit">%</span></span>
              </div>
              <div className="wellness-metric">
                <span className="wellness-metric-label">Exercise</span>
                <div className="wellness-metric-bar">
                  <div 
                    className="wellness-metric-fill" 
                    style={{ width: `${metrics.wellness.workoutScore}%` }}
                  />
                </div>
                <span className="wellness-metric-score">{Math.round(metrics.wellness.workoutScore)}<span className="wellness-metric-unit">%</span></span>
              </div>
              <div className="wellness-metric">
                <span className="wellness-metric-label">Screen Time</span>
                <div className="wellness-metric-bar">
                  <div 
                    className="wellness-metric-fill" 
                    style={{ width: `${metrics.wellness.screenTimeScore}%` }}
                  />
                </div>
                <span className="wellness-metric-score">{Math.round(metrics.wellness.screenTimeScore)}<span className="wellness-metric-unit">%</span></span>
              </div>
            </div>
          </div>
          <div className="wellness-weekly">
            <div className="wellness-weekly-info">
              <div className="wellness-weekly-label">This Week</div>
              <div className="wellness-weekly-value">{metrics.wellness.weeklyScore}</div>
            </div>
            <div className="wellness-weekly-info">
              <div className="wellness-weekly-label">90-Day Average</div>
              <div className="wellness-weekly-value">{metrics.wellness.score}</div>
            </div>
            <div className="wellness-weekly-change">
              {metrics.wellness.weeklyChange > 0 && (
                <span className="wellness-change-positive">↑ +{metrics.wellness.weeklyChange}</span>
              )}
              {metrics.wellness.weeklyChange < 0 && (
                <span className="wellness-change-negative">↓ {metrics.wellness.weeklyChange}</span>
              )}
              {metrics.wellness.weeklyChange === 0 && (
                <span className="wellness-change-neutral">→ No change</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Habit Streaks Button */}
      <div className="streaks-container">
        <button 
          className="streaks-toggle-btn"
          onClick={() => setStreaksOpen(!streaksOpen)}
        >
          <span className="streaks-icon">🔥</span>
          <span>Habit Streaks</span>
          <span className="streaks-arrow">{streaksOpen ? '▼' : '▶'}</span>
        </button>
        
        {streaksOpen && metrics.streaks && (
          <div className="streaks-content">
            <div className="streaks-grid">
              <div className="streak-card">
                <div className="streak-header">
                  <span className="streak-icon">💪</span>
                  <h4>Workout</h4>
                </div>
                <div className="streak-value">
                  <span className="streak-number">{metrics.streaks?.current?.workout || 0}</span>
                  <span className="streak-label">days</span>
                </div>
                <div className="streak-best">
                  Best: {metrics.streaks?.best?.workout || 0} days
                </div>
                <div className="streak-progress">
                  <div 
                    className="streak-progress-fill" 
                    style={{ width: `${Math.min(100, (metrics.streaks?.best?.workout || 0) > 0 ? ((metrics.streaks?.current?.workout || 0) / (metrics.streaks?.best?.workout || 1)) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              
              <div className="streak-card">
                <div className="streak-header">
                  <span className="streak-icon">😴</span>
                  <h4>Sleep</h4>
                </div>
                <div className="streak-value">
                  <span className="streak-number">{metrics.streaks?.current?.sleep || 0}</span>
                  <span className="streak-label">days</span>
                </div>
                <div className="streak-best">
                  Best: {metrics.streaks?.best?.sleep || 0} days
                </div>
                <div className="streak-progress">
                  <div 
                    className="streak-progress-fill" 
                    style={{ width: `${Math.min(100, (metrics.streaks?.best?.sleep || 0) > 0 ? ((metrics.streaks?.current?.sleep || 0) / (metrics.streaks?.best?.sleep || 1)) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              
              <div className="streak-card">
                <div className="streak-header">
                  <span className="streak-icon">🚶</span>
                  <h4>Steps</h4>
                </div>
                <div className="streak-value">
                  <span className="streak-number">{metrics.streaks?.current?.steps || 0}</span>
                  <span className="streak-label">days</span>
                </div>
                <div className="streak-best">
                  Best: {metrics.streaks?.best?.steps || 0} days
                </div>
                <div className="streak-progress">
                  <div 
                    className="streak-progress-fill" 
                    style={{ width: `${Math.min(100, (metrics.streaks?.best?.steps || 0) > 0 ? ((metrics.streaks?.current?.steps || 0) / (metrics.streaks?.best?.steps || 1)) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="streaks-info">
              <p>💡 Keep your streaks going! Consistency is key to building healthy habits.</p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Chart Builder */}
      <div className="custom-chart-section">
        <button 
          className="custom-chart-toggle"
          onClick={() => setCustomChartOpen(!customChartOpen)}
        >
          <span>📊</span>
          <span>Create Custom Comparison</span>
          <span className="toggle-arrow">{customChartOpen ? '▼' : '▶'}</span>
        </button>
        {customChartOpen && (
          <div className="custom-chart-builder">
            <div className="custom-chart-controls">
              <div className="custom-chart-select">
                <label>First Metric:</label>
                <select 
                  value={selectedColumn1} 
                  onChange={(e) => {
                    setSelectedColumn1(e.target.value)
                    setSelectedColumn2('')
                  }}
                >
                  <option value="">Select a metric...</option>
                  <option value="steps">Steps</option>
                  <option value="workout">Workout (min)</option>
                  <option value="sleep">Sleep (min)</option>
                  <option value="energy">Energy (kcal)</option>
                  <option value="screenTime">Screen Time (min)</option>
                </select>
              </div>
              <div className="custom-chart-select">
                <label>Second Metric:</label>
                <select 
                  value={selectedColumn2} 
                  onChange={(e) => setSelectedColumn2(e.target.value)}
                  disabled={!selectedColumn1}
                >
                  <option value="">Select a metric...</option>
                  {getAvailableColumns(selectedColumn1).map(col => (
                    <option key={col} value={col}>{metricLabels[col]}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedColumn1 && selectedColumn2 && (
              <div className="custom-chart-display">
                <div className="chart-card">
                  <div className="chart-header">
                    <h3>{metricLabels[selectedColumn1]} vs {metricLabels[selectedColumn2]} (Last {dayRange} Days)</h3>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={customChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey={selectedColumn1} 
                          stroke="#007aff" 
                          strokeWidth={2} 
                          name={metricLabels[selectedColumn1]} 
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey={selectedColumn2} 
                          stroke="#34c759" 
                          strokeWidth={2} 
                          name={metricLabels[selectedColumn2]} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="charts-section">
        <div className="charts-header">
          <h3 className="charts-title">Data Visualizations</h3>
          <div className="day-range-filter">
            <label htmlFor="day-range">Time Period:</label>
            <select 
              id="day-range"
              value={dayRange} 
              onChange={(e) => setDayRange(Number(e.target.value))}
              className="day-range-select"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>
        <div className="charts">
        <div className="chart-card" onClick={() => setExpandedChart('steps')}>
          <div className="chart-header">
            <h3>Steps Over Time (Last {dayRange} Days)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="steps" stroke="#007aff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <button 
              className="chart-ask-icon"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedChart({ title: `Steps Over Time (Last ${dayRange} Days)`, context: 'steps' })
                setModalOpen(true)
              }}
              title="Ask AI about this chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="chart-card" onClick={() => setExpandedChart('steps-vs-exercise')}>
          <div className="chart-header">
            <h3>Steps vs Exercise (Last {dayRange} Days)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="steps" stroke="#007aff" strokeWidth={2} name="Steps" />
                <Line yAxisId="right" type="monotone" dataKey="workout" stroke="#34c759" strokeWidth={2} name="Exercise (min)" />
              </LineChart>
            </ResponsiveContainer>
            <button 
              className="chart-ask-icon"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedChart({ title: `Steps vs Exercise (Last ${dayRange} Days)`, context: 'steps-vs-exercise' })
                setModalOpen(true)
              }}
              title="Ask AI about this chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="chart-card" onClick={() => setExpandedChart('sleep-vs-exercise')}>
          <div className="chart-header">
            <h3>Sleep vs Exercise (Last {dayRange} Days)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="sleep" stroke="#5856d6" strokeWidth={2} name="Sleep (min)" />
                <Line yAxisId="right" type="monotone" dataKey="workout" stroke="#ff9500" strokeWidth={2} name="Exercise (min)" />
              </LineChart>
            </ResponsiveContainer>
            <button 
              className="chart-ask-icon"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedChart({ title: `Sleep vs Exercise (Last ${dayRange} Days)`, context: 'sleep-vs-exercise' })
                setModalOpen(true)
              }}
              title="Ask AI about this chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="chart-card" onClick={() => setExpandedChart('screen-time')}>
          <div className="chart-header">
            <h3>Daily Screen Time (Last {dayRange} Days)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={screenTimeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="minutes" stroke="#ff3b30" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <button 
              className="chart-ask-icon"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedChart({ title: `Daily Screen Time (Last ${dayRange} Days)`, context: 'screen-time' })
                setModalOpen(true)
              }}
              title="Ask AI about this chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="chart-card" onClick={() => setExpandedChart('top-apps')}>
          <div className="chart-header-with-filter" onClick={(e) => e.stopPropagation()}>
            <div className="chart-header">
              <h3>Top Apps by Total Time</h3>
            </div>
            <div className="chart-filter">
              <label htmlFor="category-filter">Filter by Category:</label>
              <select 
                id="category-filter"
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="filter-select"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={filteredTopApps.length > 0 ? filteredTopApps : metrics.screenTime.topApps.slice(0, 8)} 
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="app" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="minutes" fill="#007aff" />
              </BarChart>
            </ResponsiveContainer>
            <button 
              className="chart-ask-icon"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedChart({ title: 'Top Apps by Total Time', context: 'top-apps' })
                setModalOpen(true)
              }}
              title="Ask AI about this chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Chart Question Modal */}
      <ChartQuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        chartTitle={selectedChart.title}
        chartContext={selectedChart.context}
        healthData={healthData}
        screenTimeData={screenTimeData}
        metrics={metrics}
      />

      {/* Expanded Chart Modal */}
      {expandedChart && (
        <div className="expanded-chart-overlay" onClick={() => setExpandedChart(null)}>
          <div className="expanded-chart-modal" onClick={(e) => e.stopPropagation()}>
            <button className="expanded-chart-close" onClick={() => setExpandedChart(null)}>×</button>
            {expandedChart === 'steps' && (
              <>
                <h3>Steps Over Time (Last {dayRange} Days)</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="steps" stroke="#007aff" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            {expandedChart === 'steps-vs-exercise' && (
              <>
                <h3>Steps vs Exercise (Last {dayRange} Days)</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="steps" stroke="#007aff" strokeWidth={2} name="Steps" />
                    <Line yAxisId="right" type="monotone" dataKey="workout" stroke="#34c759" strokeWidth={2} name="Exercise (min)" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            {expandedChart === 'sleep-vs-exercise' && (
              <>
                <h3>Sleep vs Exercise (Last {dayRange} Days)</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="sleep" stroke="#5856d6" strokeWidth={2} name="Sleep (min)" />
                    <Line yAxisId="right" type="monotone" dataKey="workout" stroke="#ff9500" strokeWidth={2} name="Exercise (min)" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            {expandedChart === 'screen-time' && (
              <>
                <h3>Daily Screen Time (Last {dayRange} Days)</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={screenTimeChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="minutes" stroke="#ff3b30" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            {expandedChart === 'top-apps' && (
              <>
                <h3>Top Apps by Total Time</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart 
                    data={filteredTopApps.length > 0 ? filteredTopApps : metrics.screenTime.topApps.slice(0, 8)} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="app" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="minutes" fill="#007aff" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

