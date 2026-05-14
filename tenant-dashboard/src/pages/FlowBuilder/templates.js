// Flow Templates
export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Flow',
    desc: 'Start from scratch with a single welcome step',
    industries: 'Any',
    flow: {
      start: {
        type: 'menu',
        name: 'Welcome',
        message: 'Welcome! How can I help you today?',
        buttons: []
      },
      fallback: "Sorry, I didn't understand. Please choose from the options above."
    }
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    desc: 'Book, view, or cancel appointments on WhatsApp',
    industries: 'Clinics, Salons, Gyms, Consultants',
    flow: {
      start: {
        type: 'menu',
        name: 'Welcome',
        message: 'Welcome! How can I help you today?',
        buttons: [
          { id: 'book',   label: 'Book Appointment',    action: 'booking_flow' },
          { id: 'status', label: 'My Appointments',     action: 'booking_status' },
          { id: 'cancel', label: 'Cancel / Reschedule', action: 'booking_cancel' }
        ]
      },
      fallback: "Sorry, I didn't understand. Please choose from the options above."
    }
  },
  {
    id: 'feedback',
    name: 'Customer Feedback',
    desc: 'Collect ratings and comments after a service',
    industries: 'Restaurants, Hotels, Salons',
    flow: {
      start: {
        type: 'menu',
        name: 'Rating',
        message: "Hi! We'd love to hear about your experience. How would you rate us?",
        buttons: [
          { id: 'r5', label: 'Excellent',     action: 'text', response: "Thank you! We're glad you had a great experience." },
          { id: 'r3', label: 'Average',       action: 'text', response: "Thanks for the feedback. We'll work to improve!" },
          { id: 'r1', label: 'Poor',          action: 'text', response: "We're sorry to hear that. We'll do better." }
        ]
      },
      fallback: 'Please select a rating from the options above.'
    }
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    desc: 'Greet, qualify, and save leads to your dashboard',
    industries: 'Real estate, Services, B2B',
    flow: {
      start: {
        type: 'menu',
        name: 'Welcome',
        message: 'Hi! Interested in our services? Let me grab a few details.',
        buttons: [
          { id: 'go',  label: "Yes, let's go", action: 'next', next: 'ask_name' },
          { id: 'no',  label: 'Maybe later',   action: 'text', response: 'No worries, message us anytime.' }
        ]
      },
      ask_name: {
        type: 'input',
        name: 'Ask name',
        message: 'Great! What is your name?',
        variable: 'customer_name',
        input_type: 'text',
        next: 'ask_email'
      },
      ask_email: {
        type: 'input',
        name: 'Ask email',
        message: 'Thanks {{customer_name}}! What is your email?',
        variable: 'customer_email',
        input_type: 'email',
        next: 'save_lead'
      },
      save_lead: {
        type: 'action',
        name: 'Save lead',
        action_type: 'save_record',
        record_type: 'lead',
        message: "We have your details, someone from our team will reach out soon."
      },
      fallback: 'Please choose from the options above.'
    }
  }
];