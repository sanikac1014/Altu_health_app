// Data loading utility - loads data directly from public folder (in-memory)
const transformHealthData = (data) => data.map(item => ({
  date: item.date,
  steps: item.steps,
  sleep: item.sleep_minutes,
  energy: item.active_energy_kcal,
  workout: item.workout_minutes,
}))

const transformScreenTimeData = (data) => data.map(item => ({
  date: item.date,
  app: item.app,
  minutes: item.minutes,
  category: item.category,
}))

export async function loadHealthData() {
  try {
    const response = await fetch('/health_daily.json')
    if (!response.ok) throw new Error('Failed to load health data')
    return transformHealthData(await response.json())
  } catch (error) {
    console.error('Error loading health data:', error)
    return []
  }
}

export async function loadScreenTimeData() {
  try {
    const response = await fetch('/screentime.json')
    if (!response.ok) throw new Error('Failed to load screen time data')
    return transformScreenTimeData(await response.json())
  } catch (error) {
    console.error('Error loading screen time data:', error)
    return []
  }
}

export function computeMetrics(healthData, screenTimeData) {
  if (!healthData.length || !screenTimeData.length) {
    return {
      health: { avgSteps: 0, avgSleep: 0, avgEnergy: 0, avgWorkout: 0, workoutDays: 0 },
      screenTime: { topApps: [], topCategories: [], dailyTotals: [], avgDaily: 0 },
      wellness: { score: 0, stepsScore: 0, sleepScore: 0, workoutScore: 0, screenTimeScore: 0, weeklyScore: 0, weeklyChange: 0 },
      streaks: { current: { workout: 0, sleep: 0, steps: 0 }, best: { workout: 0, sleep: 0, steps: 0 } }
    }
  }

  // Health metrics
  const totalDays = healthData.length
  const avgSteps = Math.round(healthData.reduce((sum, d) => sum + d.steps, 0) / totalDays)
  const avgSleep = Math.round(healthData.reduce((sum, d) => sum + d.sleep, 0) / totalDays)
  const avgEnergy = Math.round(healthData.reduce((sum, d) => sum + d.energy, 0) / totalDays)
  const avgWorkout = Math.round(healthData.reduce((sum, d) => sum + d.workout, 0) / totalDays)
  const workoutDays = healthData.filter(d => d.workout > 0).length

  // Screen time metrics
  const appTotals = {}
  const categoryTotals = {}
  const dailyTotals = {}

  screenTimeData.forEach(item => {
    appTotals[item.app] = (appTotals[item.app] || 0) + item.minutes
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.minutes
    dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.minutes
  })

  const topApps = Object.entries(appTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([app, minutes]) => ({ app, minutes }))

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, minutes]) => ({ category, minutes }))

  const dailyTotalsArray = Object.entries(dailyTotals)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const avgDaily = Math.round(
    dailyTotalsArray.reduce((sum, d) => sum + d.total, 0) / dailyTotalsArray.length
  )

  // Calculate Wellness Score (0-100)
  // Combines: Steps (30%), Sleep (30%), Exercise (25%), Screen Time (15%)
  // Ideal values for scoring
  const idealSteps = 10000
  const idealSleep = 480 // 8 hours in minutes
  const idealWorkout = 30 // 30 minutes per day
  const idealScreenTime = 240 // 4 hours in minutes
  
  // Streak thresholds (can be different from ideal values)
  const streakWorkoutMin = 15 // at least 15 minutes counts as a workout day
  const streakSleepMin = 420 // 7 hours minimum for sleep streak
  const streakStepsMin = 8000 // 8k steps minimum for steps streak
  
  const stepsScore = Math.min(100, (avgSteps / idealSteps) * 100)
  const sleepScore = Math.min(100, (avgSleep / idealSleep) * 100)
  const workoutScore = Math.min(100, (avgWorkout / idealWorkout) * 100)
  const screenTimeScore = Math.min(100, (idealScreenTime / (avgDaily || 1)) * 100) // Inverse - less is better
  
  const wellnessScore = Math.round(
    (stepsScore * 0.30) +
    (sleepScore * 0.30) +
    (workoutScore * 0.25) +
    (screenTimeScore * 0.15)
  )

  // Calculate weekly comparison (last 7 days vs previous 7 days)
  const last7Days = healthData.slice(-7)
  const previous7Days = healthData.slice(-14, -7)
  
  const last7AvgSteps = last7Days.length > 0 ? Math.round(last7Days.reduce((sum, d) => sum + d.steps, 0) / last7Days.length) : 0
  const last7AvgSleep = last7Days.length > 0 ? Math.round(last7Days.reduce((sum, d) => sum + d.sleep, 0) / last7Days.length) : 0
  const last7AvgWorkout = last7Days.length > 0 ? Math.round(last7Days.reduce((sum, d) => sum + d.workout, 0) / last7Days.length) : 0
  
  const prev7AvgSteps = previous7Days.length > 0 ? Math.round(previous7Days.reduce((sum, d) => sum + d.steps, 0) / previous7Days.length) : 0
  const prev7AvgSleep = previous7Days.length > 0 ? Math.round(previous7Days.reduce((sum, d) => sum + d.sleep, 0) / previous7Days.length) : 0
  const prev7AvgWorkout = previous7Days.length > 0 ? Math.round(previous7Days.reduce((sum, d) => sum + d.workout, 0) / previous7Days.length) : 0
  
  const last7StepsScore = Math.min(100, (last7AvgSteps / idealSteps) * 100)
  const last7SleepScore = Math.min(100, (last7AvgSleep / idealSleep) * 100)
  const last7WorkoutScore = Math.min(100, (last7AvgWorkout / idealWorkout) * 100)
  
  // Calculate last 7 days screen time
  const last7Dates = last7Days.map(d => d.date)
  const prev7Dates = previous7Days.map(d => d.date)
  
  const last7ScreenTimeData = screenTimeData.filter(item => last7Dates.includes(item.date))
  const prev7ScreenTimeData = screenTimeData.filter(item => prev7Dates.includes(item.date))
  
  const last7ScreenTimeTotals = {}
  last7ScreenTimeData.forEach(item => {
    last7ScreenTimeTotals[item.date] = (last7ScreenTimeTotals[item.date] || 0) + item.minutes
  })
  const last7AvgScreenTime = Object.keys(last7ScreenTimeTotals).length > 0 
    ? Math.round(Object.values(last7ScreenTimeTotals).reduce((sum, total) => sum + total, 0) / Object.keys(last7ScreenTimeTotals).length)
    : 0
  
  const prev7ScreenTimeTotals = {}
  prev7ScreenTimeData.forEach(item => {
    prev7ScreenTimeTotals[item.date] = (prev7ScreenTimeTotals[item.date] || 0) + item.minutes
  })
  const prev7AvgScreenTime = Object.keys(prev7ScreenTimeTotals).length > 0
    ? Math.round(Object.values(prev7ScreenTimeTotals).reduce((sum, total) => sum + total, 0) / Object.keys(prev7ScreenTimeTotals).length)
    : 0
  const last7ScreenTimeScore = Math.min(100, (idealScreenTime / (last7AvgScreenTime || 1)) * 100)
  
  const last7WellnessScore = Math.round(
    (last7StepsScore * 0.30) +
    (last7SleepScore * 0.30) +
    (last7WorkoutScore * 0.25) +
    (last7ScreenTimeScore * 0.15)
  )
  
  // Compare this week's score to overall average
  const weeklyChange = last7WellnessScore - wellnessScore

  // Calculate Habit Streaks
  // Calculate current streaks (from most recent day backwards)
  const sortedHealthData = [...healthData].sort((a, b) => new Date(b.date) - new Date(a.date))
  
  let workoutStreak = 0
  let sleepStreak = 0
  let stepsStreak = 0
  
  // Workout streak
  for (const day of sortedHealthData) {
    if (day.workout >= streakWorkoutMin) {
      workoutStreak++
    } else {
      break
    }
  }
  
  // Sleep streak
  for (const day of sortedHealthData) {
    if (day.sleep >= streakSleepMin) {
      sleepStreak++
    } else {
      break
    }
  }
  
  // Steps streak
  for (const day of sortedHealthData) {
    if (day.steps >= streakStepsMin) {
      stepsStreak++
    } else {
      break
    }
  }
  
  // Calculate best streaks (all time)
  let bestWorkoutStreak = 0
  let bestSleepStreak = 0
  let bestStepsStreak = 0
  let currentWorkoutStreak = 0
  let currentSleepStreak = 0
  let currentStepsStreak = 0
  
  const sortedByDate = [...healthData].sort((a, b) => new Date(a.date) - new Date(b.date))
  
  for (const day of sortedByDate) {
    // Workout
    if (day.workout >= streakWorkoutMin) {
      currentWorkoutStreak++
      bestWorkoutStreak = Math.max(bestWorkoutStreak, currentWorkoutStreak)
    } else {
      currentWorkoutStreak = 0
    }
    
    // Sleep
    if (day.sleep >= streakSleepMin) {
      currentSleepStreak++
      bestSleepStreak = Math.max(bestSleepStreak, currentSleepStreak)
    } else {
      currentSleepStreak = 0
    }
    
    // Steps
    if (day.steps >= streakStepsMin) {
      currentStepsStreak++
      bestStepsStreak = Math.max(bestStepsStreak, currentStepsStreak)
    } else {
      currentStepsStreak = 0
    }
  }

  return {
    health: { avgSteps, avgSleep, avgEnergy, avgWorkout, workoutDays, totalDays },
    screenTime: { topApps, topCategories, dailyTotals: dailyTotalsArray, avgDaily },
    wellness: { 
      score: wellnessScore, 
      stepsScore, 
      sleepScore, 
      workoutScore, 
      screenTimeScore,
      weeklyScore: last7WellnessScore,
      weeklyChange
    },
    streaks: {
      current: {
        workout: workoutStreak,
        sleep: sleepStreak,
        steps: stepsStreak
      },
      best: {
        workout: bestWorkoutStreak,
        sleep: bestSleepStreak,
        steps: bestStepsStreak
      }
    }
  }
}
