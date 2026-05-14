// ============================================================
// Button & action metadata — keeps the UI human-readable
// ============================================================
import { Ico } from './icons';

// What each button action means from the customer's point of view.
// Used for labels, tooltips, and color coding inside MenuNode.
export const BUTTON_ACTION_META = {
  next: {
    label: 'Go to step',
    short: 'next',
    desc: "Send the customer to another step in this flow.",
    color: 'slate',
    Icon: Ico.arrowRight
  },
  text: {
    label: 'Send reply',
    short: 'reply',
    desc: "Reply with a fixed text message (no further steps).",
    color: 'sky',
    Icon: Ico.reply
  },
  booking_flow: {
    label: 'Booking wizard',
    short: 'book',
    desc: "Starts: choose doctor → service → date → time. Confirms and saves the appointment.",
    color: 'emerald',
    Icon: Ico.calendar
  },
  booking_status: {
    label: 'My bookings',
    short: 'list',
    desc: "Lists the customer's upcoming appointments with options to cancel or reschedule each one.",
    color: 'blue',
    Icon: Ico.clock
  },
  booking_cancel: {
    label: 'Cancel / Reschedule',
    short: 'manage',
    desc: "Asks which appointment to cancel or reschedule.",
    color: 'amber',
    Icon: Ico.calendar
  },
  ai: {
    label: 'AI assistant',
    short: 'ai',
    desc: "Hands the conversation over to the AI assistant for free-form Q&A.",
    color: 'purple',
    Icon: Ico.cpu
  }
};

// What each action node does
export const ACTION_TYPE_META = {
  save_record: {
    label: 'Save record',
    desc: 'Save the answers so far to your dashboard (as a lead, order, feedback, etc.)',
    Icon: Ico.database
  },
  notify_admin: {
    label: 'Notify admin',
    desc: 'Send a WhatsApp message to your admin number with the collected info.',
    Icon: Ico.bell
  },
  set_variable: {
    label: 'Set a variable',
    desc: 'Store a value you can use later in messages or conditions.',
    Icon: Ico.tag
  },
  send_followup: {
    label: 'Schedule follow-up',
    desc: 'Queue a WhatsApp message to be sent after some minutes.',
    Icon: Ico.clock
  }
};

// Color → Tailwind classes (static so JIT picks them up)
export const COLOR_CLASSES = {
  slate:   'bg-slate-50 text-slate-700 border-slate-200',
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  purple:  'bg-purple-50 text-purple-700 border-purple-200'
};
