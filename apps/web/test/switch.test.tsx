import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Switch } from '@/components/ui/Switch'

// The one on/off switch. These pin the accessibility contract: it announces as a
// switch, reflects state, and is fully keyboard-operable (Space toggles) — the
// things a div-with-onClick would silently get wrong.

function Controlled() {
  const [on, setOn] = useState(false)
  return <Switch checked={on} onChange={(e) => setOn(e.target.checked)} aria-label="Feature" />
}

describe('Switch', () => {
  it('exposes a switch role with an accessible name and reflects state on click', async () => {
    render(<Controlled />)
    const sw = screen.getByRole('switch', { name: 'Feature' })
    expect(sw).not.toBeChecked()
    await userEvent.click(sw)
    expect(sw).toBeChecked()
  })

  it('toggles with the keyboard (Space)', async () => {
    render(<Controlled />)
    const sw = screen.getByRole('switch', { name: 'Feature' })
    await userEvent.tab()
    expect(sw).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(sw).toBeChecked()
  })

  it('is inert when disabled', async () => {
    render(<Switch checked={false} disabled aria-label="Off" onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Off' })).toBeDisabled()
  })
})
