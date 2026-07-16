import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '@/app/theme-provider'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { resolveInitialTheme, THEME_STORAGE_KEY } from '@/lib/theme'

// The toggle is the one piece of UI every signed-in user touches. These pin the
// contract: persistence, the DOM class the token layer keys off, and the
// accessible name that flips with state.

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('theme resolution', () => {
  it('prefers a stored choice over the system setting', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('falls back to system (mocked light) when nothing is stored', () => {
    expect(resolveInitialTheme()).toBe('light')
  })
})

describe('ThemeToggle', () => {
  it('toggles the .dark class and persists the choice', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    // Starts light (matchMedia is mocked to matches:false).
    const toDark = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await userEvent.click(toDark)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    // The accessible name flips, and toggling back restores light.
    const toLight = screen.getByRole('button', { name: 'Switch to light mode' })
    await userEvent.click(toLight)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
