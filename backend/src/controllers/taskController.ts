import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getTaskList } from '../services/staff/tasks/taskListService';
import { getTasksCalendarData } from '../services/staff/tasks/taskCalendarService';
import { deleteTask, getOpenTasks, getTaskReferenceData, setTask, updateTaskPlacement, updateTaskState } from '../services/staff/tasks/taskService';
import type { OpenTaskQuery, TaskCalendarQuery, TaskListQuery } from '../validation/taskSchemas';

export async function handleGetOpenTasks(req: Request, res: Response) {
  const query = req.query as unknown as OpenTaskQuery;
  res.json(await getOpenTasks((req as AuthRequest).user!, query));
}

export async function handleGetTaskList(req: Request, res: Response) {
  const query = req.query as unknown as TaskListQuery;
  res.json(await getTaskList((req as AuthRequest).user!, query));
}

export async function handleGetTasksCalendarData(req: Request, res: Response) {
  const query = req.query as unknown as TaskCalendarQuery;
  res.json(await getTasksCalendarData((req as AuthRequest).user!, query));
}

export async function handleGetTaskReferenceData(req: Request, res: Response) {
  res.json(await getTaskReferenceData((req as AuthRequest).user!));
}

export async function handleSetTask(req: Request, res: Response) {
  const id = req.params.id;
  res.status(id ? 200 : 201).json(await setTask(req.body, (req as AuthRequest).user!, id));
}

export async function handleUpdateTaskState(req: Request, res: Response) {
  res.json(await updateTaskState(req.params.id, req.body.state, (req as AuthRequest).user!));
}

export async function handleUpdateTaskPlacement(req: Request, res: Response) {
  res.json(await updateTaskPlacement(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleDeleteTask(req: Request, res: Response) {
  await deleteTask(req.params.id, (req as AuthRequest).user!);
  res.status(204).send();
}
