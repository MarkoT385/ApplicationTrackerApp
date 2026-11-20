import { Router } from 'express';

const MAX_COMPANY_LENGTH = 150;
const MAX_ROLE_LENGTH = 150;
const MAX_NOTES_LENGTH = 10000;
const ID_PATTERN = /^[1-9]\d*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function validateApplication(body) {
  const companyName = normalizeText(body?.companyName, MAX_COMPANY_LENGTH);
  const roleTitle = normalizeText(body?.roleTitle, MAX_ROLE_LENGTH);
  if (!companyName || !roleTitle) {
    return { error: 'Company name and role title are required.' };
  }

  const jobLink = typeof body.jobLink === 'string' ? body.jobLink.trim() : '';
  if (jobLink) {
    try {
      const parsedLink = new URL(jobLink);
      if (!['http:', 'https:'].includes(parsedLink.protocol) || jobLink.length > 2048) throw new Error();
    } catch {
      return { error: 'Enter a valid http or https job link.' };
    }
  }

  const deadline = body.deadline === '' || body.deadline == null ? null : body.deadline;
  if (deadline !== null) {
    if (typeof deadline !== 'string' || !DATE_PATTERN.test(deadline)) {
      return { error: 'Enter a valid deadline.' };
    }
    const parsedDate = new Date(`${deadline}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== deadline) {
      return { error: 'Enter a valid deadline.' };
    }
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > MAX_NOTES_LENGTH) {
    return { error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` };
  }

  const stageId = body.stageId === '' || body.stageId == null ? null : body.stageId;
  if (stageId !== null && (typeof stageId !== 'number' && typeof stageId !== 'string' || !ID_PATTERN.test(String(stageId)))) {
    return { error: 'Select a valid stage.' };
  }

  return {
    value: {
      companyName,
      roleTitle,
      jobLink: jobLink || null,
      deadline,
      notes: notes || null,
      stageId,
    },
  };
}

function parseId(value) {
  return ID_PATTERN.test(value) ? value : null;
}

const APPLICATION_SELECT = `
  SELECT applications.id, applications.company_name AS companyName,
    applications.role_title AS roleTitle, applications.job_link AS jobLink,
    DATE_FORMAT(applications.deadline, '%Y-%m-%d') AS deadline,
    applications.notes, applications.stage_id AS stageId, stages.name AS stageName,
    applications.created_at AS createdAt, applications.updated_at AS updatedAt
  FROM applications
  LEFT JOIN stages ON stages.id = applications.stage_id AND stages.user_id = applications.user_id
`;

async function validateOwnedStage(pool, stageId, userId) {
  if (stageId === null) return true;
  const [rows] = await pool.execute(
    'SELECT id FROM stages WHERE id = ? AND user_id = ? LIMIT 1',
    [stageId, userId],
  );
  return rows.length > 0;
}

export function createApplicationsRouter({ pool }) {
  const router = Router();

  router.get('/summary', async (req, res, next) => {
    try {
      const [[totalRow]] = await pool.execute(
        'SELECT COUNT(*) AS totalApplications FROM applications WHERE user_id = ?',
        [req.userId],
      );
      const [stageCounts] = await pool.execute(
        `SELECT stages.id AS stageId, stages.name AS stageName, COUNT(applications.id) AS count
         FROM stages
         LEFT JOIN applications ON applications.stage_id = stages.id AND applications.user_id = stages.user_id
         WHERE stages.user_id = ?
         GROUP BY stages.id, stages.name, stages.position
         ORDER BY stages.position, stages.id`,
        [req.userId],
      );
      const [upcomingDeadlines] = await pool.execute(
        `${APPLICATION_SELECT}
         WHERE applications.user_id = ?
           AND applications.deadline >= CURRENT_DATE()
           AND applications.deadline <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
         ORDER BY applications.deadline ASC, applications.id ASC`,
        [req.userId],
      );

      return res.json({
        totalApplications: Number(totalRow.totalApplications),
        stageCounts: stageCounts.map((stage) => ({
          stageId: stage.stageId,
          stageName: stage.stageName,
          count: Number(stage.count),
        })),
        upcomingDeadlines,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `${APPLICATION_SELECT} WHERE applications.user_id = ? ORDER BY applications.updated_at DESC, applications.id DESC`,
        [req.userId],
      );
      return res.json({ applications: rows });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid application id.' });

    try {
      const [rows] = await pool.execute(
        `${APPLICATION_SELECT} WHERE applications.id = ? AND applications.user_id = ? LIMIT 1`,
        [id, req.userId],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Application not found.' });
      return res.json({ application: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    const validation = validateApplication(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });

    try {
      const application = validation.value;
      if (!(await validateOwnedStage(pool, application.stageId, req.userId))) {
        return res.status(400).json({ error: 'Select one of your stages.' });
      }
      const [result] = await pool.execute(
        `INSERT INTO applications (user_id, stage_id, company_name, role_title, job_link, deadline, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, application.stageId, application.companyName, application.roleTitle,
          application.jobLink, application.deadline, application.notes],
      );
      const [rows] = await pool.execute(
        `${APPLICATION_SELECT} WHERE applications.id = ? AND applications.user_id = ? LIMIT 1`,
        [result.insertId, req.userId],
      );
      return res.status(201).json({ application: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid application id.' });
    const validation = validateApplication(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });

    try {
      const application = validation.value;
      if (!(await validateOwnedStage(pool, application.stageId, req.userId))) {
        return res.status(400).json({ error: 'Select one of your stages.' });
      }
      const [result] = await pool.execute(
        `UPDATE applications
         SET stage_id = ?, company_name = ?, role_title = ?, job_link = ?, deadline = ?, notes = ?
         WHERE id = ? AND user_id = ?`,
        [application.stageId, application.companyName, application.roleTitle, application.jobLink,
          application.deadline, application.notes, id, req.userId],
      );
      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          'SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1',
          [id, req.userId],
        );
        if (!existing[0]) return res.status(404).json({ error: 'Application not found.' });
      }
      const [rows] = await pool.execute(
        `${APPLICATION_SELECT} WHERE applications.id = ? AND applications.user_id = ? LIMIT 1`,
        [id, req.userId],
      );
      return res.json({ application: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/stage', async (req, res, next) => {
    const id = parseId(req.params.id);
    const stageId = req.body?.stageId;
    if (!id) return res.status(400).json({ error: 'Invalid application id.' });
    if (stageId !== null && (typeof stageId !== 'number' && typeof stageId !== 'string' || !ID_PATTERN.test(String(stageId)))) {
      return res.status(400).json({ error: 'Select a valid stage.' });
    }

    try {
      if (!(await validateOwnedStage(pool, stageId, req.userId))) {
        return res.status(400).json({ error: 'Select one of your stages.' });
      }
      const [result] = await pool.execute(
        'UPDATE applications SET stage_id = ? WHERE id = ? AND user_id = ?',
        [stageId, id, req.userId],
      );
      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          'SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1',
          [id, req.userId],
        );
        if (!existing[0]) return res.status(404).json({ error: 'Application not found.' });
      }
      const [rows] = await pool.execute(
        `${APPLICATION_SELECT} WHERE applications.id = ? AND applications.user_id = ? LIMIT 1`,
        [id, req.userId],
      );
      return res.json({ application: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid application id.' });

    try {
      const [result] = await pool.execute(
        'DELETE FROM applications WHERE id = ? AND user_id = ?',
        [id, req.userId],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Application not found.' });
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
