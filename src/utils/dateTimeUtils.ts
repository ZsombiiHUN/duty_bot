// src/utils/dateTimeUtils.ts
import logger from './logger'; // Import the logger

/**
 * Pads a number with a leading zero if it's less than 10.
 * @param {number} num The number to pad.
 * @returns {string} The padded string.
 * @private
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
}

/**
 * Formats a Date object into 'YYYY-MM-DD HH:MM' format.
 * Returns "Invalid Date" and logs an error if the input is not a valid Date.
 * @param {Date} date The Date object to format.
 * @returns {string} The formatted date string or "Invalid Date".
 * @export
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // Use the imported logger
    logger.error("Invalid date passed to formatDateTime:", { dateValue: date }); 
    return "Invalid Date"; // Return a placeholder or throw an error
  }
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

/**
 * Formats a Date object into 'YYYY-MM-DD' format.
 * Returns "Invalid Date" and logs an error if the input is not a valid Date.
 * @param {Date} date The Date object to format.
 * @returns {string} The formatted date string or "Invalid Date".
 * @export
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    logger.error("Invalid date passed to formatDate:", { dateValue: date });
    return "Invalid Date";
  }
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

/**
 * Parses a date string in 'YYYY-MM-DD HH:MM' format into a Date object.
 * Requires zero-padding for month, day, hour, and minute (e.g., '2024-01-05 09:08').
 * Throws an error for invalid format or date value.
 * @param {string} dateTimeStr The date string to parse (format: 'YYYY-MM-DD HH:MM').
 * @returns {Date} The parsed Date object.
 * @throws {Error} If the format is invalid or the date/time value is impossible.
 * @export
 */
export function parseDateTime(dateTimeStr: string): Date {
  // Format: YYYY-MM-DD HH:MM (Strictly enforce 2 digits for month, day, hour, minute)
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error('Invalid date/time format. Use YYYY-MM-DD HH:MM with zero-padding');
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-based months
  const day = parseInt(match[3]);
  const hour = parseInt(match[4]);
  const minute = parseInt(match[5]);
  
  const date = new Date(year, month, day, hour, minute);
  
  // Check if the constructed date is valid and matches the input components
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error('Invalid date/time value');
  }
  
  return date;
}

/**
 * Parses a date string in 'YYYY-MM-DD' format into a Date object.
 * Requires zero-padding for month and day (e.g., '2024-01-05').
 * Sets time to the beginning of the day (00:00:00 local time).
 * Throws an error for invalid format or date value.
 * @param {string} dateStr The date string to parse (format: 'YYYY-MM-DD').
 * @returns {Date} The parsed Date object.
 * @throws {Error} If the format is invalid or the date value is impossible.
 * @export
 */
export function parseDate(dateStr: string): Date {
  // Format: YYYY-MM-DD (Strictly enforce 2 digits for month and day)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error('Invalid date format. Use YYYY-MM-DD with zero-padding');
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-based months
  const day = parseInt(match[3]);
  
  // Use UTC to avoid timezone issues when creating the date
  const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)); 
  
  // Check if the constructed date is valid and matches the input components
  if (
    isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid date value');
  }
  
  // Return as a local Date object set to the beginning of the day
  return new Date(year, month, day, 0, 0, 0, 0); 
}

/**
 * Gets the Date object representing the start of the current week (Monday 00:00:00).
 * Assumes the week starts on Monday.
 * @returns {Date} The start of the current week.
 */
export function getStartOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const startOfWeek = new Date(now.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

/**
 * Gets the Date object representing the start of the current month (1st day 00:00:00).
 * @returns {Date} The start of the current month.
 */
export function getStartOfMonth(): Date {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  return startOfMonth;
}
