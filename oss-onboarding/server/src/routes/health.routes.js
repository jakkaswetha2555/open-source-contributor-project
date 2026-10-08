import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Proof-of-life endpoint: reports API and database state.
router.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', database: states[mongoose.connection.readyState] ?? 'unknown' });
});

export default router;
