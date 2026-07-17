import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { InfoHint, Tooltip } from '@/components/ui/Tooltip'

// The reusable Tooltip is the single contextual-help primitive. These pin the
// accessibility contract: keyboard reachable, opens on focus, exposes role
// "tooltip", and the ⓘ affordance is a labelled button.

function withProvider(ui: ReactNode) {
  return <TooltipPrimitive.Provider delayDuration={0}>{ui}</TooltipPrimitive.Provider>
}

describe('Tooltip', () => {
  it('renders its trigger and shows the content on keyboard focus', async () => {
    render(
      withProvider(
        <Tooltip content="Private notes visible only to authorized users.">
          <button>Internal notes</button>
        </Tooltip>,
      ),
    )
    const trigger = screen.getByRole('button', { name: 'Internal notes' })
    expect(trigger).toBeInTheDocument()

    await userEvent.tab() // focus the trigger via the keyboard
    expect(trigger).toHaveFocus()
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Private notes visible only'),
    )
  })

  it('renders nothing extra when content is empty', () => {
    render(
      withProvider(
        <Tooltip content="">
          <button>bare</button>
        </Tooltip>,
      ),
    )
    expect(screen.getByRole('button', { name: 'bare' })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('InfoHint', () => {
  it('is a labelled, tab-reachable icon button', async () => {
    render(
      withProvider(<InfoHint content="Featured properties get higher visibility." label="About featured" />),
    )
    const btn = screen.getByRole('button', { name: 'About featured' })
    expect(btn).toBeInTheDocument()

    await userEvent.tab()
    expect(btn).toHaveFocus()
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('higher visibility'),
    )
  })
})
