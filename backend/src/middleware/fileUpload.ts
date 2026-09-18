import type { RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors';

const maxFileSize = 15 * 1024 * 1024;

const singleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
}).single('file');

export const uploadFile: RequestHandler = (req, res, next) => {
  singleFile(req, res, error => {
    if (error instanceof multer.MulterError) {
      next(new BadRequestError(
        error.code === 'LIMIT_FILE_SIZE'
          ? 'File must be 15 MB or smaller'
          : 'Unable to process file upload',
      ));
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};
