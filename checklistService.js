const STORAGE_KEY = 'jarvis-checklist-tasks'

export const ChecklistStatus = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
})

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeTask(task) {
  return {
    id: String(task.id ?? createId()),
    title: String(task.title ?? '').trim(),
    startDate: task.startDate ?? '',
    endDate: task.endDate ?? '',
    isCompleted: Boolean(task.isCompleted),
    isArchived: Boolean(task.isArchived),
    lane: Number.isInteger(task.lane) && task.lane >= 0 && task.lane <= 2 ? task.lane : (task.isCompleted ? 2 : 0),
    createdAt: task.createdAt ?? new Date().toISOString(),
    completedAt: task.completedAt ?? null,
    archivedAt: task.archivedAt ?? null,
  }
}

export function defaultChecklistTasks() {
  const now = new Date()
  const departure = new Date(now.getTime() + 60 * 60 * 1000)
  const toLocalDateTime = (date) => {
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  }

  return [
    normalizeTask({ id: createId(), title: 'Revisar presión de neumáticos', startDate: toLocalDateTime(now), endDate: toLocalDateTime(departure), lane: 0 }),
    normalizeTask({ id: createId(), title: 'Comprobar nivel de aceite', startDate: toLocalDateTime(now), endDate: toLocalDateTime(departure), lane: 0 }),
    normalizeTask({ id: createId(), title: 'Comprobar luces y frenos', startDate: toLocalDateTime(now), endDate: toLocalDateTime(departure), lane: 0 }),
  ]
}

export function loadChecklistTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return Array.isArray(saved) ? saved.map(normalizeTask).filter((task) => task.title) : defaultChecklistTasks()
  } catch {
    return defaultChecklistTasks()
  }
}

export function saveChecklistTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.map(normalizeTask)))
}

export function createChecklistTask({ title, startDate = '', endDate = '' }) {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('El título de la tarea es obligatorio.')
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    throw new Error('La fecha límite debe ser posterior al inicio.')
  }
  return normalizeTask({ id: createId(), title: cleanTitle, startDate, endDate, lane: 0 })
}

export function moveChecklistTask(tasks, id, lane) {
  return tasks.map((task) => task.id === String(id)
    ? { ...task, lane, isCompleted: lane === 2, completedAt: lane === 2 ? new Date().toISOString() : null }
    : task)
}

export function updateChecklistDates(tasks, id, startDate, endDate) {
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    throw new Error('La fecha límite debe ser posterior al inicio.')
  }
  return tasks.map((task) => task.id === String(id) ? { ...task, startDate, endDate } : task)
}

export function toggleChecklistTask(tasks, id) {
  return tasks.map((task) => task.id === String(id)
    ? { ...task, isCompleted: !task.isCompleted, lane: task.isCompleted ? 1 : 2, completedAt: task.isCompleted ? null : new Date().toISOString() }
    : task)
}

export function archiveChecklistTask(tasks, id) {
  return tasks.map((task) => task.id === String(id)
    ? { ...task, isArchived: !task.isArchived, archivedAt: task.isArchived ? null : new Date().toISOString() }
    : task)
}

export function deleteChecklistTask(tasks, id) {
  return tasks.filter((task) => task.id !== String(id))
}

export function getActiveChecklistTasks(tasks) {
  return tasks.filter((task) => !task.isArchived)
}

export function getPendingChecklistTasks(tasks) {
  return tasks.filter((task) => !task.isArchived && !task.isCompleted)
}

export function getArchivedChecklistTasks(tasks) {
  return tasks.filter((task) => task.isArchived)
}

export function getChecklistAlerts(tasks, now = new Date(), alertWindowMs = 60 * 60 * 1000) {
  const nowMs = now.getTime()
  return getPendingChecklistTasks(tasks).filter((task) => {
    if (!task.endDate) return true
    const endMs = new Date(task.endDate).getTime()
    return endMs <= nowMs || endMs - nowMs <= alertWindowMs
  }).sort((first, second) => {
    const firstEnd = first.endDate ? new Date(first.endDate).getTime() : Number.MAX_SAFE_INTEGER
    const secondEnd = second.endDate ? new Date(second.endDate).getTime() : Number.MAX_SAFE_INTEGER
    return firstEnd - secondEnd
  })
}

export async function requestChecklistNotifications() {
  if (!('Notification' in window)) return 'unavailable'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function sendChecklistNotification(tasks) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const pending = tasks.length
  new Notification('Mantenimiento/Kanban del viaje', {
    body: pending === 1 ? 'Hay 1 tarea pendiente antes de iniciar el viaje.' : `Hay ${pending} tareas pendientes antes de iniciar el viaje.`,
    tag: 'jarvis-pre-trip-checklist',
  })
  return true
}
