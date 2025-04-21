// src/utils/dateTimeUtils.test.ts
import { formatDateTime } from './dateTimeUtils';
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

  // Clear mock calls after each test to ensure clean state
  afterEach(() => {
    jest.clearAllMocks();
  });
});
