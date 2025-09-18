export const ALLOWED_CLASS_NAMES = ["KA", "KB", "KC", "KD"] as const;
export type AllowedClassName = typeof ALLOWED_CLASS_NAMES[number];
