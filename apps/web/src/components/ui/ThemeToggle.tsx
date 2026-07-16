import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from '@/app/theme-provider'
import { cn } from '@/lib/cn'

// The header theme switch. Visible to every signed-in user (admin and agent
// alike) since it lives in the shared Topbar. Shows the icon of the theme you'll
// switch TO — a moon in light mode, a sun in dark — which is the affordance the
// aria-label spells out for assistive tech.
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const reduce = useReducedMotion()
  const isDark = theme === 'dark'
  const Icon = isDark ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative grid size-9 place-items-center rounded-md text-text-secondary',
        'transition-colors duration-[120ms] hover:bg-surface-hover hover:text-text-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={reduce ? undefined : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="grid place-items-center"
        >
          <Icon className="size-[1.15rem]" aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
