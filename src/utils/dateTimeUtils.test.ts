// src/utils/dateTimeUtils.test.ts
import { formatDateTime, formatDate, parseDateTime, parseDate } from './dateTimeUtils';
import logger from './logger'; // Import logger to potentially mock it

// Mock the logger to prevent actual logging during tests and spy on calls
jest.mock('./logger', () => ({
  error: jest.fn(),
}));

describe('dateTimeUtils', () => {
  describe('formatDateTime', () => {
    it('should format a valid Date object correctly', () => {
      const date = new Date(2024, 3, 19, 10, 56, 0); // Note: Month is 0-indexed (3 = April)
      expect(formatDateTime(date)).toBe('2024-04-19 10:56');
    });

    it('should format a date needing padding for month and day', () => {
      const date = new Date(2023, 0, 5, 15, 30, 0); // January 5th
      expect(formatDateTime(date)).toBe('2023-01-05 15:30');
    });

    it('should format a date needing padding for hour and minute', () => {
      const date = new Date(2023, 10, 20, 7, 5, 0); // November 20th, 07:05
      expect(formatDateTime(date)).toBe('2023-11-20 07:05');
    });

    it('should return "Invalid Date" and log an error for an invalid Date object', () => {
      const invalidDate = new Date('not a real date');
      expect(formatDateTime(invalidDate)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDateTime:", { dateValue: invalidDate });
    });

    it('should return "Invalid Date" and log an error for null input', () => {
      // Need to cast null to any to satisfy TypeScript, but test the runtime behavior
      const nullInput = null as any;
      expect(formatDateTime(nullInput)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDateTime:", { dateValue: nullInput });
    });

    it('should return "Invalid Date" and log an error for undefined input', () => {
      const undefinedInput = undefined as any;
      expect(formatDateTime(undefinedInput)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDateTime:", { dateValue: undefinedInput });
    });

     it('should return "Invalid Date" and log an error for non-Date input', () => {
      const stringInput = "2024-04-19 10:00" as any;
      expect(formatDateTime(stringInput)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDateTime:", { dateValue: stringInput });
    });
  });

  describe('formatDate', () => {
    it('should format a valid Date object correctly', () => {
      const date = new Date(2024, 3, 19, 10, 56, 0); // April 19th
      expect(formatDate(date)).toBe('2024-04-19');
    });

    it('should format a date needing padding for month and day', () => {
      const date = new Date(2023, 0, 5, 15, 30, 0); // January 5th
      expect(formatDate(date)).toBe('2023-01-05');
    });

    it('should return "Invalid Date" and log an error for an invalid Date object', () => {
      const invalidDate = new Date('not a real date');
      expect(formatDate(invalidDate)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDate:", { dateValue: invalidDate });
    });

    it('should return "Invalid Date" and log an error for null input', () => {
      const nullInput = null as any;
      expect(formatDate(nullInput)).toBe('Invalid Date');
      expect(logger.error).toHaveBeenCalledWith("Invalid date passed to formatDate:", { dateValue: nullInput });
    });
  });

  describe('parseDateTime', () => {
    it('should parse a valid date/time string correctly', () => {
      const dateTimeStr = '2024-04-19 10:56';
      const expectedDate = new Date(2024, 3, 19, 10, 56, 0); // Month is 0-indexed
      expect(parseDateTime(dateTimeStr)).toEqual(expectedDate);
    });

    it('should parse a date/time string needing padding', () => {
      const dateTimeStr = '2023-01-05 07:08';
      const expectedDate = new Date(2023, 0, 5, 7, 8, 0);
      expect(parseDateTime(dateTimeStr)).toEqual(expectedDate);
    });

    it('should throw an error for invalid format (missing space)', () => {
      const dateTimeStr = '2024-04-1910:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time format. Use YYYY-MM-DD HH:MM');
    });

    it('should throw an error for invalid format (wrong separators)', () => {
      const dateTimeStr = '2024/04/19 10:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time format. Use YYYY-MM-DD HH:MM');
    });
    
    it('should throw an error for invalid format (too few digits)', () => {
      const dateTimeStr = '2024-4-19 10:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time format. Use YYYY-MM-DD HH:MM');
    });

    it('should throw an error for invalid date value (e.g., month 13)', () => {
      const dateTimeStr = '2024-13-19 10:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time value');
    });

    it('should throw an error for invalid date value (e.g., day 32)', () => {
      const dateTimeStr = '2024-04-32 10:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time value');
    });
    
    it('should throw an error for invalid time value (e.g., hour 25)', () => {
      const dateTimeStr = '2024-04-19 25:56';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time value');
    });
    
    it('should throw an error for invalid time value (e.g., minute 60)', () => {
      const dateTimeStr = '2024-04-19 10:60';
      expect(() => parseDateTime(dateTimeStr)).toThrow('Invalid date/time value');
    });

    it('should throw an error for non-string input', () => {
      const dateInput = new Date() as any;
      expect(() => parseDateTime(dateInput)).toThrow(); // General error for wrong type
    });
  });

  describe('parseDate', () => {
    it('should parse a valid date string correctly, setting time to 00:00', () => {
      const dateStr = '2024-04-19';
      const expectedDate = new Date(2024, 3, 19, 0, 0, 0, 0); // Month 0-indexed, time 00:00
      expect(parseDate(dateStr)).toEqual(expectedDate);
    });

    it('should parse a date string needing padding', () => {
      const dateStr = '2023-01-05';
      const expectedDate = new Date(2023, 0, 5, 0, 0, 0, 0);
      expect(parseDate(dateStr)).toEqual(expectedDate);
    });

    it('should throw an error for invalid format (missing dashes)', () => {
      const dateStr = '20240419';
      expect(() => parseDate(dateStr)).toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should throw an error for invalid format (wrong separators)', () => {
      const dateStr = '2024/04/19';
      expect(() => parseDate(dateStr)).toThrow('Invalid date format. Use YYYY-MM-DD');
    });
    
    it('should throw an error for invalid format (too few digits)', () => {
      const dateStr = '2024-4-19';
       expect(() => parseDate(dateStr)).toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should throw an error for invalid date value (e.g., month 13)', () => {
      const dateStr = '2024-13-19';
      expect(() => parseDate(dateStr)).toThrow('Invalid date value');
    });

    it('should throw an error for invalid date value (e.g., day 32)', () => {
      const dateStr = '2024-04-32';
      expect(() => parseDate(dateStr)).toThrow('Invalid date value');
    });

    it('should throw an error for non-string input', () => {
      const dateInput = new Date() as any;
      expect(() => parseDate(dateInput)).toThrow(); // General error for wrong type
    });
  });

  // Clear mock calls after each test to ensure clean state
  afterEach(() => {
    jest.clearAllMocks();
  });
});
