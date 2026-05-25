const express = require('express');
const router = express.Router();
const Queue = require('../models/Queue');

// GET all queues — sorted by order
router.get('/', async (req, res) => {
    try {
        const queues = await Queue.find().sort({ order: 1 });
        res.json(queues);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST new queue — saves appointment date and time
router.post('/', async (req, res) => {
    try {
        const queues = await Queue.find().sort({ order: 1 });

        const queue = new Queue({
            queueNumber: req.body.queueNumber,
            people: req.body.people,
            status: req.body.status || 'waiting',
            date: req.body.date || '',
            time: req.body.time || '',
            weight: req.body.weight || '',
            order: 0
        });

        // Find chronological insertion index
        let insertIdx = queues.length;
        for (let i = 0; i < queues.length; i++) {
            const q = queues[i];
            if (queue.date < q.date) {
                insertIdx = i;
                break;
            } else if (queue.date === q.date) {
                if (queue.time < q.time) {
                    insertIdx = i;
                    break;
                }
            }
        }

        queues.splice(insertIdx, 0, queue);

        for (let i = 0; i < queues.length; i++) {
            queues[i].order = i;
            if (queues[i] === queue) {
                await queue.save();
            } else {
                await Queue.findByIdAndUpdate(queues[i]._id, { order: i });
            }
        }

        res.status(201).json(queue);
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

        // Normalize orders
        const queues = await Queue.find().sort({ order: 1 });
        for (let i = 0; i < queues.length; i++) {
            await Queue.findByIdAndUpdate(queues[i]._id, { order: i });
        }

        res.json({ message: 'Deleted Queue' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT reorder (kept for backward compatibility)
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

// PUT /reorder/move — move a single entry up or down by swapping order values
router.put('/reorder/move', async (req, res) => {
    try {
        const { id, direction } = req.body;
        if (!id || !['up', 'down'].includes(direction)) {
            return res.status(400).json({ message: 'id and direction (up|down) are required' });
        }

        // Fetch all queues in display order
        const allQueues = await Queue.find().sort({ order: 1 });
        const idx = allQueues.findIndex(q => q._id.toString() === id);

        if (idx === -1) {
            return res.status(404).json({ message: 'Queue entry not found' });
        }

        let swapIdx;
        if (direction === 'up' && idx > 0) {
            swapIdx = idx - 1;
        } else if (direction === 'down' && idx < allQueues.length - 1) {
            swapIdx = idx + 1;
        } else {
            return res.status(400).json({ message: 'Cannot move in that direction' });
        }

        const target = allQueues[idx];
        const swapWith = allQueues[swapIdx];

        // Swap the two
        await Queue.findByIdAndUpdate(target._id, { order: swapIdx });
        await Queue.findByIdAndUpdate(swapWith._id, { order: idx });

        const updatedQueues = await Queue.find().sort({ order: 1 });
        res.json(updatedQueues);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /:id/appointment — update appointment date, time and/or weight for a queue entry
router.put('/:id/appointment', async (req, res) => {
    try {
        const { date, time, weight } = req.body;
        const target = await Queue.findById(req.params.id);
        if (!target) {
            return res.status(404).json({ message: 'Queue entry not found' });
        }

        if (date !== undefined) target.date = date;
        if (time !== undefined) target.time = time;
        if (weight !== undefined) target.weight = weight;

        await target.save();

        // Reposition it
        const queues = await Queue.find({ _id: { $ne: target._id } }).sort({ order: 1 });

        let insertIdx = queues.length;
        for (let i = 0; i < queues.length; i++) {
            const q = queues[i];
            if (target.date < q.date) {
                insertIdx = i;
                break;
            } else if (target.date === q.date) {
                if (target.time < q.time) {
                    insertIdx = i;
                    break;
                }
            }
        }

        queues.splice(insertIdx, 0, target);

        for (let i = 0; i < queues.length; i++) {
            await Queue.findByIdAndUpdate(queues[i]._id, { order: i });
        }

        const finalUpdated = await Queue.findById(target._id);
        res.json(finalUpdated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
