// ============================================================
// Booking Engine (Tenant-Scoped, Menu-Driven)
// ============================================================
// Handles the full conversation flow for a specific tenant:
// Predefined buttons/menus → Doctor/Service/Date/Time → Booking
// No AI dependency — works with WhatsApp interactive buttons & lists.

const pool = require('../db/pool');
const logger = require('../utils/logger');

class BookingEngine {
  constructor(tenant, patient, waService) {
    this.tenant = tenant;
    this.patient = patient;
    this.wa = waService;
    this.tenantId = tenant.id;
    this.phone = patient.phone;
  }

  // Format a DB date to DD Mon YYYY
  formatDate(d) {
    if (!d) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const date = new Date(d);
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // ── Main Message Handler ────────────────────────────────
  async handleMessage(content, messageType, interactiveData) {
    try {
      const state = this.patient.wa_conversation_state || { state: 'new' };
      const currentState = state.state || 'new';

      // Handle "Start Over" and "Cancel" buttons from any state
      const msg = (content || '').toLowerCase().trim();
      if (msg === 'book' && currentState !== 'new' && currentState !== 'idle') {
        await this.setState({ state: 'idle' });
        return await this.startBookingFlow();
      }
      if (msg === 'cancel_booking' && currentState !== 'new' && currentState !== 'idle') {
        await this.setState({ state: 'idle' });
        return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
      }

      logger.info(`Booking engine: state=${currentState}, content=${content}`, {
        tenantId: this.tenantId, phone: this.phone
      });

      // Route based on conversation state
      switch (currentState) {
        case 'new':
        case 'idle':
          return await this.handleNewMessage(content, state);

        case 'awaiting_clinic':
          return await this.handleClinicSelection(content, interactiveData, state);

        case 'awaiting_doctor':
          return await this.handleDoctorSelection(content, interactiveData, state);

        case 'awaiting_service':
          return await this.handleServiceSelection(content, interactiveData, state);

        case 'awaiting_date':
          return await this.handleDateSelection(content, interactiveData, state);

        case 'awaiting_time':
          return await this.handleTimeSelection(content, interactiveData, state);

        case 'awaiting_confirm':
          return await this.handleConfirmation(content, interactiveData, state);

        case 'awaiting_cancel':
          return await this.handleCancelSelection(content, interactiveData, state);

        case 'awaiting_reschedule':
          return await this.handleRescheduleSelection(content, interactiveData, state);

        case 'reschedule_awaiting_date':
          return await this.handleRescheduleDateSelection(content, interactiveData, state);

        case 'reschedule_awaiting_time':
          return await this.handleRescheduleTimeSelection(content, interactiveData, state);

        case 'awaiting_reschedule_response':
          return await this.handleRescheduleResponse(content, state);

        default:
          return await this.handleNewMessage(content, state);
      }
    } catch (err) {
      logger.error('BookingEngine error:', { 
        error: err.message, 
        stack: err.stack,
        state: this.patient.wa_conversation_state,
        tenantId: this.tenantId,
        phone: this.phone
      });
      await this.wa.sendText(this.phone,
        'Sorry, something went wrong. Please try again or type "hi" to start over.'
      );
      await this.setState({ state: 'idle' });
    }
  }

  // ── Handle New / Idle Messages ──────────────────────────
  async handleNewMessage(content, state) {
    const msg = (content || '').toLowerCase().trim();

    // Match button IDs or simple keywords
    if (msg === 'confirm' || msg === 'yes' || msg === 'accept') {
      return await this.handleReminderConfirm();
    }
    if (msg === 'decline') {
      // Decline from reschedule template (idle fallback) — cancel latest upcoming appointment
      return await this.handleDeclineReschedule();
    }
    if (msg === 'book' || msg === 'book appointment' || msg.includes('book')) {
      return await this.startBookingFlow();
    }
    if (msg === 'status' || msg === 'my appointments' || msg.includes('status')) {
      return await this.showUpcomingAppointments();
    }
    if (msg === 'cancel' || msg === 'cancel / reschedule' || msg.includes('cancel')) {
      return await this.showCancellableAppointments();
    }
    if (msg === 'reschedule' || msg.includes('reschedule') || msg.includes('change')) {
      return await this.showReschedulableAppointments();
    }
    if (msg === 'help' || msg.includes('help') || msg === 'menu') {
      return await this.sendHelp();
    }
    if (msg === 'go_back' || msg === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }

    // Any other message → show main menu with buttons
    const settings = this.tenant.settings || {};
    const welcome = settings.welcome_message ||
      `Welcome to ${this.tenant.business_name}! 👋\n\nHow can I help you today?`;

    await this.wa.sendButtons(this.phone, {
      bodyText: welcome,
      buttons: [
        { id: 'book', title: 'Book Appointment' },
        { id: 'status', title: 'My Appointments' },
        { id: 'cancel', title: 'Cancel / Reschedule' }
      ]
    });
    await this.setState({ state: 'idle' });
  }

  // ── Start Booking: Show Clinics or Doctors ──────────────
  async startBookingFlow() {
    // Check if tenant has clinics configured
    const clinics = this.tenant.settings?.branches || [];

    if (clinics.length > 1) {
      // Multiple clinics — ask user to pick one first
      const sections = [{
        title: 'Our Locations',
        rows: [
          ...clinics.slice(0, 9).map((c, i) => {
            const label = c.address ? `${c.name} — ${c.address}` : c.name;
            return {
              id: `clinic_${i}`,
              title: c.name.substring(0, 24),
              description: c.address ? c.address.substring(0, 72) : ''
            };
          }),
          { id: 'cancel_booking', title: 'Cancel', description: 'Go back to main menu' }
        ]
      }];

      await this.wa.sendList(this.phone, {
        headerText: this.tenant.business_name,
        bodyText: 'Please select a clinic location:',
        buttonText: 'View Clinics',
        sections
      });

      return await this.setState({ state: 'awaiting_clinic' });
    }

    // Single clinic — auto-select it
    const selectedClinic = clinics.length === 1
      ? (clinics[0].address ? `${clinics[0].name} — ${clinics[0].address}` : clinics[0].name)
      : null;

    return await this.showDoctors(selectedClinic);
  }

  // ── Handle Clinic Selection ─────────────────────────────
  async handleClinicSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }

    const clinics = this.tenant.settings?.branches || [];
    const idx = parseInt((content || '').replace('clinic_', ''), 10);
    const clinic = clinics[idx];

    if (!clinic) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Invalid selection. Please use the menu buttons.',
        buttons: [
          { id: 'book', title: 'Start Over' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    const clinicLabel = clinic.address ? `${clinic.name} — ${clinic.address}` : clinic.name;
    return await this.showDoctors(clinicLabel);
  }

  // ── Show Doctors (filtered by clinic if set) ────────────
  async showDoctors(clinicLabel) {
    let doctors;
    if (clinicLabel) {
      const { rows } = await pool.query(
        `SELECT id, name, specialization, consultation_fee 
         FROM doctors WHERE tenant_id = $1 AND is_active = true
         AND (clinic = $2 OR clinic IS NULL)
         ORDER BY name`,
        [this.tenantId, clinicLabel]
      );
      doctors = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT id, name, specialization, consultation_fee 
         FROM doctors WHERE tenant_id = $1 AND is_active = true
         ORDER BY name`,
        [this.tenantId]
      );
      doctors = rows;
    }

    if (doctors.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Sorry, no doctors are available right now.',
        buttons: [{ id: 'book', title: 'Try Again' }]
      });
    }

    // If only 1 doctor, skip selection
    if (doctors.length === 1) {
      await this.setState({ 
        state: 'awaiting_service', 
        doctorId: doctors[0].id,
        doctorName: doctors[0].name,
        clinic: clinicLabel
      });
      return await this.showServices(doctors[0].id);
    }

    const sections = [{
      title: 'Available Doctors',
      rows: [
        ...doctors.slice(0, 9).map(d => ({
          id: `doc_${d.id}`,
          title: d.name.substring(0, 24),
          description: [d.specialization, d.consultation_fee ? `₹${d.consultation_fee}` : '']
            .filter(Boolean).join(' • ')
        })),
        { id: 'cancel_booking', title: 'Cancel', description: 'Go back to main menu' }
      ]
    }];

    await this.wa.sendList(this.phone, {
      headerText: this.tenant.business_name,
      bodyText: clinicLabel
        ? `Doctors at ${clinicLabel.split(' — ')[0]}:`
        : 'Please select a doctor for your appointment:',
      buttonText: 'View Doctors',
      sections
    });

    await this.setState({ state: 'awaiting_doctor', clinic: clinicLabel });
  }

  // ── Handle Doctor Selection ─────────────────────────────
  async handleDoctorSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }
    const doctorId = content.replace('doc_', '');
    
    const { rows } = await pool.query(
      'SELECT id, name FROM doctors WHERE id = $1 AND tenant_id = $2',
      [doctorId, this.tenantId]
    );

    if (rows.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Invalid selection. Please use the menu buttons.',
        buttons: [
          { id: 'book', title: 'Start Over' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    await this.setState({ 
      ...state, 
      state: 'awaiting_service',
      doctorId: rows[0].id,
      doctorName: rows[0].name,
      clinic: state.clinic || null
    });

    return await this.showServices(rows[0].id);
  }

  // ── Show Services ───────────────────────────────────────
  async showServices(doctorId) {
    const { rows: services } = await pool.query(
      `SELECT s.id, s.name, s.price 
       FROM services s
       LEFT JOIN doctor_services ds ON ds.service_id = s.id AND ds.doctor_id = $1
       WHERE s.tenant_id = $2 AND s.is_active = true
       AND (ds.doctor_id IS NOT NULL OR NOT EXISTS (
         SELECT 1 FROM doctor_services WHERE doctor_id = $1
       ))
       ORDER BY s.name`,
      [doctorId, this.tenantId]
    );

    if (services.length === 0) {
      await this.setState({ state: 'idle' });
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'No services available for this doctor.',
        buttons: [
          { id: 'book', title: 'Choose Another' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    if (services.length === 1) {
      const state = this.patient.wa_conversation_state;
      await this.setState({
        ...state,
        state: 'awaiting_date',
        serviceId: services[0].id,
        serviceName: services[0].name
      });
      return await this.showDateOptions();
    }

    const sections = [{
      title: 'Services',
      rows: [
        ...services.slice(0, 9).map(s => ({
          id: `svc_${s.id}`,
          title: s.name.substring(0, 24),
          description: `${s.price > 0 ? `₹${s.price}` : 'Free'}`
        })),
        { id: 'cancel_booking', title: 'Cancel', description: 'Go back to main menu' }
      ]
    }];

    await this.wa.sendList(this.phone, {
      bodyText: 'Please select a service:',
      buttonText: 'View Services',
      sections
    });
  }

  // ── Handle Service Selection ────────────────────────────
  async handleServiceSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }
    const serviceId = content.replace('svc_', '');
    
    const { rows } = await pool.query(
      'SELECT id, name FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, this.tenantId]
    );

    if (rows.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Invalid selection. Please use the menu buttons.',
        buttons: [
          { id: 'book', title: 'Start Over' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    await this.setState({
      ...state,
      state: 'awaiting_date',
      serviceId: rows[0].id,
      serviceName: rows[0].name
    });

    return await this.showDateOptions();
  }

  // ── Show Date Options ───────────────────────────────────
  async showDateOptions() {
    const state = this.patient.wa_conversation_state;
    const settings = this.tenant.settings || {};
    const windowDays = settings.booking_window_days || 14;
    const tz = this.tenant.timezone || 'Asia/Kolkata';

    // Get doctor's available days
    const { rows: availability } = await pool.query(
      `SELECT day, start_time, end_time FROM doctor_availability 
       WHERE doctor_id = $1 AND tenant_id = $2 AND is_active = true`,
      [state.doctorId, this.tenantId]
    );

    const availByDay = {};
    availability.forEach(a => { availByDay[a.day] = a; });
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Get doctor's slot_duration
    const { rows: docRows } = await pool.query(
      'SELECT slot_duration FROM doctors WHERE id = $1', [state.doctorId]
    );
    const slotDuration = (docRows.length > 0 && docRows[0].slot_duration) ? docRows[0].slot_duration : 30;
    
    // Generate next available dates using tenant's timezone
    const dates = [];
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    for (let i = 1; i <= windowDays && dates.length < 9; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const dayName = dayMap[date.getDay()];
      
      // Skip if doctor doesn't work this day
      if (!availByDay[dayName]) continue;

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // Skip full-day breaks
      const { rows: fullDayBreaks } = await pool.query(
        `SELECT 1 FROM doctor_breaks 
         WHERE doctor_id = $1 AND break_date = $2 AND is_full_day = true`,
        [state.doctorId, dateStr]
      );
      if (fullDayBreaks.length > 0) continue;

      // Check if there are actual open slots on this date
      const hasSlots = await this._hasAvailableSlots(
        state.doctorId, dateStr, dayName, availByDay[dayName], slotDuration
      );
      if (!hasSlots) continue;

      dates.push({
        id: `date_${dateStr}`,
        title: date.toLocaleDateString('en-US', { 
          weekday: 'short', month: 'short', day: 'numeric' 
        }),
        description: dateStr
      });
    }

    if (dates.length === 0) {
      await this.setState({ state: 'idle' });
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Sorry, no available dates in the next few weeks.',
        buttons: [
          { id: 'book', title: 'Try Again' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    // Add cancel option at the end
    dates.push({ id: 'cancel_booking', title: 'Cancel', description: 'Go back to main menu' });

    await this.wa.sendList(this.phone, {
      bodyText: `Select a date for your appointment with ${state.doctorName}:`,
      buttonText: 'View Dates',
      sections: [{ title: 'Available Dates', rows: dates }]
    });

    await this.setState({ ...state, state: 'awaiting_date' });
  }

  // ── Check if a date has at least one open slot ──────────
  async _hasAvailableSlots(doctorId, dateStr, dayName, dayAvail, duration) {
    const startMin = this.timeToMinutes(dayAvail.start_time);
    const endMin = this.timeToMinutes(dayAvail.end_time);

    // Get booked appointments
    const { rows: booked } = await pool.query(
      `SELECT start_time, end_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'rescheduled')`,
      [doctorId, dateStr]
    );

    // Get breaks
    const { rows: breaks } = await pool.query(
      `SELECT start_time, end_time FROM doctor_breaks
       WHERE doctor_id = $1 AND tenant_id = $2
       AND (break_date = $3 OR break_date IS NULL)
       AND is_full_day = false`,
      [doctorId, this.tenantId, dateStr]
    );

    let current = startMin;
    while (current + duration <= endMin) {
      const isBooked = booked.some(b => {
        const bS = this.timeToMinutes(b.start_time);
        const bE = this.timeToMinutes(b.end_time);
        return current < bE && (current + duration) > bS;
      });
      const inBreak = breaks.some(b => {
        const bS = this.timeToMinutes(b.start_time);
        const bE = this.timeToMinutes(b.end_time);
        return current < bE && (current + duration) > bS;
      });
      if (!isBooked && !inBreak) return true;
      current += duration;
    }
    return false;
  }

  // ── Handle Date Selection ───────────────────────────────
  async handleDateSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }
    const dateStr = content.replace('date_', '');
    
    logger.info(`Date selected: ${dateStr}, doctorId: ${state.doctorId}`, {
      tenantId: this.tenantId, phone: this.phone, state
    });

    await this.setState({
      ...state,
      state: 'awaiting_time',
      appointmentDate: dateStr
    });

    return await this.showTimeSlots(state.doctorId, dateStr);
  }

  // ── Show Available Time Slots ───────────────────────────
  async showTimeSlots(doctorId, dateStr, page = 0) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayMap[date.getDay()];

    // Use doctor's slot_duration (default 30 min)
    const { rows: docRows } = await pool.query(
      `SELECT slot_duration FROM doctors WHERE id = $1`, [doctorId]
    );
    const duration = (docRows.length > 0 && docRows[0].slot_duration) ? docRows[0].slot_duration : 30;

    // Get doctor's hours for this day
    const { rows: avail } = await pool.query(
      `SELECT start_time, end_time FROM doctor_availability 
       WHERE doctor_id = $1 AND tenant_id = $2 AND day = $3 AND is_active = true`,
      [doctorId, this.tenantId, dayName]
    );

    if (avail.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Doctor is not available on this day. Please pick another date.',
        buttons: [
          { id: 'book', title: 'Pick Another Date' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    // Get existing appointments for this day
    const { rows: booked } = await pool.query(
      `SELECT start_time, end_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'rescheduled')`,
      [doctorId, dateStr]
    );

    // Get breaks for this day (date-specific + recurring daily breaks with null break_date)
    const { rows: breaks } = await pool.query(
      `SELECT start_time, end_time FROM doctor_breaks
       WHERE doctor_id = $1 AND tenant_id = $2
       AND (break_date = $3 OR break_date IS NULL)
       AND is_full_day = false`,
      [doctorId, this.tenantId, dateStr]
    );

    // Generate ALL available slots first
    const allSlots = [];
    const startTime = avail[0].start_time;
    const endTime = avail[0].end_time;

    let current = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    while (current + duration <= end) {
      const slotStart = this.minutesToTime(current);
      const slotEnd = this.minutesToTime(current + duration);

      // Check if slot conflicts with any booked appointment
      const isBooked = booked.some(b => {
        const bStart = this.timeToMinutes(b.start_time);
        const bEnd = this.timeToMinutes(b.end_time);
        return current < bEnd && (current + duration) > bStart;
      });

      // Check if slot overlaps with a break
      const inBreak = breaks.some(b => {
        const bStart = this.timeToMinutes(b.start_time);
        const bEnd = this.timeToMinutes(b.end_time);
        return current < bEnd && (current + duration) > bStart;
      });

      if (!isBooked && !inBreak) {
        allSlots.push({
          id: `time_${slotStart}`,
          title: this.formatTime(slotStart),
          description: `${this.formatTime(slotStart)} - ${this.formatTime(slotEnd)}`
        });
      }

      current += duration;
    }

    if (allSlots.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'No available slots on this date.',
        buttons: [
          { id: 'book', title: 'Choose Another Date' },
          { id: 'cancel_booking', title: 'Cancel' }
        ]
      });
    }

    // Paginate: 8 slots per page (leaving room for nav + cancel)
    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(allSlots.length / PAGE_SIZE);
    const currentPage = Math.min(page, totalPages - 1);
    const pageSlots = allSlots.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    const rows = [...pageSlots];

    // Add "More slots" button if there are more pages
    if (currentPage < totalPages - 1) {
      rows.push({ id: `slots_page_${currentPage + 1}`, title: 'More Slots →', description: `Page ${currentPage + 2} of ${totalPages}` });
    }
    rows.push({ id: 'cancel_booking', title: 'Cancel', description: 'Go back to main menu' });

    const pageInfo = totalPages > 1 ? ` (Page ${currentPage + 1}/${totalPages})` : '';
    await this.wa.sendList(this.phone, {
      bodyText: `Available slots for ${this.formatDate(dateStr)}${pageInfo}:`,
      buttonText: 'View Slots',
      sections: [{ title: 'Time Slots', rows }]
    });
  }

  // ── Handle Time Selection ───────────────────────────────
  async handleTimeSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Send "hi" to start over.');
    }
    if (content === 'back_to_dates') {
      await this.setState({ ...state, state: 'awaiting_date' });
      return await this.showDateOptions(state.doctorId);
    }
    // Pagination: show next page of slots
    if (content.startsWith('slots_page_')) {
      const page = parseInt(content.replace('slots_page_', ''));
      return await this.showTimeSlots(state.doctorId, state.appointmentDate, page);
    }
    const time = content.replace('time_', '');
    // Get doctor's slot_duration for end time calculation
    const { rows: docSlot } = await pool.query('SELECT slot_duration FROM doctors WHERE id = $1', [state.doctorId]);
    const duration = (docSlot.length > 0 && docSlot[0].slot_duration) ? docSlot[0].slot_duration : 30;
    const endTime = this.minutesToTime(this.timeToMinutes(time) + duration);

    const updatedState = {
      ...state,
      state: 'awaiting_confirm',
      startTime: time,
      endTime: endTime
    };
    await this.setState(updatedState);

    // Show confirmation
    const summary = 
      `📋 *Appointment Summary*\n\n` +
      `👨‍⚕️ Doctor: ${state.doctorName}\n` +
      `📝 Service: ${state.serviceName}\n` +
      `📅 Date: ${this.formatDate(state.appointmentDate)}\n` +
      `🕐 Time: ${this.formatTime(time)} - ${this.formatTime(endTime)}\n\n` +
      `Would you like to confirm this appointment?`;

    await this.wa.sendButtons(this.phone, {
      bodyText: summary,
      buttons: [
        { id: 'confirm_yes', title: 'Confirm' },
        { id: 'confirm_no', title: 'Cancel' }
      ]
    });
  }

  // ── Handle Confirmation ─────────────────────────────────
  async handleConfirmation(content, interactiveData, state) {
    if (content === 'confirm_no' || content.toLowerCase().includes('cancel')) {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Booking cancelled. Type "hi" to start again.');
    }

    if (content === 'confirm_yes' || content.toLowerCase().includes('yes') || content.toLowerCase().includes('confirm')) {
      // Check appointment limit for this tenant
      const maxAppts = this.tenant.max_appointments_month || 500;
      const { rows: limitCheck } = await pool.query(
        `SELECT COUNT(*) as count FROM appointments 
         WHERE tenant_id = $1 
         AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
         AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`,
        [this.tenantId]
      );
      if (parseInt(limitCheck[0].count) >= maxAppts) {
        await this.setState({ state: 'idle' });
        return await this.wa.sendText(this.phone,
          `Sorry, ${this.tenant.business_name} has reached their monthly booking limit. Please contact the clinic directly.`
        );
      }

      // Use transaction with conflict check to prevent double-booking
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lock the time range for this doctor+date to prevent concurrent bookings
        const { rows: conflict } = await client.query(
          `SELECT id FROM appointments 
           WHERE doctor_id = $1 AND appointment_date = $2 AND tenant_id = $3
           AND status NOT IN ('cancelled', 'rescheduled')
           AND start_time < $5 AND end_time > $4
           FOR UPDATE`,
          [state.doctorId, state.appointmentDate, this.tenantId, state.startTime, state.endTime]
        );

        if (conflict.length > 0) {
          await client.query('ROLLBACK');
          client.release();
          await this.setState({ state: 'idle' });
          return await this.wa.sendButtons(this.phone, {
            bodyText: 'Sorry, this slot was just booked by someone else. Please pick another time.',
            buttons: [
              { id: 'book', title: 'Pick Another Slot' },
              { id: 'cancel_booking', title: 'Cancel' }
            ]
          });
        }

        // Create the appointment
        const { rows } = await client.query(
          `INSERT INTO appointments (tenant_id, patient_id, doctor_id, service_id,
           appointment_date, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            this.tenantId, this.patient.id, state.doctorId, state.serviceId,
            state.appointmentDate, state.startTime, state.endTime,
            this.tenant.settings?.auto_confirm ? 'confirmed' : 'pending'
          ]
        );

        await client.query('COMMIT');

        const appointment = rows[0];

        // Create reminders — only if the reminder time is still in the future
        const appointmentDateTime = new Date(`${state.appointmentDate}T${state.startTime}`);
        const now = new Date();
        
        const remind24h = new Date(appointmentDateTime);
        remind24h.setHours(remind24h.getHours() - 24);
        
        const remind1h = new Date(appointmentDateTime);
        remind1h.setHours(remind1h.getHours() - 1);

        const reminders = [];
        if (remind24h > now) reminders.push({ time: remind24h, type: '24h' });
        if (remind1h > now) reminders.push({ time: remind1h, type: '1h' });

        if (reminders.length > 0) {
          const values = reminders.map((_, i) => `($1, $2, $${i*2+3}, $${i*2+4})`).join(', ');
          const params = [this.tenantId, appointment.id];
          reminders.forEach(r => { params.push(r.time, r.type); });
          await pool.query(`INSERT INTO reminders (tenant_id, appointment_id, remind_at, type) VALUES ${values}`, params);
        }

        // Send confirmation
        const statusText = this.tenant.settings?.auto_confirm ? 'Confirmed' : 'Pending Confirmation';
        await this.wa.sendText(this.phone,
          `✅ *Appointment ${statusText}!*\n\n` +
          `👨‍⚕️ ${state.doctorName}\n` +
          `📅 ${this.formatDate(state.appointmentDate)}\n` +
          `🕐 ${this.formatTime(state.startTime)}\n\n` +
          `You'll receive a reminder before your appointment.\n` +
          `Type "status" anytime to check your appointments.`
        );

        // Notify the doctor/clinic staff about new booking
        await this.notifyDoctor(state, appointment);

        await this.setState({ state: 'idle' });

        logger.info(`Appointment created: ${appointment.id}`, {
          tenantId: this.tenantId, patientPhone: this.phone
        });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } else {
      // Gibberish or unexpected input — re-show confirmation buttons
      await this.wa.sendButtons(this.phone, {
        bodyText: 'Please confirm or cancel your appointment:',
        buttons: [
          { id: 'confirm_yes', title: 'Confirm' },
          { id: 'confirm_no', title: 'Cancel' }
        ]
      });
    }
  }

  // ── Handle Reminder Reply (CONFIRM/CANCEL from idle) ────
  async handleReminderConfirm() {
    // Find the patient's next upcoming appointment
    const { rows } = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.tenant_id = $1 AND a.patient_id = $2
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('pending', 'confirmed')
       ORDER BY a.appointment_date, a.start_time
       LIMIT 1`,
      [this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      return await this.wa.sendText(this.phone, 'No upcoming appointments found.');
    }

    const a = rows[0];
    await pool.query(
      `UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [a.id]
    );

    await this.wa.sendText(this.phone,
      `✅ *Appointment Confirmed*\n\n` +
      `👨‍⚕️ ${a.doctor_name}\n` +
      `📅 ${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}\n\n` +
      `See you there!`
    );
  }

  // ── Handle Accept/Decline for Doctor-Initiated Reschedule ──
  async handleRescheduleResponse(content, state) {
    const msg = (content || '').toLowerCase().trim();

    if (msg === 'accept' || msg === 'yes') {
      // Appointment is already updated to new time by the doctor — confirm status
      const { rows } = await pool.query(
        `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
         FROM appointments a
         LEFT JOIN doctors d ON d.id = a.doctor_id
         WHERE a.id = $1 AND a.tenant_id = $2`,
        [state.appointmentId, this.tenantId]
      );

      if (rows.length === 0) {
        await this.setState({ state: 'idle' });
        return await this.wa.sendText(this.phone, 'Appointment not found. Reply "book" to schedule a new one.');
      }

      // Mark as confirmed (patient accepted the new time)
      await pool.query(
        `UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
        [rows[0].id]
      );

      await this.setState({ state: 'idle' });

      const a = rows[0];
      return await this.wa.sendText(this.phone,
        `✅ *Reschedule Accepted*\n\n` +
        `👨‍⚕️ ${a.doctor_name}\n` +
        `📅 ${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}\n\n` +
        `See you there!`
      );
    }

    if (msg === 'decline' || msg === 'no') {
      // Cancel the rescheduled appointment
      await pool.query(
        `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [state.appointmentId, this.tenantId]
      );

      // Delete unsent reminders
      await pool.query(
        `DELETE FROM reminders WHERE appointment_id = $1 AND sent = false`,
        [state.appointmentId]
      );

      await this.setState({ state: 'idle' });

      return await this.wa.sendText(this.phone,
        `❌ *Reschedule Declined*\n\n` +
        `Your appointment has been cancelled.\n` +
        `Reply "book" to schedule a new appointment at a time that works for you.`
      );
    }

    // Unrecognized response — prompt again
    return await this.wa.sendButtons(this.phone, {
      bodyText: 'Your appointment was rescheduled by the clinic. Do you accept the new time?',
      buttons: [
        { id: 'accept', title: 'Accept' },
        { id: 'decline', title: 'Decline' }
      ]
    });
  }

  // ── Decline Reschedule (from idle — fallback when state wasn't set) ──
  async handleDeclineReschedule() {
    const { rows } = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.tenant_id = $1 AND a.patient_id = $2
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('pending', 'confirmed')
       ORDER BY a.updated_at DESC
       LIMIT 1`,
      [this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      return await this.wa.sendText(this.phone, 'No upcoming appointments found.');
    }

    await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [rows[0].id]
    );
    await pool.query(
      `DELETE FROM reminders WHERE appointment_id = $1 AND sent = false`,
      [rows[0].id]
    );

    return await this.wa.sendText(this.phone,
      `❌ *Reschedule Declined*\n\n` +
      `Your appointment with ${rows[0].doctor_name} on ${this.formatDate(rows[0].appointment_date)} has been cancelled.\n` +
      `Reply "book" to schedule a new appointment at a time that works for you.`
    );
  }

  // ── Show Upcoming Appointments ──────────────────────────
  async showUpcomingAppointments() {
    const { rows } = await pool.query(
      `SELECT a.*, d.name as doctor_name, s.name as service_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.tenant_id = $1 AND a.patient_id = $2 
       AND a.appointment_date >= CURRENT_DATE
       AND a.status NOT IN ('cancelled', 'rescheduled')
       ORDER BY a.appointment_date, a.start_time
       LIMIT 5`,
      [this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'You have no upcoming appointments.',
        buttons: [{ id: 'book', title: 'Book Appointment' }]
      });
    }

    let msg = '📋 *Your Upcoming Appointments*\n\n';
    rows.forEach((a, i) => {
      msg += `${i + 1}. ${a.doctor_name}\n`;
      msg += `   📅 ${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}\n`;
      msg += `   📝 ${a.service_name || 'General'}\n`;
      msg += `   Status: ${a.status}\n\n`;
    });

    msg += 'Need to make changes?';
    await this.wa.sendButtons(this.phone, {
      bodyText: msg,
      buttons: [
        { id: 'cancel', title: 'Cancel Appointment' },
        { id: 'reschedule', title: 'Reschedule' }
      ]
    });
  }

  // ── Show Cancellable Appointments ───────────────────────
  async showCancellableAppointments() {
    const { rows } = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.tenant_id = $1 AND a.patient_id = $2
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('pending', 'confirmed')
       ORDER BY a.appointment_date
       LIMIT 9`,
      [this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'No appointments to cancel.',
        buttons: [{ id: 'book', title: 'Book Appointment' }]
      });
    }

    const sections = [{
      title: 'Select to Cancel',
      rows: [
        ...rows.map(a => ({
          id: `cancel_${a.id}`,
          title: `${a.doctor_name}`.substring(0, 24),
          description: `${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}`
        })),
        { id: 'cancel_booking', title: 'Go Back', description: 'Return to main menu' }
      ]
    }];

    await this.wa.sendList(this.phone, {
      bodyText: 'Select the appointment you want to cancel:',
      buttonText: 'View Appointments',
      sections
    });

    await this.setState({ state: 'awaiting_cancel' });
  }

  // ── Show Reschedulable Appointments ─────────────────────
  async showReschedulableAppointments() {
    const { rows } = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.tenant_id = $1 AND a.patient_id = $2
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('pending', 'confirmed')
       ORDER BY a.appointment_date
       LIMIT 9`,
      [this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'No appointments to reschedule.',
        buttons: [{ id: 'book', title: 'Book Appointment' }]
      });
    }

    const sections = [{
      title: 'Select to Reschedule',
      rows: [
        ...rows.map(a => ({
          id: `resched_${a.id}`,
          title: `${a.doctor_name}`.substring(0, 24),
          description: `${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}`
        })),
        { id: 'cancel_booking', title: 'Go Back', description: 'Return to main menu' }
      ]
    }];

    await this.wa.sendList(this.phone, {
      bodyText: 'Select the appointment you want to reschedule:',
      buttonText: 'View Appointments',
      sections
    });

    await this.setState({ state: 'awaiting_reschedule' });
  }

  // ── Handle Cancel Selection ──────────────────────────────
  async handleCancelSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'OK, going back. Send "hi" to see the menu.');
    }
    const appointmentId = content.replace('cancel_', '');

    const { rows } = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, d.name as doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND a.patient_id = $3
       AND a.status IN ('pending', 'confirmed')`,
      [appointmentId, this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      await this.setState({ state: 'idle' });
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Invalid selection.',
        buttons: [
          { id: 'cancel', title: 'Try Again' },
          { id: 'cancel_booking', title: 'Go Back' }
        ]
      });
    }

    await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [appointmentId]
    );

    // Delete unsent reminders for this appointment
    await pool.query(
      `DELETE FROM reminders WHERE appointment_id = $1 AND sent = false`,
      [appointmentId]
    );

    const a = rows[0];
    await this.wa.sendText(this.phone,
      `❌ *Appointment Cancelled*\n\n` +
      `👨‍⚕️ ${a.doctor_name}\n` +
      `📅 ${this.formatDate(a.appointment_date)} at ${this.formatTime(a.start_time)}\n\n` +
      `Type "book" to schedule a new appointment.`
    );

    await this.setState({ state: 'idle' });
    logger.info(`Appointment cancelled: ${appointmentId}`, { tenantId: this.tenantId, phone: this.phone });
  }

  // ── Handle Reschedule Selection ─────────────────────────
  async handleRescheduleSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'OK, going back. Send "hi" to see the menu.');
    }
    const appointmentId = content.replace('resched_', '');

    const { rows } = await pool.query(
      `SELECT a.id, a.doctor_id, a.service_id, d.name as doctor_name, s.name as service_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND a.patient_id = $3
       AND a.status IN ('pending', 'confirmed')`,
      [appointmentId, this.tenantId, this.patient.id]
    );

    if (rows.length === 0) {
      await this.setState({ state: 'idle' });
      return await this.wa.sendButtons(this.phone, {
        bodyText: 'Invalid selection.',
        buttons: [
          { id: 'reschedule', title: 'Try Again' },
          { id: 'cancel_booking', title: 'Go Back' }
        ]
      });
    }

    const appt = rows[0];
    await this.setState({
      state: 'reschedule_awaiting_date',
      rescheduleAppointmentId: appt.id,
      doctorId: appt.doctor_id,
      doctorName: appt.doctor_name,
      serviceId: appt.service_id,
      serviceName: appt.service_name
    });

    return await this.showDateOptions();
  }

  // ── Handle Reschedule Date Selection ────────────────────
  async handleRescheduleDateSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Reschedule cancelled. Send "hi" to start over.');
    }
    const dateStr = content.replace('date_', '');

    await this.setState({
      ...state,
      state: 'reschedule_awaiting_time',
      appointmentDate: dateStr
    });

    return await this.showTimeSlots(state.doctorId, dateStr);
  }

  // ── Handle Reschedule Time Selection ────────────────────
  async handleRescheduleTimeSelection(content, interactiveData, state) {
    if (content === 'cancel_booking') {
      await this.setState({ state: 'idle' });
      return await this.wa.sendText(this.phone, 'Reschedule cancelled. Send "hi" to start over.');
    }
    // Pagination: show next page of slots
    if (content.startsWith('slots_page_')) {
      const page = parseInt(content.replace('slots_page_', ''));
      return await this.showTimeSlots(state.doctorId, state.appointmentDate, page);
    }
    const time = content.replace('time_', '');
    // Get doctor's slot_duration for end time calculation
    const { rows: docSlot } = await pool.query('SELECT slot_duration FROM doctors WHERE id = $1', [state.doctorId]);
    const duration = (docSlot.length > 0 && docSlot[0].slot_duration) ? docSlot[0].slot_duration : 30;
    const endTime = this.minutesToTime(this.timeToMinutes(time) + duration);

    // Use transaction to prevent double-booking during reschedule
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock and check for conflicts on the new slot
      const { rows: conflict } = await client.query(
        `SELECT id FROM appointments 
         WHERE doctor_id = $1 AND appointment_date = $2 AND tenant_id = $3
         AND status NOT IN ('cancelled', 'rescheduled')
         AND start_time < $5 AND end_time > $4
         FOR UPDATE`,
        [state.doctorId, state.appointmentDate, this.tenantId, time, endTime]
      );

      if (conflict.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return await this.wa.sendButtons(this.phone, {
          bodyText: 'Sorry, this slot was just booked by someone else. Please pick another time.',
          buttons: [
            { id: 'reschedule', title: 'Pick Another Slot' },
            { id: 'cancel_booking', title: 'Cancel' }
          ]
        });
      }

      // Cancel old appointment
      await client.query(
        `UPDATE appointments SET status = 'rescheduled', updated_at = NOW() WHERE id = $1`,
        [state.rescheduleAppointmentId]
      );
      await client.query(
        `DELETE FROM reminders WHERE appointment_id = $1 AND sent = false`,
        [state.rescheduleAppointmentId]
      );

      // Create new appointment
      const { rows } = await client.query(
        `INSERT INTO appointments (tenant_id, patient_id, doctor_id, service_id,
         appointment_date, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          this.tenantId, this.patient.id, state.doctorId, state.serviceId,
          state.appointmentDate, time, endTime,
          this.tenant.settings?.auto_confirm ? 'confirmed' : 'pending'
        ]
      );

      await client.query('COMMIT');

      const appointment = rows[0];

      // Create reminders
      const appointmentDateTime = new Date(`${state.appointmentDate}T${time}`);
      const now = new Date();

      const remind24h = new Date(appointmentDateTime);
      remind24h.setHours(remind24h.getHours() - 24);
      const remind1h = new Date(appointmentDateTime);
      remind1h.setHours(remind1h.getHours() - 1);

      const reminders = [];
      if (remind24h > now) reminders.push({ time: remind24h, type: '24h' });
      if (remind1h > now) reminders.push({ time: remind1h, type: '1h' });

      if (reminders.length > 0) {
        const values = reminders.map((_, i) => `($1, $2, $${i*2+3}, $${i*2+4})`).join(', ');
        const params = [this.tenantId, appointment.id];
        reminders.forEach(r => { params.push(r.time, r.type); });
        await pool.query(`INSERT INTO reminders (tenant_id, appointment_id, remind_at, type) VALUES ${values}`, params);
      }

      await this.wa.sendText(this.phone,
        `🔄 *Appointment Rescheduled!*\n\n` +
        `👨‍⚕️ ${state.doctorName}\n` +
        `📅 ${this.formatDate(state.appointmentDate)}\n` +
        `🕐 ${this.formatTime(time)}\n\n` +
        `You'll receive a reminder before your appointment.`
      );

      await this.setState({ state: 'idle' });
      logger.info(`Appointment rescheduled: ${state.rescheduleAppointmentId} → ${appointment.id}`, {
        tenantId: this.tenantId, phone: this.phone
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  }

  // ── Send Help ───────────────────────────────────────────
  async sendHelp() {
    await this.wa.sendText(this.phone,
      `🤖 *${this.tenant.business_name} - Help*\n\n` +
      `Here's what I can do:\n\n` +
      `📅 *Book* — Schedule a new appointment\n` +
      `📋 *Status* — View your appointments\n` +
      `❌ *Cancel* — Cancel an appointment\n` +
      `🔄 *Reschedule* — Change appointment time\n\n` +
      `Just type any of these words or tap the buttons!`
    );
  }

  // ── Notify Doctor about new booking ─────────────────────
  async notifyDoctor(state, appointment) {
    try {
      // Get doctor's phone number
      const { rows } = await pool.query(
        `SELECT phone FROM doctors WHERE id = $1 AND tenant_id = $2`,
        [state.doctorId, this.tenantId]
      );
      const doctorPhone = rows[0]?.phone;
      if (!doctorPhone) return; // Doctor has no phone registered

      await this.wa.sendText(doctorPhone,
        `📋 *New Appointment Booked*\n\n` +
        `Patient: ${this.patient.name || this.phone}\n` +
        `📅 ${this.formatDate(state.appointmentDate)}\n` +
        `🕐 ${this.formatTime(state.startTime)} - ${this.formatTime(state.endTime)}\n` +
        `📝 ${state.serviceName || 'General'}\n\n` +
        `Status: ${appointment.status}`
      );
    } catch (err) {
      // Non-critical — don't fail the booking if doctor notification fails
      logger.warn('Failed to notify doctor:', err.message);
    }
  }

  // ── State Management ────────────────────────────────────
  async setState(state) {
    this.patient.wa_conversation_state = state;
    await pool.query(
      `UPDATE patients SET wa_conversation_state = $1, updated_at = NOW() 
       WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(state), this.patient.id, this.tenantId]
    );
  }

  // ── Time Utilities ──────────────────────────────────────
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const str = typeof timeStr === 'string' ? timeStr : timeStr.toString();
    const [h, m] = str.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  minutesToTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  }
}

module.exports = BookingEngine;
