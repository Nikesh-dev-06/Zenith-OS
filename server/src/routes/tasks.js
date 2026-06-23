// tasks.js
const express = require('express')
const { Task, ActivityLog, Project } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)
router.use(readOnlyForViewer)

const enrichTask = (task) => {
  return {
    ...task.toObject(),
    id: task._id,
    assignee: task.assigneeId ? task.assigneeId._id : '',
    assigneeName: task.assigneeId ? task.assigneeId.name : 'Unassigned',
  }
}

router.get('/', async (req, res) => {
  try {
    const { projectId, status, assigneeId } = req.query
    const query = { deletedAt: null }
    if (status) query.status = status
    if (assigneeId) query.assigneeId = assigneeId

    if (req.user.role === 'client') {
      const clientProjects = await Project.find({ clientId: req.user.clientId, deletedAt: null }).select('_id')
      const projectIds = clientProjects.map(p => p._id)
      if (projectId) {
        if (!projectIds.some(id => id.toString() === projectId.toString())) {
          return res.status(403).json({ error: 'Access denied to this project\'s tasks' })
        }
        query.projectId = projectId
      } else {
        query.projectId = { $in: projectIds }
      }
    } else {
      if (projectId) query.projectId = projectId
    }

    const tasks = await Task.find(query).populate('assigneeId', 'name avatar').sort({ order: 1, createdAt: -1 })
    const enrichedTasks = tasks.map(enrichTask)
    res.json(enrichedTasks)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const task = await Task.create(req.body)
    await ActivityLog.create({ action: 'created task', entityType: 'task', entityId: task._id, entityName: task.title, userId: req.user._id })
    const populated = await Task.findById(task._id).populate('assigneeId', 'name avatar')
    res.status(201).json(enrichTask(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('assigneeId', 'name avatar')
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (req.body.status === 'done') {
      await ActivityLog.create({ action: 'marked task done', entityType: 'task', entityId: task._id, entityName: task.title, userId: req.user._id })
    }
    res.json(enrichTask(task))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, { deletedAt: new Date() })
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json({ message: 'Task deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /:id/timer/start
router.post('/:id/timer/start', agencyOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.isTimerRunning) return res.status(400).json({ error: 'Timer is already running' })

    task.isTimerRunning = true
    task.timerStartedAt = new Date()
    await task.save()

    res.json(enrichTask(task))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /:id/timer/stop
router.post('/:id/timer/stop', agencyOnly, async (req, res) => {
  try {
    const { description } = req.body
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (!task.isTimerRunning || !task.timerStartedAt) {
      return res.status(400).json({ error: 'Timer is not running' })
    }

    const elapsedMs = new Date() - new Date(task.timerStartedAt)
    const durationMinutes = Math.max(1, Math.round(elapsedMs / 1000 / 60))

    task.isTimerRunning = false
    task.totalLoggedTime = (task.totalLoggedTime || 0) + durationMinutes
    task.timeLogs.push({
      userId: req.user._id,
      userName: req.user.name,
      durationMinutes,
      description: description || 'Timer task tracking session',
      createdAt: new Date()
    })
    await task.save()

    await ActivityLog.create({
      action: 'logged task time',
      entityType: 'task',
      entityId: task._id,
      entityName: `${task.title} (${durationMinutes}m)`,
      userId: req.user._id
    })

    res.json(enrichTask(task))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /:id/time-log
router.post('/:id/time-log', agencyOnly, async (req, res) => {
  try {
    const { durationMinutes, description } = req.body
    if (!durationMinutes || durationMinutes <= 0) {
      return res.status(400).json({ error: 'Valid duration is required' })
    }

    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })

    task.totalLoggedTime = (task.totalLoggedTime || 0) + Number(durationMinutes)
    task.timeLogs.push({
      userId: req.user._id,
      userName: req.user.name,
      durationMinutes: Number(durationMinutes),
      description: description || 'Manual time entry',
      createdAt: new Date()
    })
    await task.save()

    await ActivityLog.create({
      action: 'logged task time',
      entityType: 'task',
      entityId: task._id,
      entityName: `${task.title} (${durationMinutes}m)`,
      userId: req.user._id
    })

    res.json(enrichTask(task))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

