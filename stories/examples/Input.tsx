import React, {
  ChangeEventHandler,
  InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useRoom } from '@src/index'

export const SharedInput = () => {
  const { state, setState } = useRoom<string>(
    '19328f4d-31ba-4df4-bdb3-6bf3c77ff172',
    ''
  )

  return (
    <div
      style={{
        border: '1px solid red',
        padding: '1rem',
        width: 'fit-content',
      }}
    >
      <Input
        onChange={(event) => void setState(event.target.value)}
        value={state}
      />
    </div>
  )
}

const Input = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const { value, onChange, ...rest } = props
  const [cursor, setCursor] = useState<number | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = ref.current
    if (input) input.setSelectionRange(cursor, cursor)
  }, [ref, cursor, value])

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setCursor(e.target.selectionStart)
    onChange && onChange(e)
  }

  return <input ref={ref} value={value} onChange={handleChange} {...rest} />
}
