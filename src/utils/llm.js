import OpenAI from 'openai'

let openai = null

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY in .env file')
    }
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    })
  }
  return openai
}

// Helper to determine if a date is a weekend
function isWeekend(dateStr) {
  const date = new Date(dateStr)
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

// Extract app name from question (case-insensitive, handles variations like "Twitter" vs "X")
function extractAppName(question, screenTimeData) {
  const questionLower = question.toLowerCase()
  const allApps = [...new Set(screenTimeData.map(item => item.app))]
  
  // Check for common app name variations
  const appVariations = {
    'twitter': ['twitter', 'x app', 'x'],
    'instagram': ['instagram', 'ig'],
    'facebook': ['facebook', 'fb'],
    'youtube': ['youtube', 'yt'],
    'tiktok': ['tiktok', 'tt'],
    'snapchat': ['snapchat', 'snap'],
    'whatsapp': ['whatsapp', 'wa'],
    'messenger': ['messenger', 'fb messenger'],
  }
  
  // First check for exact matches
  for (const app of allApps) {
    if (questionLower.includes(app.toLowerCase())) {
      return app
    }
  }
  
  // Then check for variations
  for (const [key, variations] of Object.entries(appVariations)) {
    if (variations.some(v => questionLower.includes(v))) {
      // Find the actual app name in the data
      const matchedApp = allApps.find(app => 
        app.toLowerCase().includes(key) || key.includes(app.toLowerCase())
      )
      if (matchedApp) return matchedApp
    }
  }
  
  return null
}

// Compute weekday vs weekend statistics for a specific app
function computeAppWeekdayWeekendStats(appName, screenTimeData) {
  const appData = screenTimeData.filter(item => 
    item.app.toLowerCase() === appName.toLowerCase()
  )
  
  const weekdayData = []
  const weekendData = []
  
  appData.forEach(item => {
    if (isWeekend(item.date)) {
      weekendData.push({ date: item.date, minutes: item.minutes })
    } else {
      weekdayData.push({ date: item.date, minutes: item.minutes })
    }
  })
  
  const weekdayTotal = weekdayData.reduce((sum, d) => sum + d.minutes, 0)
  const weekendTotal = weekendData.reduce((sum, d) => sum + d.minutes, 0)
  const weekdayAvg = weekdayData.length > 0 ? Math.round(weekdayTotal / weekdayData.length) : 0
  const weekendAvg = weekendData.length > 0 ? Math.round(weekendTotal / weekendData.length) : 0
  
  return {
    appName,
    weekday: {
      days: weekdayData.length,
      totalMinutes: weekdayTotal,
      avgMinutes: weekdayAvg,
      dailyBreakdown: weekdayData.sort((a, b) => a.date.localeCompare(b.date))
    },
    weekend: {
      days: weekendData.length,
      totalMinutes: weekendTotal,
      avgMinutes: weekendAvg,
      dailyBreakdown: weekendData.sort((a, b) => a.date.localeCompare(b.date))
    }
  }
}

// Compute trend statistics for health metrics
function computeTrendStats(healthData, metric) {
  const recent30 = healthData.slice(-30)
  const previous30 = healthData.slice(-60, -30)
  
  if (previous30.length === 0) return null
  
  const recentAvg = Math.round(
    recent30.reduce((sum, d) => sum + d[metric], 0) / recent30.length
  )
  const previousAvg = Math.round(
    previous30.reduce((sum, d) => sum + d[metric], 0) / previous30.length
  )
  
  const change = recentAvg - previousAvg
  const percentChange = previousAvg > 0 ? Math.round((change / previousAvg) * 100) : 0
  
  return {
    recent30Days: recentAvg,
    previous30Days: previousAvg,
    change,
    percentChange,
    trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
    dailyValues: recent30.map(d => ({ date: d.date, value: d[metric] }))
  }
}

// Compute all app totals (not just top 10)
function computeAllAppTotals(screenTimeData) {
  const appTotals = {}
  screenTimeData.forEach(item => {
    appTotals[item.app] = (appTotals[item.app] || 0) + item.minutes
  })
  
  return Object.entries(appTotals)
    .map(([app, minutes]) => ({ app, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

// Extract computed insights based on question type
function extractComputedInsights(question, metrics, healthData, screenTimeData) {
  const questionLower = question.toLowerCase()
  const insights = {}
  
  // Check for "most/least used app" questions - compute ALL apps
  if ((questionLower.includes('most') || questionLower.includes('least')) && 
      (questionLower.includes('app') || questionLower.includes('use'))) {
    const allApps = computeAllAppTotals(screenTimeData)
    const mostUsed = allApps[0] // Already sorted descending
    const leastUsed = allApps[allApps.length - 1] // Last one is least
    
    if (questionLower.includes('most')) {
      insights.mostUsedApp = mostUsed
      // Also include top 5 for context
      insights.topApps = allApps.slice(0, 5)
    }
    if (questionLower.includes('least')) {
      insights.leastUsedApp = leastUsed
      // Also include bottom 5 for context
      insights.bottomApps = allApps.slice(-5).reverse()
    }
  }
  
  // Check for app-specific weekday/weekend questions
  const appName = extractAppName(question, screenTimeData)
  if (appName && (questionLower.includes('weekday') || questionLower.includes('weekend') || 
      questionLower.includes('week day') || questionLower.includes('week end'))) {
    insights.appWeekdayWeekend = computeAppWeekdayWeekendStats(appName, screenTimeData)
  }
  
  // Check for trend questions
  if (questionLower.includes('trend') || questionLower.includes('change') || 
      questionLower.includes('increase') || questionLower.includes('decrease')) {
    if (questionLower.includes('step')) {
      insights.stepsTrend = computeTrendStats(healthData, 'steps')
    }
    if (questionLower.includes('sleep')) {
      insights.sleepTrend = computeTrendStats(healthData, 'sleep')
    }
    if (questionLower.includes('workout') || questionLower.includes('exercise')) {
      insights.workoutTrend = computeTrendStats(healthData, 'workout')
    }
  }
  
  // Check for relationship questions (exercise vs sleep)
  if ((questionLower.includes('exercise') || questionLower.includes('workout')) && 
      questionLower.includes('sleep')) {
    const recent30 = healthData.slice(-30)
    const workoutDays = recent30.filter(d => d.workout > 0)
    const noWorkoutDays = recent30.filter(d => d.workout === 0)
    
    const avgSleepWithWorkout = workoutDays.length > 0
      ? Math.round(workoutDays.reduce((sum, d) => sum + d.sleep, 0) / workoutDays.length)
      : 0
    const avgSleepNoWorkout = noWorkoutDays.length > 0
      ? Math.round(noWorkoutDays.reduce((sum, d) => sum + d.sleep, 0) / noWorkoutDays.length)
      : 0
    
    insights.exerciseSleepRelationship = {
      avgSleepWithWorkout,
      avgSleepNoWorkout,
      difference: avgSleepWithWorkout - avgSleepNoWorkout,
      workoutDays: workoutDays.length,
      noWorkoutDays: noWorkoutDays.length
    }
  }
  
  return insights
}

// Chart-specific question function with focused context
export async function askChartQuestion(question, chartTitle, chartContext, metrics, healthData, screenTimeData) {
  const client = getOpenAIClient()

  // Extract computed insights from the data
  const computedInsights = extractComputedInsights(question, metrics, healthData, screenTimeData)

  // Prepare chart-specific data based on chart context
  const formatDate = (dateStr) => 
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  const recent30Days = healthData.slice(-30)
  let chartSpecificData = ''

  // Focus on chart-specific metrics
  if (chartContext === 'steps') {
    const stepsData = recent30Days.map(d => ({ date: formatDate(d.date), steps: d.steps }))
    const avgSteps = Math.round(stepsData.reduce((sum, d) => sum + d.steps, 0) / stepsData.length)
    const maxSteps = Math.max(...stepsData.map(d => d.steps))
    const minSteps = Math.min(...stepsData.map(d => d.steps))
    chartSpecificData = `\nCHART-SPECIFIC DATA (Steps Over Time - Last 30 Days):\n- Average steps: ${avgSteps}\n- Maximum steps: ${maxSteps}\n- Minimum steps: ${minSteps}\n- Daily breakdown: ${stepsData.map(d => `${d.date}: ${d.steps}`).join(', ')}\n`
  } else if (chartContext === 'steps-vs-exercise') {
    const comparisonData = recent30Days.map(d => ({ 
      date: formatDate(d.date), 
      steps: d.steps, 
      exercise: d.workout 
    }))
    const avgSteps = Math.round(comparisonData.reduce((sum, d) => sum + d.steps, 0) / comparisonData.length)
    const avgExercise = Math.round(comparisonData.reduce((sum, d) => sum + d.exercise, 0) / comparisonData.length)
    chartSpecificData = `\nCHART-SPECIFIC DATA (Steps vs Exercise - Last 30 Days):\n- Average steps: ${avgSteps}\n- Average exercise: ${avgExercise} min\n- Daily breakdown: ${comparisonData.map(d => `${d.date}: ${d.steps} steps, ${d.exercise} min exercise`).join('; ')}\n`
  } else if (chartContext === 'sleep-vs-exercise') {
    const comparisonData = recent30Days.map(d => ({ 
      date: formatDate(d.date), 
      sleep: d.sleep, 
      exercise: d.workout 
    }))
    const avgSleep = Math.round(comparisonData.reduce((sum, d) => sum + d.sleep, 0) / comparisonData.length)
    const avgExercise = Math.round(comparisonData.reduce((sum, d) => sum + d.exercise, 0) / comparisonData.length)
    chartSpecificData = `\nCHART-SPECIFIC DATA (Sleep vs Exercise - Last 30 Days):\n- Average sleep: ${avgSleep} min (${Math.floor(avgSleep / 60)}h ${avgSleep % 60}m)\n- Average exercise: ${avgExercise} min\n- Daily breakdown: ${comparisonData.map(d => `${d.date}: ${d.sleep} min sleep, ${d.exercise} min exercise`).join('; ')}\n`
  } else if (chartContext === 'screen-time') {
    const screenTimeDaily = metrics.screenTime.dailyTotals.slice(-30).map(d => ({
      date: formatDate(d.date),
      minutes: d.total
    }))
    const avgScreenTime = Math.round(screenTimeDaily.reduce((sum, d) => sum + d.minutes, 0) / screenTimeDaily.length)
    const maxScreenTime = Math.max(...screenTimeDaily.map(d => d.minutes))
    const minScreenTime = Math.min(...screenTimeDaily.map(d => d.minutes))
    chartSpecificData = `\nCHART-SPECIFIC DATA (Daily Screen Time - Last 30 Days):\n- Average screen time: ${avgScreenTime} min (${Math.floor(avgScreenTime / 60)}h ${avgScreenTime % 60}m)\n- Maximum: ${maxScreenTime} min\n- Minimum: ${minScreenTime} min\n- Daily breakdown: ${screenTimeDaily.map(d => `${d.date}: ${d.minutes} min`).join(', ')}\n`
  } else if (chartContext === 'top-apps') {
    const allApps = computeAllAppTotals(screenTimeData)
    chartSpecificData = `\nCHART-SPECIFIC DATA (Top Apps by Total Time):\n- All apps with usage: ${allApps.map(a => `${a.app} (${a.minutes} min)`).join(', ')}\n- Top 10 apps: ${allApps.slice(0, 10).map(a => `${a.app}: ${a.minutes} min`).join(', ')}\n`
  }

  const formatSleep = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  const formatApp = (app) => `${app.app} (${app.minutes} min)`
  const formatCategory = (cat) => `${cat.category} (${cat.minutes} min)`

  // Build computed insights section (reuse existing logic)
  let computedInsightsText = ''
  if (Object.keys(computedInsights).length > 0) {
    computedInsightsText = '\n\nCOMPUTED INSIGHTS (extracted directly from data):\n'
    
    if (computedInsights.mostUsedApp) {
      const { app, minutes } = computedInsights.mostUsedApp
      computedInsightsText += `\nMOST USED APP (EXACT ANSWER):\n- App: ${app}\n- Total minutes: ${minutes} min\n`
    }
    
    if (computedInsights.leastUsedApp) {
      const { app, minutes } = computedInsights.leastUsedApp
      computedInsightsText += `\nLEAST USED APP (EXACT ANSWER):\n- App: ${app}\n- Total minutes: ${minutes} min\n`
    }
    
    if (computedInsights.appWeekdayWeekend) {
      const { appName, weekday, weekend } = computedInsights.appWeekdayWeekend
      computedInsightsText += `\n${appName} - Weekday vs Weekend Usage:\n- Weekdays: ${weekday.avgMinutes} min/day avg\n- Weekends: ${weekend.avgMinutes} min/day avg\n`
    }
    
    if (computedInsights.stepsTrend) {
      const { recent30Days, previous30Days, change, percentChange, trend } = computedInsights.stepsTrend
      computedInsightsText += `\nSteps Trend: ${trend} (${change > 0 ? '+' : ''}${change} steps, ${percentChange > 0 ? '+' : ''}${percentChange}%)\n`
    }
    
    if (computedInsights.exerciseSleepRelationship) {
      const { avgSleepWithWorkout, avgSleepNoWorkout, difference } = computedInsights.exerciseSleepRelationship
      computedInsightsText += `\nExercise vs Sleep: ${difference > 0 ? '+' : ''}${difference} min difference (workout days: ${avgSleepWithWorkout} min, non-workout: ${avgSleepNoWorkout} min)\n`
    }
  }

  const prompt = `You are a health data assistant. Answer questions about a specific chart: "${chartTitle}".

${chartSpecificData}

User question: ${question}
${computedInsightsText}

IMPORTANT: Focus your answer specifically on the chart data shown above. Be concise, specific, and use the exact numbers from the chart-specific data.`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful health data assistant. Answer questions about the specific chart: "${chartTitle}". Focus on the chart-specific data provided.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 250,
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to get answer. Please check your API key and try again.')
  }
}

export async function askQuestion(question, metrics, healthData, screenTimeData) {
  const client = getOpenAIClient()

  // Extract computed insights from the data
  const computedInsights = extractComputedInsights(question, metrics, healthData, screenTimeData)

  // Prepare app usage by date for additional context
  const appUsageByDate = {}
  screenTimeData.forEach(item => {
    if (!appUsageByDate[item.date]) {
      appUsageByDate[item.date] = {}
    }
    if (!appUsageByDate[item.date][item.app]) {
      appUsageByDate[item.date][item.app] = 0
    }
    appUsageByDate[item.date][item.app] += item.minutes
  })

  // Prepare statistics for the LLM
  const stats = {
    health: {
      avgSteps: metrics.health.avgSteps,
      avgSleep: metrics.health.avgSleep,
      avgEnergy: metrics.health.avgEnergy,
      avgWorkout: metrics.health.avgWorkout,
      workoutDays: metrics.health.workoutDays,
      totalDays: metrics.health.totalDays,
      recent30Days: {
        steps: healthData.slice(-30).map(d => ({ date: d.date, value: d.steps })),
        sleep: healthData.slice(-30).map(d => ({ date: d.date, value: d.sleep })),
        workout: healthData.slice(-30).map(d => ({ date: d.date, value: d.workout })),
      }
    },
    screenTime: {
      topApps: metrics.screenTime.topApps.slice(0, 10),
      topCategories: metrics.screenTime.topCategories,
      avgDaily: Math.round(
        metrics.screenTime.dailyTotals.reduce((sum, d) => sum + d.total, 0) / 
        metrics.screenTime.dailyTotals.length
      ),
      appUsageByDate: Object.entries(appUsageByDate).slice(-30).map(([date, apps]) => ({
        date,
        isWeekend: isWeekend(date),
        apps
      }))
    }
  }

  const formatSleep = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  const formatApp = (app) => `${app.app} (${app.minutes} min)`
  const formatCategory = (cat) => `${cat.category} (${cat.minutes} min)`

  // Build computed insights section
  let computedInsightsText = ''
  if (Object.keys(computedInsights).length > 0) {
    computedInsightsText = '\n\nCOMPUTED INSIGHTS (extracted directly from data):\n'
    
    // Most/Least used app - EXACT ANSWER
    if (computedInsights.mostUsedApp) {
      const { app, minutes } = computedInsights.mostUsedApp
      computedInsightsText += `\nMOST USED APP (EXACT ANSWER):\n`
      computedInsightsText += `- App: ${app}\n`
      computedInsightsText += `- Total minutes: ${minutes} min\n`
      if (computedInsights.topApps) {
        computedInsightsText += `- Top 5 apps for reference: ${computedInsights.topApps.map(a => `${a.app} (${a.minutes} min)`).join(', ')}\n`
      }
    }
    
    if (computedInsights.leastUsedApp) {
      const { app, minutes } = computedInsights.leastUsedApp
      computedInsightsText += `\nLEAST USED APP (EXACT ANSWER):\n`
      computedInsightsText += `- App: ${app}\n`
      computedInsightsText += `- Total minutes: ${minutes} min\n`
      if (computedInsights.bottomApps) {
        computedInsightsText += `- Bottom 5 apps for reference: ${computedInsights.bottomApps.map(a => `${a.app} (${a.minutes} min)`).join(', ')}\n`
      }
    }
    
    if (computedInsights.appWeekdayWeekend) {
      const { appName, weekday, weekend } = computedInsights.appWeekdayWeekend
      computedInsightsText += `\n${appName} - Weekday vs Weekend Usage:\n`
      computedInsightsText += `- Weekdays (${weekday.days} days): Average ${weekday.avgMinutes} min/day, Total ${weekday.totalMinutes} min\n`
      computedInsightsText += `- Weekends (${weekend.days} days): Average ${weekend.avgMinutes} min/day, Total ${weekend.totalMinutes} min\n`
      computedInsightsText += `- Difference: ${weekend.avgMinutes - weekday.avgMinutes} min (${weekend.avgMinutes > weekday.avgMinutes ? 'more' : 'less'} on weekends)\n`
      computedInsightsText += `- Weekday breakdown: ${weekday.dailyBreakdown.map(d => `${d.date}: ${d.minutes} min`).join(', ')}\n`
      computedInsightsText += `- Weekend breakdown: ${weekend.dailyBreakdown.map(d => `${d.date}: ${d.minutes} min`).join(', ')}\n`
    }
    
    if (computedInsights.stepsTrend) {
      const { recent30Days, previous30Days, change, percentChange, trend } = computedInsights.stepsTrend
      computedInsightsText += `\nSteps Trend (Last 30 days vs Previous 30 days):\n`
      computedInsightsText += `- Recent 30 days average: ${recent30Days} steps/day\n`
      computedInsightsText += `- Previous 30 days average: ${previous30Days} steps/day\n`
      computedInsightsText += `- Change: ${change > 0 ? '+' : ''}${change} steps (${percentChange > 0 ? '+' : ''}${percentChange}%) - ${trend}\n`
    }
    
    if (computedInsights.sleepTrend) {
      const { recent30Days, previous30Days, change, percentChange, trend } = computedInsights.sleepTrend
      computedInsightsText += `\nSleep Trend (Last 30 days vs Previous 30 days):\n`
      computedInsightsText += `- Recent 30 days average: ${recent30Days} min/day (${formatSleep(recent30Days)})\n`
      computedInsightsText += `- Previous 30 days average: ${previous30Days} min/day (${formatSleep(previous30Days)})\n`
      computedInsightsText += `- Change: ${change > 0 ? '+' : ''}${change} min (${percentChange > 0 ? '+' : ''}${percentChange}%) - ${trend}\n`
    }
    
    if (computedInsights.workoutTrend) {
      const { recent30Days, previous30Days, change, percentChange, trend } = computedInsights.workoutTrend
      computedInsightsText += `\nWorkout Trend (Last 30 days vs Previous 30 days):\n`
      computedInsightsText += `- Recent 30 days average: ${recent30Days} min/day\n`
      computedInsightsText += `- Previous 30 days average: ${previous30Days} min/day\n`
      computedInsightsText += `- Change: ${change > 0 ? '+' : ''}${change} min (${percentChange > 0 ? '+' : ''}${percentChange}%) - ${trend}\n`
    }
    
    if (computedInsights.exerciseSleepRelationship) {
      const { avgSleepWithWorkout, avgSleepNoWorkout, difference, workoutDays, noWorkoutDays } = computedInsights.exerciseSleepRelationship
      computedInsightsText += `\nExercise vs Sleep Relationship:\n`
      computedInsightsText += `- Average sleep on workout days: ${avgSleepWithWorkout} min (${formatSleep(avgSleepWithWorkout)}) (${workoutDays} days)\n`
      computedInsightsText += `- Average sleep on non-workout days: ${avgSleepNoWorkout} min (${formatSleep(avgSleepNoWorkout)}) (${noWorkoutDays} days)\n`
      computedInsightsText += `- Difference: ${difference > 0 ? '+' : ''}${difference} min (${difference > 0 ? 'more' : 'less'} sleep on workout days)\n`
    }
  }

  const prompt = `You are a health data assistant. Answer questions about health and screen time data.

Health Data (last 90 days):
- Average steps per day: ${stats.health.avgSteps}
- Average sleep per day: ${stats.health.avgSleep} minutes (${formatSleep(stats.health.avgSleep)})
- Average active energy per day: ${stats.health.avgEnergy} kcal
- Average workout minutes per day: ${stats.health.avgWorkout}
- Days with workouts: ${stats.health.workoutDays} out of ${stats.health.totalDays}
- Recent 30 days steps (date, value): ${stats.health.recent30Days.steps.map(d => `${d.date}:${d.value}`).join(', ')}
- Recent 30 days sleep (date, minutes): ${stats.health.recent30Days.sleep.map(d => `${d.date}:${d.value}`).join(', ')}
- Recent 30 days workout (date, minutes): ${stats.health.recent30Days.workout.map(d => `${d.date}:${d.value}`).join(', ')}

Screen Time Data (last 90 days):
- Top apps: ${stats.screenTime.topApps.map(formatApp).join(', ')}
- Top categories: ${stats.screenTime.topCategories.map(formatCategory).join(', ')}
- Average daily screen time: ${stats.screenTime.avgDaily} minutes
${computedInsightsText}

User question: ${question}

CRITICAL INSTRUCTIONS:
- If the COMPUTED INSIGHTS section contains an EXACT ANSWER (marked with "EXACT ANSWER"), you MUST use that exact answer. Do NOT guess, estimate, or use approximate values from other sections.
- The EXACT ANSWER sections are calculated directly from ALL the data in the JSON files - they are 100% accurate and complete.
- For questions about "most used app" or "least used app", the EXACT ANSWER above is the definitive answer. Use the app name and minutes exactly as shown.
- Do NOT use the "Top apps" list from the Screen Time Data section for these questions - that only shows top 10, not all apps.
- Be specific with data when relevant. Keep it concise and friendly.`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful health data assistant. Answer questions accurately using the provided statistics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to get answer. Please check your API key and try again.')
  }
}
