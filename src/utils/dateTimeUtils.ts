// src/utils/dateTimeUtils.ts
import logger from './logger'; // Import the logger

/**
 * Pads a number with a leading zero if it's less than 10.
 * @param num The number to pad.
 * @returns The padded string.
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
}

/**
 * Formats a Date object into 'YYYY-MM-DD HH:MM' format.
 * @param date The Date object to format.
 * @returns The formatted date string.
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // Use the imported logger
    logger.error("Invalid date passed to formatDateTime:", { dateValue: date }); 
    return "Invalid Date"; // Return a placeholder or throw an error
  }
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

// Note: parseDateTime is kept in dutyshift.ts as it's only used there for command input parsing.
