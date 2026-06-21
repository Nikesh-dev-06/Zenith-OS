const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { File, ActivityLog, Project } = require('../models')
const { authenticate, agencyOnly } = require('../middleware/auth')

router.use(authenticate)

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
    const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/postscript', 'image/vnd.adobe.photoshop']
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('File type not supported'), false)
    }
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

    if (req.user.role === 'client') {
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
    const { projectId, isClientVisible = true } = req.body
    const createdFiles = []

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    for (const file of req.files) {
      const ext = file.originalname.split('.').pop().toLowerCase()
      const s3Key = file.filename

      const dbFile = await File.create({
        name: file.originalname,
        originalName: file.originalname,
        type: ext,
        mimeType: file.mimetype,
        size: file.size,
        s3Key,
        s3Bucket: 'local-disk',
        projectId,
        uploadedBy: req.user._id,
        isClientVisible: isClientVisible === 'true' || isClientVisible === true,
      })
      createdFiles.push(dbFile)

      await ActivityLog.create({ action: 'uploaded file', entityType: 'file', entityId: dbFile._id, entityName: file.originalname, userId: req.user._id })
    }

    const populated = await File.find({ _id: { $in: createdFiles.map(f => f._id) } }).populate('uploadedBy', 'name')
    res.status(201).json(populated.map(enrichFile))
  } catch (err) { res.status(400).json({ error: err.message }) }
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

