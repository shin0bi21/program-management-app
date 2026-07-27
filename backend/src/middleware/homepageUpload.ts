import type { RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const singleImage = upload.single('image');

export const uploadHomepageImage: RequestHandler = (req, res, next) => {
  singleImage(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      next(
        new BadRequestError(
          error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 10 MB or smaller' : 'Unable to process image upload',
        ),
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};
