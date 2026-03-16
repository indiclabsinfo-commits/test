import { Router } from 'express';
import { economyRuntimeService } from '../services/EconomyRuntimeService.js';

const router = Router();

router.get('/active', async (_req, res) => {
  try {
    const notices = await economyRuntimeService.listNotices(false);
    res.json({ notices });
  } catch {
    res.status(500).json({ error: 'Failed to load notices' });
  }
});

export default router;
