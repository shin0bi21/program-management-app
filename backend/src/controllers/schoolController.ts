import { Request, Response } from 'express';
import { sql } from '../db/client';

export const getSchools = async (req: Request, res: Response) => {
  try {
    const schools = await sql`
      SELECT id, name, school_type, board
      FROM schools
      ORDER BY name ASC
    `;

    res.json(schools);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
};
