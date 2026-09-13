import { forwardRef } from 'react'

/*
 * The giant repeating wordmark behind the pile. Rows alternate the two words;
 * the column is taller than the section by a few rows so it can travel one
 * row per step (plus overshoot) without showing its ends. CardStack moves it.
 */
const ROWS = 18

const StackBackdrop = forwardRef(function StackBackdrop({ words = ['Marketing', 'Ravan'] }, ref) {
  return (
    <div className="hs-backdrop" aria-hidden="true">
      <div ref={ref} className="hs-backdrop-col">
        {Array.from({ length: ROWS }, (_, i) => (
          <span key={i}>{words[i % words.length]}</span>
        ))}
      </div>
    </div>
  )
})

export default StackBackdrop
