import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { MoodEntry } from '../../../domain/models'
import { formatLocalDate } from '../../../domain/localDate'
import { MoodTrendDayPage } from './MoodTrendDayPage'
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

interface Props extends Pick<ReflectionChartProps, 'activeDate' | 'onChooseDate'> {
  dates: string[]
  entries: MoodEntry[]
}

export function MoodTrendChart({ dates, entries, activeDate, onChooseDate }: Props) {
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
  const style = { '--mood-trend-days': dates.length } as CSSProperties
  const isWeek = dates.length <= 7
  const today = formatLocalDate()

  return (
    <section className="mood-trend" aria-label="心情走向">
      <div className="mood-trend-spread">
        <div className="mood-trend-ink-page">
          <header>
            <h3>{isWeek ? '这一周' : '这个月'}</h3>
            <span title="纵轴随所选时间段的记录调整">日分 · {min}–{max}</span>
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
                        <stop offset="0" stopColor="currentColor" stopOpacity=".19" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
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
                      const showDate = isWeek || index % 5 === 0 || isSelected
                      const date = <time dateTime={day.date} aria-hidden="true">{showDate && (isWeek ? shortDate(day.date) : Number(day.date.slice(8)))}</time>
                      if (day.score === null && day.date > today) {
                        return <span key={day.date} className="mood-trend-future" aria-hidden="true">{date}</span>
                      }
                      const label = day.score === null
                        ? `${day.date} 心情走向，未记录`
                        : `${day.date} 心情走向 ${Math.round(day.score)} 分，已记 ${day.periods}/3 时段`
                      return (
                        <button type="button" key={day.date} aria-label={label} title={label} aria-pressed={isSelected} onClick={() => onChooseDate(day.date)}>
                          {showAverage && day.average !== null && <i className="mood-trend-average-dot" style={{ top: `calc(var(--mood-trend-height) * ${position(day.average) / 100})` }} />}
                          {day.score !== null && <i className="mood-trend-score-dot" data-complete={day.periods === 3} style={{ top: `calc(var(--mood-trend-height) * ${position(day.score) / 100})` }} />}
                          {date}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="mood-trend-average-toggle" aria-pressed={showAverage} onClick={() => setShowAverage((previous) => !previous)}>
            7 日均线
          </button>
        </div>
        {selected && <MoodTrendDayPage day={selected} showAverage={showAverage} />}
      </div>
    </section>
  )
}
