import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { MoodTrendDay } from './moodTrend'
import { shortDate } from './reflectionData'
import './moodTrend.css'

function trendPath(days: MoodTrendDay[], key: 'score' | 'average') {
  let connected = false
  const commands: string[] = []
  days.forEach((day, index) => {
    const value = day[key]
    if (value === null) {
      connected = false
      return
    }
    commands.push(`${connected ? 'L' : 'M'}${index + 0.5},${100 - value}`)
    connected = true
  })
  return commands.join(' ')
}

export function MoodTrendChart({ days, activeDate, onChooseDate }: {
  days: MoodTrendDay[]
  activeDate: string
  onChooseDate: (date: string) => void
}) {
  const [showAverage, setShowAverage] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedIndex = days.findIndex((day) => day.date === activeDate)
  const selected = days[selectedIndex]
  const hasScores = days.some((day) => day.score !== null)

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || selectedIndex < 0) return
    const revealDate = () => {
      if (!scroll.clientWidth) return
      const column = scroll.scrollWidth / days.length
      const start = selectedIndex * column
      if (start < scroll.scrollLeft || start + column > scroll.scrollLeft + scroll.clientWidth) {
        scroll.scrollLeft = start + (column - scroll.clientWidth) / 2
      }
    }
    revealDate()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(revealDate)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [days.length, hasScores, selectedIndex])

  if (!hasScores) return null

  return (
    <section className="mood-trend" aria-label="心情走向">
      <header>
        <h3>心情走向</h3>
        <button type="button" className="mood-trend-average-toggle" aria-pressed={showAverage} onClick={() => setShowAverage(!showAverage)}>
          7 日均线
        </button>
      </header>
      {selected && (
        <div className="mood-trend-readout" aria-live="polite">
          <time dateTime={selected.date}>{shortDate(selected.date)}</time>
          {selected.score === null ? <span>未记录</span> : <>
            <strong>{Math.round(selected.score)} 分</strong>
            <span>已记 {selected.periods}/3 时段</span>
            {showAverage && selected.average !== null && (
              <small>近 7 日均值 {Math.round(selected.average)} · {selected.averageDays} 天有记录</small>
            )}
          </>}
        </div>
      )}
      <div className="mood-trend-chart">
        <div className="mood-trend-scale" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
        <div className="mood-trend-scroll" ref={scrollRef}>
          <div className="mood-trend-track" style={{ '--mood-trend-days': days.length } as CSSProperties}>
            <div className="mood-trend-plot">
              <svg aria-hidden="true" viewBox={`0 0 ${days.length} 100`} preserveAspectRatio="none">
                {[0, 50, 100].map((y) => (
                  <line key={y} className={y === 50 ? 'baseline' : undefined} x1="0" x2={days.length} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
                ))}
                {showAverage && <path className="mood-trend-average-path" d={trendPath(days, 'average')} vectorEffect="non-scaling-stroke" />}
                <path className="mood-trend-score-path" d={trendPath(days, 'score')} vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="mood-trend-columns">
                {days.map((day) => {
                  if (day.score === null) return <span key={day.date} aria-hidden="true" />
                  const label = `${day.date} 心情走向 ${Math.round(day.score)} 分，已记 ${day.periods}/3 时段`
                  return (
                    <button type="button" key={day.date} aria-label={label} title={label} aria-pressed={day.date === activeDate} onClick={() => onChooseDate(day.date)}>
                      {showAverage && day.average !== null && <i className="mood-trend-average-dot" style={{ top: `${100 - day.average}%` }} />}
                      <i className="mood-trend-score-dot" data-complete={day.periods === 3} style={{ top: `${100 - day.score}%` }} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mood-trend-dates" aria-hidden="true">
              {days.map((day, index) => (
                <time key={day.date} dateTime={day.date} className={day.date === activeDate ? 'selected' : undefined}>
                  {(days.length <= 7 || index % 7 === 0) && (days.length <= 7 ? shortDate(day.date) : Number(day.date.slice(8)))}
                </time>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
