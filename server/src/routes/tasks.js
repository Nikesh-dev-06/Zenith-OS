// tasks.js
const express = require('express')
const { Task, ActivityLog, Project } = require('../models')
const { authenticate, agencyOnly } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)

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

module.exports = router

