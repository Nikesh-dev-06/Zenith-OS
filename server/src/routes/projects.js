const express = require('express')
const { Project, ActivityLog, Client, Task } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')
const router = express.Router()

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichProject = async (proj) => {
  const [client, taskCount, completedTasks] = await Promise.all([
    Client.findById(proj.clientId).select('companyName'),
    Task.countDocuments({ projectId: proj._id, deletedAt: null }),
    Task.countDocuments({ projectId: proj._id, status: 'done', deletedAt: null }),
  ])
  const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0
  return {
    ...proj.toObject(),
    id: proj._id,
    clientName: client ? client.companyName : 'Unknown Client',
    progress,
    taskCount,
    completedTasks,
  }
}

router.get('/', async (req, res) => {
  try {
    const { clientId, status, page = 1, limit = 20 } = req.query
    const query = { deletedAt: null }
    if (clientId) query.clientId = clientId
    if (status && status !== 'all') query.status = status
    if (['client', 'client_viewer'].includes(req.user.role)) query.clientId = req.user.clientId

    const [projects, total] = await Promise.all([
      Project.find(query).populate('clientId', 'companyName').populate('teamMembers', 'name email').skip((page - 1) * limit).limit(+limit).sort({ createdAt: -1 }),
      Project.countDocuments(query),
    ])
    const enrichedProjects = await Promise.all(projects.map(enrichProject))
    res.json({ projects: enrichedProjects, total, page: +page, pages: Math.ceil(total / limit) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const project = await Project.create(req.body)
    await ActivityLog.create({ action: 'created project', entityType: 'project', entityId: project._id, entityName: project.name, userId: req.user._id })
    const enriched = await enrichProject(project)
    res.status(201).json(enriched)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('clientId', 'companyName email').populate('teamMembers', 'name email avatar')
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (['client', 'client_viewer'].includes(req.user.role) && project.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    const enriched = await enrichProject(project)
    res.json(enriched)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    const enriched = await enrichProject(project)
    res.json(enriched)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

module.exports = router

