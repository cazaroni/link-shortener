import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { TimeseriesPoint } from '../../../shared/analytics'
import { useElementWidth } from '../../hooks/useElementWidth'
import { clicksLabel, formatCount } from '../../lib/breakdown'
import { formatTick, niceTicks, spreadIndexes } from '../../lib/chartScale'
import { formatAxisDay, formatDay, formatDayLong } from '../../lib/dates'

const HEIGHT = 240
const MARGIN_TOP = 12
const MARGIN_RIGHT = 20
const MARGIN_BOTTOM = 28
const MAX_BAR = 24
const BAR_RADIUS = 4
/** Narrowest slot (px) that still gets its own bar; denser series are drawn as a line. */
const MIN_BAND_FOR_BARS = 5

interface ActivePoint {
  index: number
  source: 'pointer' | 'keyboard'
}

/** Column with a rounded data end (top) and a square baseline. */
function barPath(x: number, top: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, height)
  const bottom = top + height
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`
}

interface TimeSeriesChartProps {
  points: readonly TimeseriesPoint[]
}

/**
 * Clicks per day. Few days: columns (each day is a discrete count). Many days: a line over a light area wash,
 * so a year of data stays readable. Hover, touch and arrow keys all read out the exact day and count.
 */
export function TimeSeriesChart({ points }: TimeSeriesChartProps) {
  const id = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(containerRef)
  const [active, setActive] = useState<ActivePoint | null>(null)

  const count = points.length
  const max = useMemo(() => points.reduce((m, p) => Math.max(m, p.count), 0), [points])
  const total = useMemo(() => points.reduce((sum, p) => sum + p.count, 0), [points])
  const ticks = useMemo(() => niceTicks(max), [max])
  const yMax = ticks[ticks.length - 1] ?? 1

  const left = 14 + Math.max(...ticks.map((tick) => formatTick(tick).length)) * 7
  const plotWidth = Math.max(0, width - left - MARGIN_RIGHT)
  const plotHeight = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
  const baseline = MARGIN_TOP + plotHeight
  const band = count > 0 ? plotWidth / count : 0
  const asBars = band >= MIN_BAND_FOR_BARS

  const yAt = (value: number) => baseline - (value / yMax) * plotHeight
  const xAt = (index: number) => {
    if (asBars) return left + (index + 0.5) * band
    return left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth)
  }

  const peakIndex = points.findIndex((p) => p.count === max)
  const peak = peakIndex >= 0 ? points[peakIndex] : undefined
  const first = points[0]
  const last = points[count - 1]
  const spansYears = !!first && !!last && first.date.slice(0, 4) !== last.date.slice(0, 4)

  const labelIndexes = spreadIndexes(count, Math.min(7, Math.max(2, Math.floor(plotWidth / (spansYears ? 110 : 90)))))

  function indexFromPointer(event: PointerEvent<SVGRectElement>): number {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const raw = asBars ? Math.floor(x / band) : Math.round((x / plotWidth) * (count - 1))
    return Math.min(count - 1, Math.max(0, raw))
  }

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    if (count === 0 || plotWidth <= 0) return
    setActive({ index: indexFromPointer(event), source: 'pointer' })
  }

  function handlePointerLeave(event: PointerEvent<SVGRectElement>) {
    // Touch keeps its readout until the next tap or blur; only a mouse "leaves".
    if (event.pointerType === 'mouse') setActive((prev) => (prev?.source === 'keyboard' ? prev : null))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (count === 0) return
    const current = active?.index ?? count - 1
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(count - 1, current + 1)
        break
      case 'ArrowLeft':
        next = Math.max(0, current - 1)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = count - 1
        break
      case 'Escape':
        setActive(null)
        return
      default:
        return
    }
    event.preventDefault()
    setActive({ index: next, source: 'keyboard' })
  }

  const activePoint = active ? points[active.index] : undefined
  const activeX = active ? xAt(active.index) : 0
  const activeY = activePoint ? yAt(activePoint.count) : 0

  const summary =
    first && last
      ? `Clicks per day from ${formatDay(first.date)} to ${formatDay(last.date)}: ${clicksLabel(total)} in total.` +
        (peak && max > 0 ? ` Busiest day ${formatDay(peak.date)} with ${clicksLabel(peak.count)}.` : '')
      : 'No days in this range.'

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.count).toFixed(1)}`).join('')
  const areaPath =
    count > 1 ? `${linePath}L${xAt(count - 1).toFixed(1)},${baseline}L${xAt(0).toFixed(1)},${baseline}Z` : ''

  const tooltipShiftX = activeX < 76 ? '-18%' : activeX > width - 76 ? '-82%' : '-50%'
  const tooltipBelow = activeY < 72
  const tooltipShiftY = tooltipBelow ? '14px' : 'calc(-100% - 10px)'

  return (
    <div
      ref={containerRef}
      className="timeseries"
      role="group"
      aria-label="Clicks per day. Use the left and right arrow keys to move between days."
      aria-describedby={`${id}-summary`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setActive((prev) => prev ?? (count > 0 ? { index: count - 1, source: 'keyboard' } : null))}
      onBlur={() => setActive(null)}
    >
      <p className="sr-only" id={`${id}-summary`}>
        {summary}
      </p>

      {width > 0 && (
        <svg className="timeseries-svg" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? 'chart-axis' : 'chart-grid'}
                x1={left}
                x2={left + plotWidth}
                y1={yAt(tick)}
                y2={yAt(tick)}
              />
              <text className="chart-tick" x={left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {labelIndexes.map((index) => {
            const point = points[index]
            if (!point) return null
            return (
              <text
                key={point.date}
                className="chart-tick"
                x={xAt(index)}
                y={baseline + 18}
                textAnchor="middle"
              >
                {formatAxisDay(point.date, spansYears)}
              </text>
            )
          })}

          {asBars ? (
            <g>
              {active && (
                <rect
                  className="chart-focus-band"
                  x={left + active.index * band}
                  y={MARGIN_TOP}
                  width={band}
                  height={plotHeight}
                />
              )}
              {points.map((point, index) => {
                if (point.count <= 0) return null
                const barWidth = Math.max(2, Math.min(MAX_BAR, band - 2))
                const height = Math.max(2, baseline - yAt(point.count))
                return (
                  <path
                    key={point.date}
                    className={`chart-bar${active?.index === index ? ' is-active' : ''}`}
                    d={barPath(xAt(index) - barWidth / 2, baseline - height, barWidth, height)}
                  />
                )
              })}
            </g>
          ) : (
            <g>
              {areaPath && <path className="chart-area" d={areaPath} />}
              <path className="chart-line" d={linePath} />
              {active && (
                <line className="chart-crosshair" x1={activeX} x2={activeX} y1={MARGIN_TOP} y2={baseline} />
              )}
              {last && (
                <circle className="chart-dot" cx={xAt(count - 1)} cy={yAt(last.count)} r={4} />
              )}
              {active && activePoint && <circle className="chart-dot is-active" cx={activeX} cy={activeY} r={5} />}
            </g>
          )}

          <rect
            className="chart-hit"
            x={left}
            y={MARGIN_TOP}
            width={plotWidth}
            height={plotHeight + MARGIN_BOTTOM - 6}
            onPointerDown={handlePointer}
            onPointerMove={handlePointer}
            onPointerLeave={handlePointerLeave}
          />
        </svg>
      )}

      {active && activePoint && (
        <div
          className="chart-tooltip"
          aria-hidden="true"
          style={{
            left: activeX,
            top: activeY,
            transform: `translate(${tooltipShiftX}, ${tooltipShiftY})`,
          }}
        >
          <span className="chart-tooltip-value">
            <span className="chart-tooltip-key" />
            {formatCount(activePoint.count)} {activePoint.count === 1 ? 'click' : 'clicks'}
          </span>
          <span className="chart-tooltip-label">{formatDayLong(activePoint.date)}</span>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {active?.source === 'keyboard' && activePoint
          ? `${formatDayLong(activePoint.date)}: ${clicksLabel(activePoint.count)}`
          : ''}
      </div>

      <table className="sr-only">
        <caption>Clicks per day (UTC)</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDay(point.date)}</th>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
