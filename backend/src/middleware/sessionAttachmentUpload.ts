import type { RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const singleAttachment = upload.single('file');

export const uploadSessionAttachment: RequestHandler = (req, res, next) => {
  singleAttachment(req, res, error => {
    if (error instanceof multer.MulterError) {
      next(new BadRequestError(
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Attachment must be 15 MB or smaller'
          : 'Unable to process attachment upload',
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
