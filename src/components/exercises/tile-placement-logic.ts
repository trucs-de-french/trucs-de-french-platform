// Чиста логіка (без React) — винесена окремо, щоб її можна було
// протестувати напряму (node), а не лише "по коду видно, що працює".

export type PlacedState = (number | null)[];

export function computePlaceAt(
  placed: PlacedState,
  targetSlot: number,
  bankIdx: number
): PlacedState {
  const sourceSlot = placed.indexOf(bankIdx);
  if (sourceSlot === targetSlot) return placed;

  const next = [...placed];
  next[targetSlot] = bankIdx;
  // плитка бралась з іншого слота -> swap; бралась з банку -> стара плитка
  // цілі просто звільняється (повертається в пул невикористаних)
  if (sourceSlot !== -1) {
    next[sourceSlot] = placed[targetSlot];
  }
  return next;
}

export function computeReturnToBank(placed: PlacedState, bankIdx: number): PlacedState {
  return placed.map((v) => (v === bankIdx ? null : v));
}

export type ClickSlotResult = { placed: PlacedState; selected: number | null };

export function computeClickSlot(
  placed: PlacedState,
  selected: number | null,
  slotIdx: number
): ClickSlotResult {
  const bankIdxInSlot = placed[slotIdx];

  if (selected !== null && selected !== bankIdxInSlot) {
    return { placed: computePlaceAt(placed, slotIdx, selected), selected: null };
  }

  if (bankIdxInSlot === null) {
    return { placed, selected };
  }

  if (selected === bankIdxInSlot) {
    return {
      placed: placed.map((v, i) => (i === slotIdx ? null : v)),
      selected: null,
    };
  }

  return { placed, selected: bankIdxInSlot };
}
