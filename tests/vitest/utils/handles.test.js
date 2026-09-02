import { describe, expect, it } from 'vitest'
import { buildGhostHandles, getHandleStyle, normaliseHandleSlots } from '../../../src/utils/handles'

describe('handle layout', () => {
  it('keeps explicit side slots stable even when the handle array order changes', () => {
    const leftHandles = [
      { uid: 'left-1', side: 'left', variant: 'default', slotIndex: 0 },
      { uid: 'left-2', side: 'left', variant: 'default', slotIndex: 1 },
      { uid: 'ghost-1', side: 'left', variant: 'ghost', slotIndex: 2 },
      { uid: 'ghost-2', side: 'left', variant: 'ghost', slotIndex: 3 },
    ]

    const reordered = [leftHandles[2], leftHandles[0], leftHandles[3], leftHandles[1]]

    expect(getHandleStyle(leftHandles[0], leftHandles)).toEqual(getHandleStyle(leftHandles[0], reordered))
    expect(getHandleStyle(leftHandles[1], leftHandles)).toEqual(getHandleStyle(leftHandles[1], reordered))
  })

  it('assigns stable slot indices to ghost handles and active handles on each side', () => {
    const handles = [...buildGhostHandles(2, 2)]
    const normalised = normaliseHandleSlots(handles)

    expect(normalised.every((handle) => Number.isInteger(handle.slotIndex))).toBe(true)
    expect(normalised.filter((handle) => handle.side === 'left').map((handle) => handle.slotIndex)).toEqual([0, 1])
  })

  it('centres a single real handle within the ghost pool on that side', () => {
    const handles = [
      { uid: 'real-1', side: 'top', variant: 'default', slotIndex: 0 },
      ...buildGhostHandles(7, 5)
        .filter((handle) => handle.side === 'top')
        .map((handle, index) => ({ ...handle, slotIndex: index })),
    ]

    const normalised = normaliseHandleSlots(handles)
    const topHandles = normalised.filter((handle) => handle.side === 'top')
    const real = topHandles.find((handle) => handle.variant === 'default')
    const realIndex = topHandles.findIndex((handle) => handle.uid === real.uid)

    expect(realIndex).toBe(3)
  })

  it('keeps the ghost pool size at the configured total minus real handles on each side', () => {
    const realHandles = [
      { uid: 'real-left-1', side: 'left', variant: 'default' },
      { uid: 'real-left-2', side: 'left', variant: 'default' },
      { uid: 'real-top-1', side: 'top', variant: 'default' },
    ]

    const ghosts = buildGhostHandles(7, 5, realHandles)

    expect(ghosts.filter((handle) => handle.side === 'left')).toHaveLength(3)
    expect(ghosts.filter((handle) => handle.side === 'top')).toHaveLength(6)
    expect(ghosts.filter((handle) => handle.side === 'right')).toHaveLength(5)
    expect(ghosts.filter((handle) => handle.side === 'bottom')).toHaveLength(7)
  })
})
