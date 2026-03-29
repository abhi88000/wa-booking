const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// ============================================
// Auth Middleware
// ============================================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// AUTH ROUTES
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM admin_users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register admin (protected — only existing admins can create new ones)
app.post('/api/auth/register', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { email, password, name, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, role || 'staff']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE AND status IN ('confirmed', 'pending')) AS today_appointments,
        (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE + 1 AND status IN ('confirmed', 'pending')) AS tomorrow_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM appointments WHERE status = 'confirmed' AND appointment_date >= CURRENT_DATE) AS confirmed_count,
        (SELECT COUNT(*) FROM appointments WHERE status = 'cancelled' AND updated_at >= CURRENT_DATE - INTERVAL '30 days') AS cancelled_30d,
        (SELECT COUNT(*) FROM patients) AS total_patients,
        (SELECT COUNT(*) FROM patients WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS new_patients_7d,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND paid_at >= CURRENT_DATE - INTERVAL '30 days') AS revenue_30d
    `);
    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// APPOINTMENTS
// ============================================

// List appointments (with filters)
app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    const { date, status, doctor_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let paramIdx = 1;

    if (date) {
      where.push(`a.appointment_date = $${paramIdx++}`);
      params.push(date);
    }
    if (status) {
      where.push(`a.status = $${paramIdx++}`);
      params.push(status);
    }
    if (doctor_id) {
      where.push(`a.doctor_id = $${paramIdx++}`);
      params.push(doctor_id);
    }

    const query = `
      SELECT a.*, 
             p.name AS patient_name, p.phone AS patient_phone,
             d.name AS doctor_name, d.specialization,
             s.name AS service_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY a.appointment_date DESC, a.start_time DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM appointments a WHERE ${where.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      appointments: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) {
    console.error('Appointments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update appointment status
app.patch('/api/appointments/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// DOCTORS
// ============================================

app.get('/api/doctors', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.appointment_date = CURRENT_DATE AND a.status IN ('confirmed', 'pending')) AS today_appointments
      FROM doctors d
      WHERE d.is_active = true
      ORDER BY d.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Doctors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/doctors', authenticate, async (req, res) => {
  try {
    const { name, specialization, phone, email, consultation_fee, slot_duration, clinic_id } = req.body;
    const result = await pool.query(
      `INSERT INTO doctors (clinic_id, name, specialization, phone, email, consultation_fee, slot_duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [clinic_id || '11111111-1111-1111-1111-111111111111', name, specialization, phone, email, consultation_fee || 0, slot_duration || 30]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/doctors/:id', authenticate, async (req, res) => {
  try {
    const { name, specialization, phone, email, consultation_fee, slot_duration, is_active } = req.body;
    const result = await pool.query(
      `UPDATE doctors SET name=$1, specialization=$2, phone=$3, email=$4, consultation_fee=$5, slot_duration=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [name, specialization, phone, email, consultation_fee, slot_duration, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update doctor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// PATIENTS
// ============================================

app.get('/api/patients', authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = '1=1';
    let params = [];
    let paramIdx = 1;

    if (search) {
      where = `(p.name ILIKE $${paramIdx} OR p.phone ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const result = await pool.query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) AS total_appointments,
              (SELECT MAX(a.appointment_date) FROM appointments a WHERE a.patient_id = p.id) AS last_visit
       FROM patients p
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ patients: result.rows, page: parseInt(page) });
  } catch (err) {
    console.error('Patients error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// SERVICES
// ============================================

app.get('/api/services', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Services error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/services', authenticate, async (req, res) => {
  try {
    const { name, description, duration, price, clinic_id } = req.body;
    const result = await pool.query(
      `INSERT INTO services (clinic_id, name, description, duration, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [clinic_id || '11111111-1111-1111-1111-111111111111', name, description, duration || 30, price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// PAYMENTS
// ============================================

app.get('/api/payments', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = '1=1';
    let params = [];
    let paramIdx = 1;

    if (status) {
      where = `pay.status = $${paramIdx++}`;
      params.push(status);
    }

    const result = await pool.query(
      `SELECT pay.*, p.name AS patient_name, p.phone AS patient_phone,
              d.name AS doctor_name
       FROM payments pay
       LEFT JOIN patients p ON pay.patient_id = p.id
       LEFT JOIN appointments a ON pay.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE ${where}
       ORDER BY pay.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ payments: result.rows, page: parseInt(page) });
  } catch (err) {
    console.error('Payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CHAT HISTORY
// ============================================

app.get('/api/chats/:phone', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE phone = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.phone]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ============================================
// BOOTSTRAP: Create initial admin if none exists
// ============================================

async function bootstrap() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(result.rows[0].count) === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        ['admin@clinic.com', hashedPassword, 'Admin', 'admin']
      );
      console.log('Created default admin: admin@clinic.com / admin123');
    }
  } catch (err) {
    // Table might not exist yet, ignore
  }
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`Admin API running on port ${PORT}`);
  await bootstrap();
});
