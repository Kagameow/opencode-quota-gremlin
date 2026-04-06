import type { ProviderSnapshot, QuotaSnapshot } from '../types.js'
import assert from 'node:assert/strict'

import { describe, it } from 'vitest'
import { buildSidebarFooterText, buildSidebarProviderView, buildSidebarProviderViews } from './sidebar-model.js'

describe('buildSidebarProviderView', () => {
  it('formats anthropic windows with progress bars and compact reset text', () => {
    const provider: ProviderSnapshot = {
      id: 'anthropic',
      label: 'Claude',
      accountLabel: 'OAuth',
      windows: [
        {
          id: '5h',
          label: '5h',
          remainingPercent: 99,
          resetInSeconds: 16 * 60,
        },
        {
          id: '7d',
          label: '7d',
          remainingPercent: 4,
          resetInSeconds: (4 * 86_400) + (17 * 3600) + (7 * 60),
        },
      ],
      note: 'Extra $0.00 / $50.00',
    }

    const view = buildSidebarProviderView(provider)

    assert.equal(view.title, 'Claude')
    assert.equal(view.meta, 'OAuth')
    assert.equal(view.windows[0]?.text, '5h · 99% · 16m')
    assert.equal(view.windows[0]?.showProgressBar, true)
    assert.equal(view.windows[1]?.text, '7d · 4% · 4d 17h')
    assert.equal(view.note, 'Extra $0.00 / $50.00')
  })

  it('formats copilot windows without a progress bar', () => {
    const provider: ProviderSnapshot = {
      id: 'copilot',
      label: 'Copilot',
      accountLabel: 'business',
      windows: [
        {
          id: 'monthly',
          label: 'mo',
          remainingPercent: 0,
          used: 568,
          total: 300,
          resetInSeconds: (2 * 86_400) + (8 * 3600) + (16 * 60),
        },
      ],
    }

    const view = buildSidebarProviderView(provider)

    assert.equal(view.meta, 'business')
    assert.equal(view.windows[0]?.text, '568/300 mo · 0% · 2d 8h')
    assert.equal(view.windows[0]?.showProgressBar, false)
  })

  it('keeps provider meta and shows compact Anthropic rate-limit errors', () => {
    const provider: ProviderSnapshot = {
      id: 'anthropic',
      label: 'Claude',
      accountLabel: 'OAuth',
      windows: [],
      error: 'Rate limited',
      errorDetail: 'Rate limited. Please try again later.',
    }

    const view = buildSidebarProviderView(provider)

    assert.equal(view.meta, 'OAuth')
    assert.equal(view.error, 'Rate limited')
    assert.equal(view.note, 'Rate limited. Please try again later.')
  })
})

describe('sidebar view helpers', () => {
  it('builds provider views from a snapshot', () => {
    const snapshot: QuotaSnapshot = {
      fetchedAt: new Date('2026-03-29T17:52:36').getTime(),
      providers: [
        {
          id: 'openai',
          label: 'OpenAI',
          accountLabel: 'plus',
          windows: [
            {
              id: '5h',
              label: '5h',
              remainingPercent: 87,
              resetInSeconds: (4 * 3600) + (29 * 60),
            },
          ],
        },
      ],
    }

    const views = buildSidebarProviderViews(snapshot)
    assert.equal(views.length, 1)
    assert.equal(views[0]?.title, 'OpenAI')
    assert.equal(views[0]?.windows[0]?.text, '5h · 87% · 4h 29m')
  })

  it('builds the cute footer text', () => {
    const snapshot: QuotaSnapshot = {
      fetchedAt: new Date('2026-03-29T17:52:36').getTime(),
      providers: [],
    }

    assert.match(
      buildSidebarFooterText(snapshot) || '',
      /^Updated 5:52:36 PM {2}ฅ\^•ﻌ•\^ฅ$/,
    )
  })
})
