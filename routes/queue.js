const express = require('express');
const router = express.Router();
const Queue = require('../models/Queue');

// GET all queues
router.get('/', async (req, res) => {
    try {
        const queues = await Queue.find().sort({ order: 1 });
        res.json(queues);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST new queue
router.post('/', async (req, res) => {
    try {
        const highestQueue = await Queue.findOne().sort('-order');
        let nextOrder = 0;
        if (highestQueue) {
            nextOrder = highestQueue.order + 1;
        }

        const queue = new Queue({
            queueNumber: req.body.queueNumber,
            people: req.body.people,
            status: req.body.status || 'waiting',
            order: nextOrder
        });

        const newQueue = await queue.save();
        res.status(201).json(newQueue);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT update status or data
router.put('/:id', async (req, res) => {
    try {
        if (req.body.status === 'working') {
            req.body.startedAt = new Date();
        } else if (req.body.status === 'waiting') {
            req.body.startedAt = null;
        }
        
        const updatedQueue = await Queue.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedQueue);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a queue
router.delete('/:id', async (req, res) => {
    try {
        await Queue.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted Queue' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT reorder
router.put('/reorder/bulk', async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!orderedIds || !Array.isArray(orderedIds)) {
            return res.status(400).json({ message: 'Invalid sort array' });
        }
        
        for (let i = 0; i < orderedIds.length; i++) {
            await Queue.findByIdAndUpdate(orderedIds[i], { order: i });
        }
        
        res.json({ message: 'Order updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
