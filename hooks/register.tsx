import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { Turn, ToolCounts } from '../types'

const PANE = 'usage-panel'

const turnsAtom = atom({ plugin: 'status-line', key: 'turns' } as const, [] as Turn[])
const toolCountsAtom = atom(
  { plugin: 'status-line', key: 'toolCounts' } as const,
  {} as ToolCounts,
)

const bar = (pct: number, width = 14): string => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const remaining = (resetsAt: string | undefined): string => {
  if (!resetsAt) return '—'
  const ms = new Date(resetsAt).getTime() - Date.now()
  if (ms <= 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}sa ${m}dk` : `${m}dk`
}

const fmtMin = (ms: number): string => `${Math.round(ms / 60_000)}dk`

const refreshStatus = async ($: EngineInterface): Promise<void> => {
  const usage = await $.session.usage()
  const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
  const weekly = usage.rateLimits.find(r => r.kind === 'seven_day')

  const parts: string[] = []
  if (usage.context.percent !== undefined) {
    parts.push(`🧠 Bağlam %${Math.round(usage.context.percent)}`)
  }
  if (fiveHour) parts.push(`⏱ 5sa %${Math.round(fiveHour.percentUsed)}`)
  if (weekly) parts.push(`📅 Hafta %${Math.round(weekly.percentUsed)}`)
  if (usage.cost) parts.push(`💲$${usage.cost.usd.toFixed(2)}`)

  $.ui.status(parts.length > 0 ? parts.join('  ·  ') : undefined)
}

export const register: Register = on => {
  let startedAt = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'panel',
      description: 'Kullanım panelini aç (Usage panel)',
    })
    void $.ui.open({ id: PANE, title: 'Kullanım Paneli' })
    void refreshStatus($)
    $.clock.every(15_000, () => void refreshStatus($))

    return next(e)
  })

  on('command.run', { command: 'panel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Kullanım Paneli' })

    return { text: 'Kullanım paneli açıldı.' }
  })

  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, toolCountsAtom, counts => ({
      ...counts,
      [e.tool]: (counts[e.tool] ?? 0) + 1,
    }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const durationMs = startedAt > 0 ? (await $.clock.now()) - startedAt : 0
    await update($, turnsAtom, list => [...list, { durationMs }].slice(-200))
    void refreshStatus($)

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [usage, promptCount, turns, toolCounts] = await Promise.all([
      $.session.usage(),
      $.session.turns(),
      read($, turnsAtom),
      read($, toolCountsAtom),
    ])

    const avgMs =
      turns.length > 0
        ? turns.reduce((sum, t) => sum + t.durationMs, 0) / turns.length
        : 0
    const maxMs = turns.length > 0 ? Math.max(...turns.map(t => t.durationMs)) : 0

    const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
    const weekly = usage.rateLimits.find(r => r.kind === 'seven_day')

    const costTotal = usage.cost?.usd ?? 0
    const avgMsgCost = promptCount > 0 ? costTotal / promptCount : 0

    const toolLine = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => `${tool} ${count}`)
      .join('  ')

    return (
      <Box flexDirection="column">
        <Text bold>OTURUM</Text>
        <Text dimColor>
          Yanıt {promptCount}  ·  Ort. yanıt süresi {fmtMin(avgMs)}  ·  En uzun{' '}
          {fmtMin(maxMs)}
        </Text>
        {toolLine.length > 0 && <Text dimColor>{toolLine}</Text>}
        <Text> </Text>

        <Text bold>LİMİT TAHMİNİ</Text>
        <Text>5 saatlik limit</Text>
        {fiveHour ? (
          <Text dimColor>
            {bar(fiveHour.percentUsed)}  %{Math.round(fiveHour.percentUsed)}  ·  kalan{' '}
            {remaining(fiveHour.resetsAt)}
          </Text>
        ) : (
          <Text dimColor>Henüz veri yok</Text>
        )}
        <Text>Haftalık limit</Text>
        {weekly ? (
          <Text dimColor>
            {bar(weekly.percentUsed)}  %{Math.round(weekly.percentUsed)}  ·  kalan{' '}
            {remaining(weekly.resetsAt)}
          </Text>
        ) : (
          <Text dimColor>Henüz veri yok</Text>
        )}
        <Text> </Text>

        <Text bold>BAĞLAM</Text>
        <Text dimColor>
          {bar(usage.context.percent ?? 0)}  %{Math.round(usage.context.percent ?? 0)}
          {'  ·  '}
          {usage.context.tokens ?? 0} / {usage.context.window} token
        </Text>
        <Text> </Text>

        <Text bold>MALİYET</Text>
        <Text dimColor>
          Oturum toplamı ${costTotal.toFixed(2)}  ·  Ortalama mesaj $
          {avgMsgCost.toFixed(2)}
        </Text>
        <Text> </Text>

        <Text bold>İŞLER</Text>
        <Text dimColor>Arka planda çalışan iş yok</Text>
      </Box>
    )
  })
}
