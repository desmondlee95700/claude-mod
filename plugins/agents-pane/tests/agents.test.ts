import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SCROLL = { offset: 0, bodyRows: 20 }
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: SCROLL, view: {} },
} as const
const PANE = {
  component: 'Pane',
  requestId: 'agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: SCROLL, view: {} },
} as const

function engine(on: On, isPlaced = false) {
  let next = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++next}` }))
  on('tool.call', () => ({ result: 'ok' as never }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.open', () => ({ value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } }) as never)
  on('ui.panes', () => [] as never)
  on('ui.close', () => undefined as never)
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, null, 'engine band') as never)
  return mock.clock(on, { now: 0 })
}

const spawn = (description: string) => ({
  tool_use_id: description,
  prompt: description,
  description,
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: true,
}) as never

const finish = (agentId: string) =>
  ({ agentId, answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' }) as never

test('the strip appears once a subagent starts, counts it, and hides on ×', async ($, on) => {
  engine(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const empty = await $.ui.mount({ plugin: 'agents-pane', surface, ...BAND })
    expect(await empty.find({ text: /on court/ })).toBeUndefined()
    await empty.unmount()
  }

  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))
  await $.turn.complete(finish('a2'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agents-pane', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '1 on court · 1 final' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...BAND })
  await ui.press({ key: 'hide' })
  expect(await ui.find({ text: /on court/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane tracks tools per agent and Clear drops the finished', async ($, on) => {
  const clock = engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/a', agentId: 'a1' } as never)
  await clock.advance(17_000)
  await $.turn.complete(finish('a2'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agents-pane', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: 'On court · 1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '2 tools · Read' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /0:17/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Final · 1' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  await ui.press({ key: 'clear' })
  expect(await ui.find({ type: 'Text', text: /Final ·/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Build the landing page' })).toBeDefined()
  await ui.unmount()
})

test('each subagent suits up as a numbered pixel player', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))

  const desk = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  expect(await desk.find({ type: 'Text', text: /#23 PG/ })).toBeDefined()
  expect(await desk.find({ type: 'Text', text: /#33 SG/ })).toBeDefined()
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()

  const term = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...PANE })
  expect(await term.find({ key: 'player-a1' })).toBeDefined()
  await term.unmount()
})

test('the pane waits to be asked, the strip steps aside while it is up, and the clock ticks', async ($, on) => {
  const clock = engine(on, true)
  await $.agent.spawn(spawn('Build the landing page'))

  const band = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await band.find({ text: /on court/ })).toBeDefined()
  await band.press({ key: 'open' })
  expect(await band.find({ text: /on court/ })).toBeUndefined()
  await band.unmount()

  const pane = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  await clock.advance(3_000)
  expect(await pane.find({ type: 'Text', text: /0:03/ })).toBeDefined()
  await pane.unmount()
  await $.turn.complete(finish('a1'))
})

test('the strip holds a live game while players are on court, and rests after', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))

  const live = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await live.find({ type: 'Svg' })).toBeDefined()
  await live.unmount()

  await $.turn.complete(finish('a1'))
  await $.turn.complete(finish('a2'))
  const done = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await done.find({ text: '0 on court · 2 final' })).toBeDefined()
  expect(await done.find({ type: 'Svg' })).toBeDefined()
  await done.unmount()
})

test('the pane leads with a scoreboard on desktop and stat tiles in the terminal', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.turn.complete(finish('a1'))

  const desk = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  expect(await desk.find({ type: 'Text', text: 'Game clock' })).toBeUndefined()
  await desk.unmount()

  const term = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...PANE })
  expect(await term.find({ type: 'Text', text: 'Game clock' })).toBeDefined()
  expect(await term.find({ type: 'Text', text: 'W 1 · L 0' })).toBeDefined()
  await term.unmount()
})
