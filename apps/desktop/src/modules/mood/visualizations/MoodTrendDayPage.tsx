import { moodPeriods } from '../moodConfig'
import { expandMoodPoints, moodColor, moodSummary } from '../moodUtils'
import type { MoodTrendDay } from './moodTrend'

export function MoodTrendDayPage({ day, showAverage }: { day: MoodTrendDay; showAverage: boolean }) {
  const date = new Date(`${day.date}T12:00:00`)

  return (
    <article className="mood-trend-day-page" aria-label="当日心情记录" aria-live="polite">
      <header>
        <h3>
          <time dateTime={day.date}>
            {date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            <small>{date.toLocaleDateString('zh-CN', { weekday: 'short' })}</small>
          </time>
        </h3>
        <div className="mood-trend-day-meta">
          {day.score === null ? '未留下记录' : <>
            <strong>{Math.round(day.score)} 分</strong>
            <span>已记 {day.periods}/3 时段</span>
          </>}
        </div>
      </header>
      <dl className="mood-trend-periods">
        {moodPeriods.map(({ id, label }) => {
          const entry = day.entries.find((record) => record.period === id)
          return (
            <div className="mood-trend-period" key={id}>
              <dt>
                {label}
                {entry && <span className="mood-trend-stamps" aria-hidden="true">
                  {expandMoodPoints(entry.points).map((mood, index) => <i key={index} style={{ backgroundColor: moodColor(mood) }} />)}
                </span>}
              </dt>
              <dd>{entry ? moodSummary(entry.points) : '未记'}</dd>
              {entry?.note && <dd className="mood-trend-note">{entry.note}</dd>}
            </div>
          )
        })}
      </dl>
      {showAverage && day.average !== null && (
        <p className="mood-trend-day-average">近 7 日均值 {Math.round(day.average)} · {day.averageDays} 天有记录</p>
      )}
    </article>
  )
}
