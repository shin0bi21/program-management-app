import type { RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError, PayloadTooLargeError } from '../errors';

const maxFileSize = 15 * 1024 * 1024;

const singleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
}).single('file');

export const uploadFile: RequestHandler = (req, res, next) => {
  singleFile(req, res, error => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new PayloadTooLargeError('File must be 15 MB or smaller'));
      } else {
        next(new BadRequestError('Unable to process file upload'));
      }
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};
