import { useMemo, useState } from 'react'
import {
  archiveChecklistTask,
  createChecklistTask,
  deleteChecklistTask,
  getActiveChecklistTasks,
  getArchivedChecklistTasks,
  moveChecklistTask,
  requestChecklistNotifications,
  toggleChecklistTask,
  updateChecklistDates,
} from '../checklistService.js'

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value) {
  if (!value) return 'Sin definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha inválida'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function ChecklistView({ tasks, setTasks }) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')
  const [editingDatesId, setEditingDatesId] = useState(null)
  const [editingStartDate, setEditingStartDate] = useState('')
  const [editingEndDate, setEditingEndDate] = useState('')
  const activeTasks = useMemo(() => getActiveChecklistTasks(tasks), [tasks])
  const archivedTasks = useMemo(() => getArchivedChecklistTasks(tasks), [tasks])
  const addTask = (event) => {
    event.preventDefault()
    try {
      const task = createChecklistTask({ title, startDate, endDate })
      setTasks((current) => [...current, task])
      setTitle(''); setStartDate(''); setEndDate(''); setError('')
    } catch (addError) {
      setError(addError.message)
    }
  }

  const updateTasks = (updater, id) => {
    setTasks((current) => updater(current, id))
  }

  const startEditingDates = (task) => {
    setEditingDatesId(task.id)
    setEditingStartDate(toDateTimeInput(task.startDate))
    setEditingEndDate(toDateTimeInput(task.endDate))
    setError('')
  }

  const saveTaskDates = (taskId) => {
    try {
      setTasks((current) => updateChecklistDates(current, taskId, editingStartDate, editingEndDate))
      setEditingDatesId(null)
      setError('')
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return <section className="feature-view maintenance-view checklist-view">
    <div className="feature-heading">
      <div><p className="eyebrow">INSPECCIÓN PREVIA AL VIAJE</p><h1>Mantenimiento/Kanban</h1></div>
      <span className="task-count">{activeTasks.filter((task) => !task.isCompleted).length} pendientes</span>
    </div>

    <form className="checklist-form" onSubmit={addTask}>
      <label className="checklist-field checklist-title-field"><span>Inspección</span><input aria-label="Nueva tarea" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisar cinturones y extintor" /></label>
      <label className="checklist-field"><span>Inicio</span><input aria-label="Fecha y hora de inicio" type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label className="checklist-field"><span>Límite</span><input aria-label="Fecha y hora límite" type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <button className="checklist-add-button" type="submit" disabled={!title.trim()}>Añadir tarea <span aria-hidden="true">+</span></button>
    </form>
    {error && <p className="checklist-error" role="alert">{error}</p>}

    <div className="checklist-toolbar">
      <div className="checklist-tabs" aria-label="Mostrar tareas">
        <button type="button" className={!showArchived ? 'is-active' : ''} onClick={() => setShowArchived(false)}>Pendientes / activas <span>{activeTasks.length}</span></button>
        <button type="button" className={showArchived ? 'is-active' : ''} onClick={() => setShowArchived(true)}>Historial archivado <span>{archivedTasks.length}</span></button>
      </div>
      <button className="notification-button" type="button" onClick={async () => {
        const permission = await requestChecklistNotifications()
        setError(permission === 'granted' ? '' : permission === 'denied' ? 'Las notificaciones están bloqueadas en el navegador.' : 'Este navegador no admite notificaciones locales.')
      }}>Activar recordatorios</button>
    </div>

    {showArchived ? <div className="checklist-items">
      {archivedTasks.map((task) => <article className="checklist-item" key={task.id}>
        <div className="checklist-item-content"><strong>{task.title}</strong><div className="checklist-dates"><span><b>Inicio:</b> {formatDate(task.startDate)}</span><span><b>Límite:</b> {formatDate(task.endDate)}</span></div></div>
        <div className="checklist-actions"><button type="button" onClick={() => updateTasks(archiveChecklistTask, task.id)}>Restaurar</button><button className="checklist-delete" type="button" onClick={() => updateTasks(deleteChecklistTask, task.id)}>Eliminar</button></div>
      </article>)}
      {!archivedTasks.length && <div className="checklist-empty"><strong>No hay tareas archivadas</strong><span>Las tareas archivadas aparecerán aquí.</span></div>}
    </div> : <div className="kanban-checklist-board">
      {[{ lane: 0, title: 'Pendiente' }, { lane: 1, title: 'En curso' }, { lane: 2, title: 'Hecho' }].map((column) => {
        const columnTasks = activeTasks.filter((task) => (task.lane ?? 0) === column.lane)
        return <section className="kanban-checklist-column" key={column.lane}>
          <div className="kanban-checklist-heading"><h2>{column.title}</h2><span>{columnTasks.length}</span></div>
          {columnTasks.map((task) => <article className="kanban-checklist-card" key={task.id}>
            <button className="checklist-complete" type="button" aria-label={task.isCompleted ? `Reabrir ${task.title}` : `Completar ${task.title}`} aria-pressed={task.isCompleted} onClick={() => updateTasks(toggleChecklistTask, task.id)}><span aria-hidden="true">{task.isCompleted ? '✓' : ''}</span></button>
            <strong>{task.title}</strong>
            {editingDatesId === task.id ? <div className="kanban-date-editor">
              <label>Inicio<input type="datetime-local" value={editingStartDate} onChange={(event) => setEditingStartDate(event.target.value)} /></label>
              <label>Límite<input type="datetime-local" value={editingEndDate} onChange={(event) => setEditingEndDate(event.target.value)} /></label>
              <div><button type="button" onClick={() => saveTaskDates(task.id)}>Guardar fechas</button><button type="button" onClick={() => { setEditingDatesId(null); setError('') }}>Cancelar</button></div>
            </div> : <div className="checklist-dates"><span><b>Inicio:</b> {formatDate(task.startDate)}</span><span><b>Límite:</b> {formatDate(task.endDate)}</span></div>}
            <div className="kanban-card-actions">
              <button type="button" onClick={() => startEditingDates(task)}>Editar fechas</button>
              {column.lane > 0 && <button type="button" onClick={() => setTasks((current) => moveChecklistTask(current, task.id, column.lane - 1))}>← Atrás</button>}
              {column.lane < 2 && <button type="button" onClick={() => setTasks((current) => moveChecklistTask(current, task.id, column.lane + 1))}>{column.lane === 0 ? 'Iniciar' : 'Completar'} →</button>}
              <button type="button" onClick={() => updateTasks(archiveChecklistTask, task.id)}>Archivar</button>
              <button className="checklist-delete" type="button" onClick={() => updateTasks(deleteChecklistTask, task.id)}>Eliminar</button>
            </div>
          </article>)}
          {!columnTasks.length && <p className="kanban-checklist-empty">Sin tareas</p>}
        </section>
      })}
    </div>}
  </section>
}
