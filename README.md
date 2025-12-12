# Altu Life - Health Dashboard

A modern React health dashboard that visualizes HealthKit and Screen Time data with AI-powered Q&A capabilities. Built as a purely in-memory application that loads data directly from JSON files.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up OpenAI API key (optional, for Ask Altu feature):**
   - Create a `.env` file in the root directory
   - Add: `REACT_APP_OPENAI_API_KEY=your_key_here`
   - If no API key is provided, the Ask Altu feature will show an error message with instructions

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - The app will automatically load data from `public/health_daily.json` and `public/screentime.json`

## Features

### Health Dashboard
- **Summary Cards**: Key metrics including average steps, sleep, energy, and workout days
- **Wellness Score**: Composite health score (0-100) based on steps, sleep, exercise, and screen time with weekly comparison
- **Habit Streaks**: Track current and best streaks for workouts, sleep, and steps
- **Interactive Charts**: 
  - Steps over time
  - Steps vs Exercise comparison
  - Sleep vs Exercise comparison
  - Daily Screen Time
  - Top Apps by Total Time (with category filter)
- **Day Range Filter**: View data for last 7, 30, or 90 days
- **Chart Expansion**: Click any chart to view it in full-screen modal
- **Custom Chart Builder**: Create custom comparisons between related metrics with smart filtering
- **Chart-Specific AI**: Ask AI questions about individual charts via icon buttons

### Ask Altu
- Natural language questions about your health data
- Powered by OpenAI GPT-4o-mini
- Pre-computes exact answers for specific queries (most/least used apps, trends, relationships)
- Example questions included for easy testing

### Notifications
- Real-time notifications based on actual data
- Streak achievements and reminders
- Goal completion alerts
- Health warnings (low steps, insufficient sleep)

## Project Structure

```
src/
  ├── pages/
  │   ├── Dashboard.js          # Main dashboard with all visualizations
  │   ├── Dashboard.css          # Dashboard styles
  │   ├── AskAltu.js            # AI Q&A page
  │   └── AskAltu.css           # Ask Altu styles
  ├── components/
  │   ├── ChartQuestionModal.js # Modal for chart-specific questions
  │   └── ChartQuestionModal.css
  ├── utils/
  │   ├── data.js               # Data loading and metric computation
  │   └── llm.js                # OpenAI integration with pre-computation
  ├── App.js                    # Main app component with navigation
  ├── App.css                   # Global app styles
  └── index.js                  # Entry point

public/
  ├── health_daily.json         # HealthKit data (90 days)
  ├── screentime.json           # Screen Time data (90 days)
  └── altu.png                  # Logo
```

## Tech Stack

- **React 18** - UI framework
- **Create React App** - Build tool
- **Recharts** - Charting library for data visualization
- **OpenAI API (GPT-4o-mini)** - LLM for natural language Q&A
- **CSS3** - Custom styling with gradients and animations

## Architecture

### Data Flow
- Data is loaded directly from JSON files in the `public` folder
- All processing happens in-memory in the browser
- No backend server required - purely client-side application
- Metrics are computed on-the-fly from raw data

### Key Features Implementation
- **Wellness Score**: Weighted composite score (Steps 30%, Sleep 30%, Exercise 25%, Screen Time 15%)
- **Habit Streaks**: Calculates current and best streaks based on defined thresholds
- **Smart Chart Filtering**: Custom chart builder only allows meaningful metric comparisons
- **Pre-computed Insights**: LLM receives exact answers for specific queries before generating response
- **Responsive Design**: Mobile-friendly with adaptive layouts

## Environment Variables

Create a `.env` file in the root directory:
```
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## Notes

- All data processing happens client-side
- No backend server required
- OpenAI API calls are made directly from the browser
- The app works without an API key, but Ask Altu feature will be disabled
