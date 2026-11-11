import { Router } from 'express';
import { getMeta } from '../meta.js';

export const metaRouter = Router();

/** GET /api/meta/filters — listas reais das dimensões do banco. */
metaRouter.get('/meta/filters', (req, res) => {
  res.json(getMeta());
});
