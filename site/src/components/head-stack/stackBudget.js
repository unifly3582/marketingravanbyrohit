/*
 * The head stack's scroll budget, in viewport heights. Lives on its own so
 * Home.jsx can size the block's placeholder before the stack's code has
 * loaded: the wrapper is one viewport (head-stack.css) plus this.
 */
import { HEADS } from '../../data/heads.js'

export const INTRO_VH = 60 // statement lifts away, pile rises into place
export const STEP_VH = 48 // scroll distance per card
export const TAIL_VH = 40 // rest on the last card before the block scrolls away

export const STACK_BUDGET = `${INTRO_VH + STEP_VH * (HEADS.length - 1) + TAIL_VH}vh`
