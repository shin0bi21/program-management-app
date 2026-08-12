import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createTask, deleteTask, getTaskList, getTaskOptions, getTasks, updateTask, updateTaskPlacement, updateTaskStatus } from '../services/taskService';
import type { TaskListQuery, TaskQuery } from '../validation/taskSchemas';

export async function handleGetTasks(req: Request, res: Response) {
  const query = req.query as unknown as TaskQuery;
  res.json(await getTasks((req as AuthRequest).user!, query));
}

export async function handleGetTaskList(req: Request, res: Response) {
  const query = req.query as unknown as TaskListQuery;
  res.json(await getTaskList((req as AuthRequest).user!, query));
}

export async function handleGetTaskOptions(req: Request, res: Response) {
  res.json(await getTaskOptions((req as AuthRequest).user!));
}

export async function handleCreateTask(req: Request, res: Response) {
  res.status(201).json(await createTask(req.body, (req as AuthRequest).user!));
}

export async function handleUpdateTask(req: Request, res: Response) {
  res.json(await updateTask(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleUpdateTaskStatus(req: Request, res: Response) {
  res.json(await updateTaskStatus(req.params.id, req.body.status, (req as AuthRequest).user!));
}

export async function handleUpdateTaskPlacement(req: Request, res: Response) {
  res.json(await updateTaskPlacement(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleDeleteTask(req: Request, res: Response) {
  await deleteTask(req.params.id, (req as AuthRequest).user!);
  res.status(204).send();
}
