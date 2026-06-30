import winston from 'winston'
import { getContext } from './context'

const { combine, timestamp, printf, colorize, json, errors } = winston.format

/**
 * List of sensitive keys to mask. Exported for easier expansion.
 * Matching does not distinguish between flower and common flowers.
 */
export const REDACT_KEYS = []
