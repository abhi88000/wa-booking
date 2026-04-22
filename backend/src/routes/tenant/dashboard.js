// ============================================================
// Dashboard Route — Tenant Overview & Stats
// ============================================================
// GET /dashboard — Returns aggregated stats (appointments, patients,
// doctors, records, conversations) plus today's schedule.
// Adapts to business type and supports multi-branch clinic filter.

const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');

router.get('/dashboard', async (req, res, next) => {
  try {
    const tid = req.tenantId;
    const { clinic } = req.query;
    const clinicFilter = clinic && clinic !== 'all' ? clinic : null;

    const [stats, recent, todayAppts, recordsData, conversationsData, flowConfig] = await Promise.all([
      (async () => {
        const p = clinicFilter ? [tid, clinicFilter] : [tid];
        const cf = clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : '';
        const dJoin = clinicFilter ? 'JOIN doctors d ON d.id = a.doctor_id' : '';
        const upcoming = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND a.status = 'confirmed' AND a.appointment_date >= CURRENT_DATE ${cf}`, p);
        const today = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND a.appointment_date = CURRENT_DATE AND a.status NOT IN ('cancelled', 'rescheduled') ${cf}`, p);
        const patients = await pool.query(`SELECT COUNT(*) FROM patients WHERE tenant_id = $1`, [tid]);
        const dcf = clinicFilter ? 'AND (clinic = $2 OR clinic IS NULL)' : '';
        const docs = await pool.query(`SELECT COUNT(*) FROM doctors WHERE tenant_id = $1 AND is_active = true ${dcf}`, clinicFilter ? [tid, clinicFilter] : [tid]);
        const month = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND EXTRACT(MONTH FROM a.created_at) = EXTRACT(MONTH FROM NOW()) ${cf}`, p);
        return { rows: [{ upcoming: upcoming.rows[0].count, today: today.rows[0].count, total_patients: patients.rows[0].count, active_doctors: docs.rows[0].count, month_appointments: month.rows[0].count }] };
      })(),
      pool.query(`
        SELECT a.id, a.appointment_date, a.start_time, a.status, 
               d.name as doctor_name, p.name as patient_name, p.phone as patient_phone,
               a.rescheduled_from, a.notes
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date >= CURRENT_DATE
        AND a.status NOT IN ('cancelled', 'rescheduled')
        ${clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : ''}
        ORDER BY a.appointment_date, a.start_time LIMIT 10
      `, clinicFilter ? [tid, clinicFilter] : [tid]),
      pool.query(`
        SELECT a.*, d.name as doctor_name, p.name as patient_name
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date = CURRENT_DATE
        ${clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : ''}
        ORDER BY a.start_time
      `, clinicFilter ? [tid, clinicFilter] : [tid]),
      (async () => {
        try {
          const total = await pool.query(`SELECT COUNT(*)::int as count FROM tenant_records WHERE tenant_id = $1`, [tid]);
          const thisMonth = await pool.query(`SELECT COUNT(*)::int as count FROM tenant_records WHERE tenant_id = $1 AND created_at >= date_trunc('month', NOW())`, [tid]);
          const byType = await pool.query(`SELECT record_type, COUNT(*)::int as count FROM tenant_records WHERE tenant_id = $1 GROUP BY record_type ORDER BY count DESC`, [tid]);
          const recentRecs = await pool.query(`SELECT id, record_type, phone, data, status, created_at FROM tenant_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5`, [tid]);
          return { total: total.rows[0].count, thisMonth: thisMonth.rows[0].count, byType: byType.rows, recent: recentRecs.rows };
        } catch { return { total: 0, thisMonth: 0, byType: [], recent: [] }; }
      })(),
      (async () => {
        const total = await pool.query(`SELECT COUNT(DISTINCT patient_id)::int as count FROM chat_messages WHERE tenant_id = $1`, [tid]);
        const today = await pool.query(`SELECT COUNT(DISTINCT patient_id)::int as count FROM chat_messages WHERE tenant_id = $1 AND created_at >= CURRENT_DATE`, [tid]);
        const unread = await pool.query(`
          SELECT COUNT(*)::int as count FROM (
            SELECT DISTINCT m.patient_id FROM chat_messages m
            WHERE m.tenant_id = $1 AND m.direction = 'inbound'
            AND NOT EXISTS (
              SELECT 1 FROM chat_messages m2 WHERE m2.tenant_id = $1 AND m2.patient_id = m.patient_id
              AND m2.direction = 'outbound' AND m2.created_at > m.created_at
            )
          ) sub
        `, [tid]);
        const lastMsg = await pool.query(`SELECT created_at FROM chat_messages WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, [tid]);
        const recentChats = await pool.query(`
          SELECT p.name, p.phone, m.content, m.direction, m.created_at
          FROM chat_messages m
          JOIN patients p ON p.id = m.patient_id AND p.tenant_id = m.tenant_id
          WHERE m.tenant_id = $1
          ORDER BY m.created_at DESC LIMIT 5
        `, [tid]);
        // 7-day conversation trend
        const trend = await pool.query(`
          SELECT d::date as day, COUNT(DISTINCT patient_id)::int as count
          FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
          LEFT JOIN chat_messages cm ON cm.tenant_id = $1 AND cm.created_at::date = d
          GROUP BY d ORDER BY d
        `, [tid]);
        return {
          total: total.rows[0].count, today: today.rows[0].count, unread: unread.rows[0].count,
          lastMessage: lastMsg.rows[0]?.created_at || null,
          recentChats: recentChats.rows,
          trend: trend.rows
        };
      })(),
      (async () => {
        const fc = await pool.query(`SELECT flow_config, labels FROM tenants WHERE id = $1`, [tid]);
        const row = fc.rows[0];
        return { hasFlow: !!(row?.flow_config), labels: row?.labels || {} };
      })()
    ]);

    res.json({
      stats: stats.rows[0],
      upcoming: recent.rows,
      today: todayAppts.rows,
      plan: req.tenant.plan || 'trial',
      limits: {
        maxDoctors: req.tenant.max_doctors,
        maxAppointmentsMonth: req.tenant.max_appointments_month,
        usedAppointmentsMonth: parseInt(stats.rows[0].month_appointments)
      },
      records: recordsData,
      conversations: conversationsData,
      flowStatus: flowConfig
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
