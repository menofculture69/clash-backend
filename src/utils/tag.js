import { BadRequestError } from './errors.js';

const tagRegex = /^#?[0289PYLQGRJCUV]+$/i;

export function normalizeTag(tag) {
  const normalized = tag.trim().toUpperCase().replaceAll(' ', '');
  if (!normalized) {
    throw new BadRequestError('Tag is required.');
  }

  if (!tagRegex.test(normalized)) {
    throw new BadRequestError('Invalid Clash tag format.');
  }

  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

export function encodeTag(tag) {
  return encodeURIComponent(normalizeTag(tag));
}