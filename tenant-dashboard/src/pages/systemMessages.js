// System Messages — Defaults + Variable Definitions
// Each message the bot can send, grouped by category.
// Users can override any editable message; defaults are used as fallback.
//
// SYNTAX:
//   {{variable}}        — substituted with real data at send time
//   [[optional {{x}}]]  — the whole segment is dropped if {{x}} is empty/missing
//                         (great for fields like location that may be blank)

const SYSTEM_MESSAGES = [
  // ── Booking ────────────────────────────────────────────
  {
    id: 'booking_confirmation',
    category: 'Booking',
    label: 'Booking Confirmation',
    desc: 'Sent after a new appointment is confirmed',
    editable: true,
    variables: ['provider_name', 'date', 'time', 'location', 'status'],
    default:
      '✅ *Appointment {{status}}*\n\n' +
      '👤 {{provider_name}}\n' +
      '📅 {{date}}, {{time}}' +
      '[[\n📍 {{location}}]]',
    note: 'Wrap a line in [[ ]] to hide it when the variable is empty — e.g. [[\\n📍 {{location}}]] disappears when no location is set.',
  },
  {
    id: 'booking_summary',
    category: 'Booking',
    label: 'Booking Summary (before confirm)',
    desc: 'Shown right before the customer confirms',
    editable: true,
    variables: ['provider_name', 'service_name', 'date', 'start_time', 'end_time'],
    default:
      '📋 *Please confirm*\n\n' +
      '👤 {{provider_name}}' +
      '[[\n🩺 {{service_name}}]]\n' +
      '📅 {{date}}\n' +
      '🕒 {{start_time}} - {{end_time}}\n\n' +
      'Would you like to confirm this appointment?',
  },
  {
    id: 'staff_notification',
    category: 'Booking',
    label: 'Staff Notification (new booking)',
    desc: 'Sent to the staff/provider when a booking is made',
    editable: true,
    variables: ['patient_name', 'date', 'start_time', 'end_time', 'service_name', 'status'],
    default:
      '🆕 *New appointment*\n\n' +
      '👤 {{patient_name}}\n' +
      '📅 {{date}}\n' +
      '🕒 {{start_time}} - {{end_time}}' +
      '[[\n🩺 {{service_name}}]]\n' +
      '📌 {{status}}',
  },

  // ── Cancellation ───────────────────────────────────────
  {
    id: 'cancel_confirmation',
    category: 'Cancellation',
    label: 'Cancellation Confirmation',
    desc: 'Sent when the customer cancels their appointment',
    editable: true,
    variables: ['provider_name', 'date', 'time'],
    default:
      '❌ *Appointment cancelled*\n\n' +
      '👤 {{provider_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'Reply *book* anytime to schedule a new appointment.',
  },
  {
    id: 'booking_cancelled_nav',
    category: 'Cancellation',
    label: 'Booking Flow Cancelled',
    desc: 'When the customer cancels mid-booking',
    editable: true,
    variables: [],
    default: 'Booking cancelled. Reply *hi* to start over.',
  },

  // ── Reschedule ─────────────────────────────────────────
  {
    id: 'reschedule_confirmation',
    category: 'Reschedule',
    label: 'Reschedule Confirmation',
    desc: 'Sent after a successful reschedule',
    editable: true,
    variables: ['provider_name', 'date', 'time'],
    default:
      '🔄 *Appointment rescheduled*\n\n' +
      '👤 {{provider_name}}\n' +
      '📅 {{date}}, {{time}}',
  },
  {
    id: 'reschedule_accepted',
    category: 'Reschedule',
    label: 'Reschedule Accepted',
    desc: 'When customer accepts a reschedule initiated by staff',
    editable: true,
    variables: ['provider_name', 'date', 'time'],
    default:
      '✅ *Reschedule accepted*\n\n' +
      '👤 {{provider_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'See you there.',
  },
  {
    id: 'reschedule_declined',
    category: 'Reschedule',
    label: 'Reschedule Declined',
    desc: 'When customer declines a reschedule initiated by staff',
    editable: true,
    variables: [],
    default:
      '❌ *Reschedule declined*\n\n' +
      'Your appointment has been cancelled.\n' +
      'Reply *book* to schedule a new appointment at a time that works for you.',
  },
  {
    id: 'reschedule_declined_detail',
    category: 'Reschedule',
    label: 'Reschedule Declined (with details)',
    desc: 'When customer declines and we have the appointment details',
    editable: true,
    variables: ['provider_name', 'date'],
    default:
      '❌ *Reschedule declined*\n\n' +
      'Your appointment with {{provider_name}} on {{date}} has been cancelled.\n' +
      'Reply *book* to schedule a new appointment at a time that works for you.',
  },

  // ── Status ─────────────────────────────────────────────
  {
    id: 'upcoming_appointments',
    category: 'Status',
    label: 'Upcoming Appointments Header',
    desc: 'Header text for the appointments list',
    editable: true,
    variables: [],
    default: '📅 *Your upcoming appointments*',
  },
  {
    id: 'no_appointments',
    category: 'Status',
    label: 'No Appointments',
    desc: 'When the customer has no upcoming appointments',
    editable: true,
    variables: [],
    default: 'You have no upcoming appointments.\nReply *book* to schedule one.',
  },
  {
    id: 'appointment_confirmed',
    category: 'Status',
    label: 'Appointment Confirmed (reminder response)',
    desc: 'When customer confirms via reminder button',
    editable: true,
    variables: ['provider_name', 'date', 'time'],
    default:
      '✅ *Appointment confirmed*\n\n' +
      '👤 {{provider_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'See you there.',
  },

  // ── Navigation ─────────────────────────────────────────
  {
    id: 'help_menu',
    category: 'Navigation',
    label: 'Help Menu',
    desc: 'Shown when customer types "help"',
    editable: true,
    variables: ['business_name'],
    default:
      '👋 *{{business_name}} - Help*\n\n' +
      'Here is what I can do:\n\n' +
      '*Book*         Schedule a new appointment\n' +
      '*Status*       View your appointments\n' +
      '*Cancel*       Cancel an appointment\n' +
      '*Reschedule*   Change appointment time\n\n' +
      'Just reply with any of these words.',
  },
  {
    id: 'error_message',
    category: 'Navigation',
    label: 'Error / Something Went Wrong',
    desc: 'Shown when the bot encounters an unexpected error',
    editable: true,
    variables: [],
    default: '⚠️ Sorry, something went wrong. Please try again or reply *hi* to start over.',
  },
  {
    id: 'go_back',
    category: 'Navigation',
    label: 'Go Back',
    desc: 'When customer goes back to main menu',
    editable: true,
    variables: [],
    default: 'OK, going back. Reply *hi* to see the menu.',
  },
  {
    id: 'slot_taken',
    category: 'Navigation',
    label: 'Slot Already Taken',
    desc: 'When a time slot was just booked by someone else',
    editable: true,
    variables: [],
    default: '⏳ Sorry, this slot was just booked by someone else. Please pick another time.',
  },

  // ── Reminders (WhatsApp Templates) ─────────────────────
  {
    id: 'reminder_24h',
    category: 'Reminders',
    label: 'Appointment Reminder (24h before)',
    desc: 'Sent via WhatsApp Template — requires Meta approval to change',
    editable: false,
    variables: ['patient_name', 'provider_name', 'date', 'time', 'business_name'],
    default: 'Hi {{patient_name}}, reminder: your appointment with {{provider_name}} is on {{date}} at {{time}}. — {{business_name}}',
    note: 'This uses a WhatsApp Template Message (appointment_reminder). Template changes must be submitted to Meta for approval.',
  },
  {
    id: 'reminder_1h',
    category: 'Reminders',
    label: 'Appointment Reminder (1h before)',
    desc: 'Sent via WhatsApp Template — requires Meta approval to change',
    editable: false,
    variables: ['patient_name', 'provider_name', 'date', 'time', 'business_name'],
    default: 'Hi {{patient_name}}, reminder: your appointment with {{provider_name}} is on {{date}} at {{time}}. — {{business_name}}',
    note: 'Uses the same appointment_reminder template as the 24h reminder.',
  },
  {
    id: 'daily_schedule',
    category: 'Reminders',
    label: 'Daily Staff Schedule',
    desc: 'Morning summary sent to each staff member with their appointments',
    editable: true,
    variables: ['provider_name', 'date', 'appointment_count', 'business_name'],
    default:
      '📋 *Today\'s schedule — {{provider_name}}*\n' +
      '📅 {{date}}\n' +
      '------------------------------\n' +
      '(appointments listed automatically)\n' +
      '------------------------------\n' +
      'Total: {{appointment_count}} appointment(s)\n' +
      '— {{business_name}}',
  },
];

// Group messages by category
export function getMessagesByCategory() {
  const groups = {};
  SYSTEM_MESSAGES.forEach(m => {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  });
  return groups;
}

// Category icons and colors
export const CATEGORY_META = {
  Booking:      { icon: 'calendar',       color: 'emerald' },
  Cancellation: { icon: 'trash',          color: 'red' },
  Reschedule:   { icon: 'clock',          color: 'blue' },
  Status:       { icon: 'messageSquare',  color: 'purple' },
  Navigation:   { icon: 'settings',       color: 'gray' },
  Reminders:    { icon: 'clock',          color: 'amber' },
};

export default SYSTEM_MESSAGES;
