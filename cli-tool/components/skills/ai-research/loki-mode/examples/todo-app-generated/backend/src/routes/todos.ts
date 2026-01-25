import { Router, Request, Response } from 'express';
import db from '../db/db';
import { ApiResponse, Todo } from '../types/index';

const router = Router();

// GET /api/todos - Retrieve all todos
router.get('/todos', (_req: Request, res: Response): void => {
  db.all('SELECT * FROM todos ORDER BY createdAt DESC', (err: any, rows: Todo[]) => {
    if (err) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Database error',
      };
      res.status(500).json(errorResponse);
      return;
    }

    const successResponse: ApiResponse<Todo[]> = {
      success: true,
      data: rows || [],
    };
    res.json(successResponse);
  });
});

// POST /api/todos - Create new todo
router.post('/todos', (req: Request, res: Response): void => {
  const { title } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    return;
  }

  const trimmedTitle = title.trim();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO todos (title, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    [trimmedTitle, 0, now, now],
    function(this: any, err: Error | null) {
      if (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
        return;
      }

      // Return created todo
      db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err: any, row: Todo) => {
        if (err) {
          res.status(500).json({ error: 'Database error', details: err.message });
          return;
        }

        const successResponse: ApiResponse<Todo> = {
          success: true,
          data: row,
        };
        res.status(201).json(successResponse);
      });
    }
  );
});

// PATCH /api/todos/:id - Update todo completion status
router.patch('/todos/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { completed } = req.body;

  // Validation
  if (typeof completed !== 'boolean') {
    res.status(400).json({ error: 'Completed must be a boolean value' });
    return;
  }

  // Check if todo exists
  db.get('SELECT * FROM todos WHERE id = ?', [id], (err: any, row: Todo) => {
    if (err) {
      res.status(500).json({ error: 'Database error', details: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const now = new Date().toISOString();

    // Update todo
    db.run(
      'UPDATE todos SET completed = ?, updatedAt = ? WHERE id = ?',
      [completed ? 1 : 0, now, id],
      function(err: Error | null) {
        if (err) {
          res.status(500).json({ error: 'Database error', details: err.message });
          return;
        }

        // Return updated todo
        db.get('SELECT * FROM todos WHERE id = ?', [id], (err: any, updatedRow: Todo) => {
          if (err) {
            res.status(500).json({ error: 'Database error', details: err.message });
            return;
          }

          const successResponse: ApiResponse<Todo> = {
            success: true,
            data: updatedRow,
          };
          res.json(successResponse);
        });
      }
    );
  });
});

// DELETE /api/todos/:id - Delete todo by id
router.delete('/todos/:id', (req: Request, res: Response): void => {
  const { id } = req.params;

  // Validation - check if id is a valid number
  if (!id || isNaN(Number(id))) {
    res.status(400).json({ error: 'Invalid id parameter' });
    return;
  }

  // Check if todo exists
  db.get('SELECT * FROM todos WHERE id = ?', [id], (err: any, row: Todo) => {
    if (err) {
      res.status(500).json({ error: 'Database error', details: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    // Delete todo
    db.run(
      'DELETE FROM todos WHERE id = ?',
      [id],
      function(err: Error | null) {
        if (err) {
          res.status(500).json({ error: 'Database error', details: err.message });
          return;
        }

        res.json({ message: 'Todo deleted successfully' });
      }
    );
  });
});

export default router;
