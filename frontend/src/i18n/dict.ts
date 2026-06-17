// Language resources live in JSON files under ./locales (en.json, vi.json).
// To add a country / normalize wording, edit the JSON resource files only — no code change.
// The two locales must keep an identical shape; `Dict` (derived from en.json) enforces that.

import en from './locales/en.json';
import vi from './locales/vi.json';

export type Lang = 'en' | 'vi';
export type Dict = typeof en;

export const dict: Record<Lang, Dict> = { en, vi };
