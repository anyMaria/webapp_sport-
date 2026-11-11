import type { ButtonHTMLAttributes } from 'react'
import s from './ui.module.css'

type Variant = 'secondary' | 'primary' | 'danger'

export function Button({ variant = 'secondary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...rest} className={[s.btn, variant !== 'secondary' ? s[variant] : '', className ?? ''].join(' ')} />
}

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} {...rest} className={[s.btn, s.round].join(' ')}>
      {children}
    </button>
  )
}
