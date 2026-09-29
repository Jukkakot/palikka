/** Error codes any command can return; game-specific codes are added next to their commands. */
export const COMMON_ERROR_CODES = ["INVALID_COMMAND", "INTERNAL_ERROR"] as const;
export type CommonErrorCode = (typeof COMMON_ERROR_CODES)[number];

/** Reply to every command sent with `room.request()`. */
export type CommandResult<Code extends string = string> = { ok: true } | { ok: false; code: Code | CommonErrorCode };
