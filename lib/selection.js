export function applySelectionUpdate(ids, id, action) {
  const set = new Set(ids)
  if (action === 'add') set.add(id)
  else set.delete(id)
  return [...set]
}
