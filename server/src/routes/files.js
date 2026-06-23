const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { File, ActivityLog, Project } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const uploadsDir = path.resolve(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    cb(null, true)
  },
})

const enrichFile = (file) => {
  return {
    ...file.toObject(),
    id: file._id,
    uploadedByName: file.uploadedBy ? file.uploadedBy.name : 'Unknown User',
    url: `http://localhost:5000/api/files/download-raw/${file._id}`,
  }
}

router.get('/', async (req, res) => {
  try {
    const query = { deletedAt: null }
    const { projectId } = req.query

    if (['client', 'client_viewer'].includes(req.user.role)) {
      query.isClientVisible = true
      const clientProjects = await Project.find({ clientId: req.user.clientId, deletedAt: null }).select('_id')
      const projectIds = clientProjects.map(p => p._id)
      if (projectId) {
        if (!projectIds.some(id => id.toString() === projectId.toString())) {
          return res.status(403).json({ error: 'Access denied to this project\'s files' })
        }
        query.projectId = projectId
      } else {
        query.projectId = { $in: projectIds }
      }
    } else {
      if (projectId) query.projectId = projectId
    }

    const files = await File.find(query).populate('uploadedBy', 'name').sort({ createdAt: -1 })
    res.json(files.map(enrichFile))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { projectId, isClientVisible = true, conflictAction, customName, description } = req.body
    const createdFiles = []

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    for (const file of req.files) {
      const ext = file.originalname.split('.').pop().toLowerCase()
      const s3Key = file.filename
      
      let name = customName || file.originalname
      if (customName && !customName.endsWith('.' + ext)) {
        name = customName + '.' + ext
      }

      let dbFile
      if (conflictAction === 'version' || conflictAction === 'overwrite') {
        dbFile = await File.findOne({ name, projectId, deletedAt: null })
      }

      if (dbFile) {
        // Delete old file physically
        const oldFilePath = path.join(uploadsDir, dbFile.s3Key)
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath) } catch (e) {}
        }

        dbFile.s3Key = s3Key
        dbFile.size = file.size
        dbFile.mimeType = file.mimetype
        dbFile.uploadedBy = req.user._id
        dbFile.description = description || dbFile.description
        if (conflictAction === 'version') {
          dbFile.version = (dbFile.version || 1) + 1
        } else {
          dbFile.version = 1
        }
        await dbFile.save()

        await ActivityLog.create({
          action: conflictAction === 'version' ? 'uploaded new version of file' : 'overwrote file',
          entityType: 'file',
          entityId: dbFile._id,
          entityName: name,
          userId: req.user._id
        })
        createdFiles.push(dbFile)
      } else {
        const newFile = await File.create({
          name,
          originalName: file.originalname,
          type: ext,
          mimeType: file.mimetype,
          size: file.size,
          s3Key,
          s3Bucket: 'local-disk',
          projectId,
          uploadedBy: req.user._id,
          isClientVisible: isClientVisible === 'true' || isClientVisible === true,
          description,
          version: 1,
        })
        createdFiles.push(newFile)

        await ActivityLog.create({
          action: 'uploaded file',
          entityType: 'file',
          entityId: newFile._id,
          entityName: name,
          userId: req.user._id
        })
      }
    }

    const populated = await File.find({ _id: { $in: createdFiles.map(f => f._id) } }).populate('uploadedBy', 'name')
    res.status(201).json(populated.map(enrichFile))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id).populate('uploadedBy', 'name')
    if (!file || file.deletedAt) return res.status(404).json({ error: 'File not found' })

    // Check permission for client role
    if (req.user.role === 'client') {
      if (!file.isClientVisible) return res.status(403).json({ error: 'Access denied' })
      const clientProjects = await Project.find({ clientId: req.user.clientId, deletedAt: null }).select('_id')
      const projectIds = clientProjects.map(p => p._id.toString())
      if (!projectIds.includes(file.projectId.toString())) {
        return res.status(403).json({ error: 'Access denied to this file' })
      }
    }

    res.json(enrichFile(file))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/:id/download', async (req, res) => {
  try {
    const file = await File.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } }, { new: true })
    if (!file) return res.status(404).json({ error: 'File not found' })
    res.json({ downloadUrl: `http://localhost:5000/api/files/download-raw/${file._id}`, expiresIn: 3600 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/download-raw/:id', async (req, res) => {
  try {
    const file = await File.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } }, { new: true })
    if (!file) return res.status(404).json({ error: 'File not found' })
    const filePath = path.join(uploadsDir, file.s3Key)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' })
    }
    res.download(filePath, file.name)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'File name is required' })
    const file = await File.findByIdAndUpdate(req.params.id, { name }, { new: true })
    if (!file) return res.status(404).json({ error: 'File not found' })
    res.json(enrichFile(file))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const file = await File.findByIdAndUpdate(req.params.id, { deletedAt: new Date() })
    if (!file) return res.status(404).json({ error: 'File not found' })
    res.json({ message: 'File deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

