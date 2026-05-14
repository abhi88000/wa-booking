// ============================================================
// Step Guidance — Apple-style minimal copy that teaches by example.
// ============================================================
// One short headline. One real-world example. No jargon.

export const STEP_GUIDE = {
  menu: {
    title: 'Menu',
    short: 'Buttons the customer taps',
    when: 'Use when you want to give 2-10 options',
    examples: [
      { name: 'Welcome menu',  text: 'Hi! What would you like to do? — Book / Status / Cancel' },
      { name: 'FAQ',           text: 'Pick a topic — Hours / Address / Pricing' },
      { name: 'Service picker',text: 'Choose a service — Haircut / Beard / Shave' },
    ],
    tip: 'With more than 3 buttons, WhatsApp shows them as a tidy list.',
  },
  input: {
    title: 'Question',
    short: 'Ask for one piece of information',
    when: 'Use when you need the customer to type something',
    examples: [
      { name: 'Get name',   text: '"What is your name?" — saved as {{customer_name}}' },
      { name: 'Get rating', text: '"How would you rate us 1-5?" — saved as {{rating}}' },
      { name: 'Get email',  text: '"What is your email?" — saved as {{email}}' },
    ],
    tip: 'The answer is stored as a variable you can use later in messages or conditions.',
  },
  condition: {
    title: 'If / Else',
    short: 'Send people down different paths',
    when: 'Use when the next message depends on what they said',
    examples: [
      { name: 'Low rating',   text: 'If {{rating}} < 4, ask what went wrong. Else, ask for a review.' },
      { name: 'New customer', text: 'If {{is_new}} = yes, send welcome offer. Else, send loyalty perk.' },
      { name: 'VIP routing',  text: 'If {{tier}} = vip, notify manager. Else, normal flow.' },
    ],
    tip: 'Rules are checked top to bottom. First match wins.',
  },
  action: {
    title: 'Action',
    short: 'Make something happen behind the scenes',
    when: 'Use to save a lead, notify staff, or set a value',
    examples: [
      { name: 'Save lead',    text: 'Save the customer to your contacts list' },
      { name: 'Notify staff', text: 'Send a WhatsApp to your team with the details' },
      { name: 'Set value',    text: 'Mark {{status}} = "qualified"' },
    ],
    tip: 'Actions run silently — customer sees no message unless you add one.',
  },
};

// Starter templates shown on empty canvas
export const STARTERS = [
  {
    id: 'booking',
    title: 'Take a booking',
    desc: 'Customer picks a service, date and time. We confirm and remind them.',
    icon: 'calendar',
  },
  {
    id: 'lead',
    title: 'Collect a lead',
    desc: 'Ask name, phone, what they need. Save and notify your team.',
    icon: 'target',
  },
  {
    id: 'feedback',
    title: 'Get feedback',
    desc: 'Ask for a rating. Low scores get a follow-up question. High scores ask for a review.',
    icon: 'star',
  },
  {
    id: 'blank',
    title: 'Start from scratch',
    desc: 'Empty canvas. Add steps one at a time.',
    icon: 'plus',
  },
];
