import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { MoodEntry } from '../../../domain/models'
import { moodCatalog } from '../moodConfig'
import { moodTrend, type MoodTrendDay } from './moodTrend'
import { moodTrendScale } from './moodTrendScale'
import { shortDate, type ReflectionChartProps } from './reflectionData'
import './moodTrend.css'

function trendPaths(days: MoodTrendDay[], key: 'score' | 'average', position: (value: number) => number) {
  const sections: { start: number; end: number; path: string }[] = []
  let section: typeof sections[number] | undefined
  days.forEach((day, index) => {
    const value = day[key]
    if (value === null) {
      section = undefined
      return
    }
    const x = index + 0.5
    const point = `${x},${position(value)}`
    if (section) {
      section.path += ` L${point}`
      section.end = x
    } else {
      section = { start: x, end: x, path: `M${point}` }
      sections.push(section)
    }
  })
  return {
    line: sections.map((item) => item.path).join(' '),
    area: sections.filter((item) => item.end > item.start)
      .map((item) => `${item.path} L${item.end},100 L${item.start},100 Z`).join(' '),
  }
}

interface Props extends ReflectionChartProps {
  dates: string[]
  entries: MoodEntry[]
}

export function MoodTrendChart({ dates, entries, days, activeDate, onChooseDate }: Props) {
  const [showAverage, setShowAverage] = useState(true)
  const fillId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const trend = useMemo(() => moodTrend(dates, entries), [dates, entries])
  const selectedIndex = trend.findIndex((day) => day.date === activeDate)
  const selected = trend[selectedIndex]
  const hasScores = trend.some((day) => day.score !== null)

  useEffect(() => {
    const scroll = scrollRef.current
    if (!hasScores || !scroll || selectedIndex < 0) return
    const revealDate = () => {
      if (!scroll.clientWidth) return
      const column = scroll.scrollWidth / dates.length
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
  }, [dates.length, hasScores, selectedIndex])

  if (!hasScores) {
    return <section className="mood-trend mood-trend-empty" aria-label="心情走向">这个范围内还没有心情记录。</section>
  }

  const values = trend.flatMap(({ score, average }) =>
    score === null ? [] : showAverage && average !== null ? [score, average] : [score],
  )
  const { min, max, ticks } = moodTrendScale(values)
  const position = (value: number) => ((max - value) * 100) / (max - min)
  const scorePaths = trendPaths(trend, 'score', position)
  const averagePath = showAverage ? trendPaths(trend, 'average', position).line : ''
  const points = days[selectedIndex]?.points
  const dominant = moodCatalog.map((mood) => ({ ...mood, count: points?.[mood.id] ?? 0 }))
    .filter((mood) => mood.count > 0).sort((a, b) => b.count - a.count).slice(0, 2)
  const style = { '--mood-trend-days': dates.length } as CSSProperties

  return (
    <section className="mood-trend" aria-label="心情走向">
      <header className="mood-trend-header">
        {selected && (
          <div className="mood-trend-readout" aria-live="polite">
            <div className="mood-trend-day">
              <time dateTime={selected.date}>{shortDate(selected.date)}</time>
              {selected.score === null
                ? <span className="mood-trend-unrecorded">未记录</span>
                : <strong>{Math.round(selected.score)} <small>分</small></strong>}
            </div>
            {selected.score !== null && (
              <div className="mood-trend-record">
                <span>已记 {selected.periods}/3 时段</span>
                <div className="mood-trend-moods">
                  {dominant.map((mood) => <span key={mood.id}><i style={{ background: mood.color }} />{mood.label} {mood.count}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
        <button type="button" className="mood-trend-average-toggle" aria-pressed={showAverage} onClick={() => setShowAverage((previous) => !previous)}>
          7 日均线
        </button>
      </header>
      <div className="mood-trend-chart">
        <div className="mood-trend-scale" aria-label={`纵轴 ${min} 到 ${max} 分`}>
          {ticks.map((value) => <span key={value} className={value === 50 ? 'baseline' : undefined}>{value}</span>)}
        </div>
        <div className="mood-trend-scroll" ref={scrollRef}>
          <div className="mood-trend-track" style={style}>
            <div className="mood-trend-plot">
              <svg aria-hidden="true" viewBox={`0 0 ${dates.length} 100`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="currentColor" stopOpacity=".29" />
                    <stop offset="1" stopColor="currentColor" stopOpacity=".015" />
                  </linearGradient>
                </defs>
                {ticks.map((value) => (
                  <line key={value} className={value === 50 ? 'baseline' : undefined} x1="0" x2={dates.length} y1={position(value)} y2={position(value)} vectorEffect="non-scaling-stroke" />
                ))}
                <path className="mood-trend-wash" d={scorePaths.area} fill={`url(#${fillId})`} />
                {showAverage && <path className="mood-trend-average-path" d={averagePath} vectorEffect="non-scaling-stroke" />}
                <path className="mood-trend-score-path" d={scorePaths.line} vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="mood-trend-columns">
                {trend.map((day, index) => {
                  const isSelected = day.date === activeDate
                  const showDate = dates.length <= 7 || index % 5 === 0 || isSelected
                  const date = <time dateTime={day.date} aria-hidden="true">{showDate && (dates.length <= 7 ? shortDate(day.date) : Number(day.date.slice(8)))}</time>
                  if (day.score === null) {
                    return <span key={day.date} className={isSelected ? 'selected' : undefined} aria-hidden="true">{date}</span>
                  }
                  const label = `${day.date} 心情走向 ${Math.round(day.score)} 分，已记 ${day.periods}/3 时段`
                  return (
                    <button type="button" key={day.date} aria-label={label} title={label} aria-pressed={isSelected} onClick={() => onChooseDate(day.date)}>
                      {showAverage && day.average !== null && <i className="mood-trend-average-dot" style={{ top: `${position(day.average)}%` }} />}
                      <i className="mood-trend-score-dot" data-complete={day.periods === 3} style={{ top: `${position(day.score)}%` }} />
                      {date}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="mood-trend-caption">
        <span>纵轴随记录调整 · {min}–{max} 分</span>
        {showAverage && selected?.average != null && (
          <span>近 7 日均值 {Math.round(selected.average)} · {selected.averageDays} 天有记录</span>
        )}
      </footer>
    </section>
  )
}
