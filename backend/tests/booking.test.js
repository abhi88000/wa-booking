// ============================================================
// Test Suite — Booking Engine + API Routes
// ============================================================

const pool = require('../src/db/pool');

// ── Mock WhatsApp Service ─────────────────────────────────
function createMockWa() {
  return {
    sendText: jest.fn().mockResolvedValue('mock_msg_id'),
    sendButtons: jest.fn().mockResolvedValue('mock_msg_id'),
    sendList: jest.fn().mockResolvedValue('mock_msg_id'),
    sendTemplate: jest.fn().mockResolvedValue('mock_msg_id'),
    markRead: jest.fn().mockResolvedValue(null)
  };
}

// ── Mock Tenant & Patient ─────────────────────────────────
const mockTenant = {
  id: '00000000-0000-0000-0000-000000000001',
  business_name: 'Test Clinic',
  wa_phone_number_id: '123456',
  wa_access_token: 'test_token',
  settings: { auto_confirm: true, booking_window_days: 14 },
  features: { booking: true }
};

const mockPatient = {
  id: '00000000-0000-0000-0000-000000000002',
  phone: '919876543210',
  name: 'Test Patient',
  wa_conversation_state: { state: 'new' }
};

// ── Booking Engine Tests ──────────────────────────────────
describe('BookingEngine', () => {
  const BookingEngine = require('../src/services/bookingEngine');

  let engine;
  let mockWa;

  beforeEach(() => {
    mockWa = createMockWa();
    engine = new BookingEngine(mockTenant, mockPatient, mockWa);
    // Mock setState to avoid DB calls
    engine.setState = jest.fn().mockResolvedValue(null);
  });

  test('greeting shows doctor list or welcome', async () => {
    // Mock the database query for doctors
    const originalQuery = pool.query;
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [
        { id: 'doc1', name: 'Dr. Sharma', specialization: 'General' },
        { id: 'doc2', name: 'Dr. Patel', specialization: 'Dental' }
      ]
    });

    await engine.handleMessage('hi', 'text', null);

    // Should have called sendList or sendButtons (showing doctors)
    const called = mockWa.sendList.mock.calls.length > 0 || mockWa.sendButtons.mock.calls.length > 0;
    expect(called).toBe(true);

    pool.query = originalQuery;
  });

  test('cancel_booking resets state to idle', async () => {
    engine.patient.wa_conversation_state = { state: 'awaiting_doctor' };

    await engine.handleMessage('cancel_booking', 'interactive', { type: 'button', id: 'cancel_booking' });

    expect(engine.setState).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'idle' })
    );
    expect(mockWa.sendText).toHaveBeenCalledWith(
      mockPatient.phone,
      expect.stringContaining('cancelled')
    );
  });

  test('invalid doctor selection shows retry buttons', async () => {
    engine.patient.wa_conversation_state = { state: 'awaiting_doctor' };

    const originalQuery = pool.query;
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] }); // no matching doctor

    await engine.handleMessage('garbage_id', 'text', null);

    expect(mockWa.sendButtons).toHaveBeenCalledWith(
      mockPatient.phone,
      expect.objectContaining({
        bodyText: expect.stringContaining('Invalid selection')
      })
    );

    pool.query = originalQuery;
  });

  test('help command sends help text', async () => {
    engine.patient.wa_conversation_state = { state: 'idle' };

    await engine.handleMessage('help', 'text', null);

    expect(mockWa.sendText).toHaveBeenCalledWith(
      mockPatient.phone,
      expect.stringContaining('Help')
    );
  });

  test('status command queries appointments', async () => {
    engine.patient.wa_conversation_state = { state: 'idle' };

    const originalQuery = pool.query;
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [{
        doctor_name: 'Dr. Sharma',
        appointment_date: '2026-04-15',
        start_time: '10:00',
        status: 'confirmed'
      }]
    });

    await engine.handleMessage('status', 'text', null);

    expect(mockWa.sendText).toHaveBeenCalled();

    pool.query = originalQuery;
  });
});

// ── Error Classes Tests ───────────────────────────────────
describe('AppError Classes', () => {
  const { AppError, NotFoundError, ValidationError, ConflictError } = require('../src/utils/errors');

  test('AppError has correct properties', () => {
    const err = new AppError('test error', 400, 'TEST');
    expect(err.message).toBe('test error');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST');
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  test('NotFoundError defaults to 404', () => {
    const err = new NotFoundError('Doctor');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Doctor not found');
    expect(err.code).toBe('NOT_FOUND');
  });

  test('ValidationError defaults to 400', () => {
    const err = new ValidationError('Bad email');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad email');
  });

  test('ConflictError defaults to 409', () => {
    const err = new ConflictError('Slot taken');
    expect(err.statusCode).toBe(409);
  });
});

// ── Error Handler Middleware Tests ─────────────────────────
describe('Error Handler Middleware', () => {
  const errorHandler = require('../src/middleware/errorHandler');
  const { NotFoundError, ValidationError } = require('../src/utils/errors');

  function createMockRes() {
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    return res;
  }

  test('handles AppError with correct status', () => {
    const err = new NotFoundError('Doctor');
    const res = createMockRes();
    errorHandler(err, { path: '/test', method: 'GET' }, res, () => {});

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Doctor not found');
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('handles ValidationError', () => {
    const err = new ValidationError('Invalid email');
    const res = createMockRes();
    errorHandler(err, { path: '/test', method: 'POST' }, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('handles PostgreSQL unique constraint violation', () => {
    const err = new Error('duplicate key');
    err.code = '23505';
    const res = createMockRes();
    errorHandler(err, { path: '/test', method: 'POST' }, res, () => {});

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE');
  });

  test('handles unknown errors as 500', () => {
    const err = new Error('something broke');
    const res = createMockRes();
    errorHandler(err, { path: '/test', method: 'GET' }, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

// ── Utility Tests ─────────────────────────────────────────
describe('Time Utilities', () => {
  const BookingEngine = require('../src/services/bookingEngine');

  let engine;
  beforeEach(() => {
    engine = new BookingEngine(mockTenant, mockPatient, createMockWa());
  });

  test('formatTime converts 24h to 12h', () => {
    expect(engine.formatTime('09:00')).toBe('9:00 AM');
    expect(engine.formatTime('13:30')).toBe('1:30 PM');
    expect(engine.formatTime('00:00')).toBe('12:00 AM');
    expect(engine.formatTime('12:00')).toBe('12:00 PM');
  });

  test('timeToMinutes converts time string', () => {
    expect(engine.timeToMinutes('09:00')).toBe(540);
    expect(engine.timeToMinutes('13:30')).toBe(810);
  });

  test('minutesToTime converts minutes back', () => {
    expect(engine.minutesToTime(540)).toBe('09:00');
    expect(engine.minutesToTime(810)).toBe('13:30');
  });
});
