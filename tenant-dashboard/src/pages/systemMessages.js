// ── System Messages — Defaults + Variable Definitions ──────────
// Each message the bot can send, grouped by category.
// Users can override any editable message; defaults used as fallback.
// Backend reads overrides from tenant flow_config.messages

const SYSTEM_MESSAGES = [
  // ── Booking ─────────────────────────────────────────────
  {
    id: 'booking_confirmation',
    category: 'Booking',
    label: 'Booking Confirmation',
    desc: 'Sent after a new appointment is confirmed',
    editable: true,
    variables: ['doctor_name', 'date', 'time', 'location', 'status'],
    default:
      '✅ *Appointment {{status}}!*\n\n' +
      '👨‍⚕️ {{doctor_name}}\n' +
      '📅 {{date}}\n' +
      '🕐 {{time}}\n' +
      '{{location}}\n' +
      'You\'ll receive a reminder before your appointment.\n' +
      'Type "status" anytime to check your appointments.',
  },
  {
    id: 'booking_summary',
    category: 'Booking',
    label: 'Booking Summary (before confirm)',
    desc: 'Shown right before the customer confirms',
    editable: true,
    variables: ['doctor_name', 'service_name', 'date', 'start_time', 'end_time'],
    default:
      '📋 *Appointment Summary*\n\n' +
      '👨‍⚕️ Doctor: {{doctor_name}}\n' +
      '📝 Service: {{service_name}}\n' +
      '📅 Date: {{date}}\n' +
      '🕐 Time: {{start_time}} - {{end_time}}\n\n' +
      'Would you like to confirm this appointment?',
  },
  {
    id: 'doctor_notification',
    category: 'Booking',
    label: 'Doctor Notification (new booking)',
    desc: 'Sent to the doctor/staff when a booking is made',
    editable: true,
    variables: ['patient_name', 'date', 'start_time', 'end_time', 'service_name', 'status'],
    default:
      '📋 *New Appointment Booked*\n\n' +
      'Patient: {{patient_name}}\n' +
      '📅 {{date}}\n' +
      '🕐 {{start_time}} - {{end_time}}\n' +
      '📝 {{service_name}}\n\n' +
      'Status: {{status}}',
  },

  // ── Cancellation ────────────────────────────────────────
  {
    id: 'cancel_confirmation',
    category: 'Cancellation',
    label: 'Cancellation Confirmation',
    desc: 'Sent when the customer cancels their appointment',
    editable: true,
    variables: ['doctor_name', 'date', 'time'],
    default:
      '❌ *Appointment Cancelled*\n\n' +
      '👨‍⚕️ {{doctor_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'Type "book" to schedule a new appointment.',
  },
  {
    id: 'booking_cancelled_nav',
    category: 'Cancellation',
    label: 'Booking Flow Cancelled',
    desc: 'When the customer cancels mid-booking',
    editable: true,
    variables: [],
    default: 'Booking cancelled. Send "hi" to start over.',
  },

  // ── Reschedule ──────────────────────────────────────────
  {
    id: 'reschedule_confirmation',
    category: 'Reschedule',
    label: 'Reschedule Confirmation',
    desc: 'Sent after a successful reschedule',
    editable: true,
    variables: ['doctor_name', 'date', 'time'],
    default:
      '🔄 *Appointment Rescheduled!*\n\n' +
      '👨‍⚕️ {{doctor_name}}\n' +
      '📅 {{date}}\n' +
      '🕐 {{time}}\n\n' +
      'You\'ll receive a reminder before your appointment.',
  },
  {
    id: 'reschedule_accepted',
    category: 'Reschedule',
    label: 'Reschedule Accepted',
    desc: 'When patient accepts a clinic-initiated reschedule',
    editable: true,
    variables: ['doctor_name', 'date', 'time'],
    default:
      '✅ *Reschedule Accepted*\n\n' +
      '👨‍⚕️ {{doctor_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'See you there!',
  },
  {
    id: 'reschedule_declined',
    category: 'Reschedule',
    label: 'Reschedule Declined',
    desc: 'When patient declines a clinic-initiated reschedule',
    editable: true,
    variables: [],
    default:
      '❌ *Reschedule Declined*\n\n' +
      'Your appointment has been cancelled.\n' +
      'Reply "book" to schedule a new appointment at a time that works for you.',
  },
  {
    id: 'reschedule_declined_detail',
    category: 'Reschedule',
    label: 'Reschedule Declined (with details)',
    desc: 'When patient declines and we have the appointment details',
    editable: true,
    variables: ['doctor_name', 'date'],
    default:
      '❌ *Reschedule Declined*\n\n' +
      'Your appointment with {{doctor_name}} on {{date}} has been cancelled.\n' +
      'Reply "book" to schedule a new appointment at a time that works for you.',
  },

  // ── Status ──────────────────────────────────────────────
  {
    id: 'upcoming_appointments',
    category: 'Status',
    label: 'Upcoming Appointments Header',
    desc: 'Header text for the appointments list',
    editable: true,
    variables: [],
    default: '📋 *Your Upcoming Appointments*',
  },
  {
    id: 'no_appointments',
    category: 'Status',
    label: 'No Appointments',
    desc: 'When the customer has no upcoming appointments',
    editable: true,
    variables: [],
    default: 'You have no upcoming appointments.',
  },
  {
    id: 'appointment_confirmed',
    category: 'Status',
    label: 'Appointment Confirmed (reminder response)',
    desc: 'When patient confirms via reminder button',
    editable: true,
    variables: ['doctor_name', 'date', 'time'],
    default:
      '✅ *Appointment Confirmed*\n\n' +
      '👨‍⚕️ {{doctor_name}}\n' +
      '📅 {{date}} at {{time}}\n\n' +
      'See you there!',
  },

  // ── Navigation ──────────────────────────────────────────
  {
    id: 'help_menu',
    category: 'Navigation',
    label: 'Help Menu',
    desc: 'Shown when customer types "help"',
    editable: true,
    variables: ['business_name'],
    default:
      '🤖 *{{business_name}} - Help*\n\n' +
      'Here\'s what I can do:\n\n' +
      '📅 *Book* — Schedule a new appointment\n' +
      '📋 *Status* — View your appointments\n' +
      '❌ *Cancel* — Cancel an appointment\n' +
      '🔄 *Reschedule* — Change appointment time\n\n' +
      'Just type any of these words or tap the buttons!',
  },
  {
    id: 'error_message',
    category: 'Navigation',
    label: 'Error / Something Went Wrong',
    desc: 'Shown when the bot encounters an unexpected error',
    editable: true,
    variables: [],
    default: 'Sorry, something went wrong. Please try again or type "hi" to start over.',
  },
  {
    id: 'go_back',
    category: 'Navigation',
    label: 'Go Back',
    desc: 'When customer goes back to main menu',
    editable: true,
    variables: [],
    default: 'OK, going back. Send "hi" to see the menu.',
  },
  {
    id: 'slot_taken',
    category: 'Navigation',
    label: 'Slot Already Taken',
    desc: 'When a time slot was just booked by someone else',
    editable: true,
    variables: [],
    default: 'Sorry, this slot was just booked by someone else. Please pick another time.',
  },

  // ── Reminders (WhatsApp Templates — Read Only) ─────────
  {
    id: 'reminder_24h',
    category: 'Reminders',
    label: 'Appointment Reminder (24h before)',
    desc: 'Sent via WhatsApp Template — requires Meta approval to change',
    editable: false,
    variables: ['patient_name', 'doctor_name', 'date', 'time', 'business_name'],
    default: 'Hi {{patient_name}}, reminder: your appointment with {{doctor_name}} is on {{date}} at {{time}}. — {{business_name}}',
    note: 'This uses a WhatsApp Template Message (appointment_reminder). Template changes must be submitted to Meta for approval.',
  },
  {
    id: 'reminder_1h',
    category: 'Reminders',
    label: 'Appointment Reminder (1h before)',
    desc: 'Sent via WhatsApp Template — requires Meta approval to change',
    editable: false,
    variables: ['patient_name', 'doctor_name', 'date', 'time', 'business_name'],
    default: 'Hi {{patient_name}}, reminder: your appointment with {{doctor_name}} is on {{date}} at {{time}}. — {{business_name}}',
    note: 'Uses the same appointment_reminder template as the 24h reminder.',
  },
  {
    id: 'daily_schedule',
    category: 'Reminders',
    label: 'Daily Doctor Schedule',
    desc: 'Morning summary sent to each doctor with their appointments',
    editable: true,
    variables: ['doctor_name', 'date', 'appointment_count', 'business_name'],
    default:
      '📋 *Today\'s Schedule — {{doctor_name}}*\n' +
      '📅 {{date}}\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      '(appointments listed automatically)\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
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
