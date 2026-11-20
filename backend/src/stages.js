import { Router } from 'express';

const STAGE_NAME_MAX_LENGTH = 50;

function normalizeStageName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= STAGE_NAME_MAX_LENGTH ? name : null;
}

function publicStage(stage) {
  return { id: stage.id, name: stage.name, position: stage.position };
}

export function createStagesRouter({ pool }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, position FROM stages WHERE user_id = ? ORDER BY position, id',
        [req.userId],
      );
      return res.json({ stages: rows.map(publicStage) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    const name = normalizeStageName(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: `Stage name must be between 1 and ${STAGE_NAME_MAX_LENGTH} characters.` });
    }

    try {
      const [positions] = await pool.execute(
        'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM stages WHERE user_id = ?',
        [req.userId],
      );
      const position = positions[0].position;
      const [result] = await pool.execute(
        'INSERT INTO stages (user_id, name, position) VALUES (?, ?, ?)',
        [req.userId, name, position],
      );
      return res.status(201).json({ stage: { id: result.insertId, name, position } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A stage with that name already exists.' });
      }
      return next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const name = normalizeStageName(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: `Stage name must be between 1 and ${STAGE_NAME_MAX_LENGTH} characters.` });
    }

    try {
      await pool.execute(
        'UPDATE stages SET name = ? WHERE id = ? AND user_id = ?',
        [name, req.params.id, req.userId],
      );
      const [rows] = await pool.execute(
        'SELECT id, name, position FROM stages WHERE id = ? AND user_id = ? LIMIT 1',
        [req.params.id, req.userId],
      );
      if (!rows[0]) {
        return res.status(404).json({ error: 'Stage not found.' });
      }
      return res.json({ stage: publicStage(rows[0]) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A stage with that name already exists.' });
      }
      return next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const [result] = await pool.execute(
        'DELETE FROM stages WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Stage not found.' });
      }
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
