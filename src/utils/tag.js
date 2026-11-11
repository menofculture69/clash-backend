import { BadRequestError } from './errors.js';

const tagRegex = /^#?[0289PYLQGRJCUV]+$/i;
const guestTagRegex = /^#?GUEST-[A-F0-9]{12}$/i;

export function normalizeTag(tag) {
  const normalized = tag.trim().toUpperCase().replaceAll(' ', '');
  if (!normalized) {
    throw new BadRequestError('Tag is required.');
  }

  if (!tagRegex.test(normalized) && !guestTagRegex.test(normalized)) {
    throw new BadRequestError('Invalid Clash tag format.');
  }

  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

export function isGuestTag(tag) {
  return guestTagRegex.test(String(tag ?? '').trim());
}

export function encodeTag(tag) {
  return encodeURIComponent(normalizeTag(tag));
}
