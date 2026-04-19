const { validateFlowConfig } = require('../src/utils/flowConfig');

describe('Flow config validation', () => {
  test('accepts a connected flow with supported action types', () => {
    const flow = {
      start: {
        message: 'Welcome!',
        buttons: [
          { id: 'begin', label: 'Begin', action: 'next', next: 'ask_name' }
        ]
      },
      ask_name: {
        type: 'input',
        message: 'What is your name?',
        input_type: 'text',
        variable: 'name',
        next: 'follow_up'
      },
      follow_up: {
        type: 'action',
        action_type: 'send_followup',
        followup_message: 'Hi {{name}}, just checking in.',
        delay_minutes: 30
      },
      fallback: 'Please choose an option.'
    };

    const { errors } = validateFlowConfig(flow);

    expect(errors).toEqual([]);
  });

  test('rejects missing next-step references', () => {
    const flow = {
      start: {
        message: 'Welcome!',
        buttons: [
          { id: 'begin', label: 'Begin', action: 'next', next: 'missing_step' }
        ]
      },
      fallback: 'Please choose an option.'
    };

    const { errors } = validateFlowConfig(flow);

    expect(errors).toContain('Button "Begin" in node "start" points to missing node "missing_step"');
  });

  test('rejects disconnected nodes', () => {
    const flow = {
      start: {
        message: 'Welcome!',
        buttons: [
          { id: 'begin', label: 'Begin', action: 'text', response: 'Hi there' }
        ]
      },
      unused_step: {
        message: 'You should never reach this',
        buttons: []
      },
      fallback: 'Please choose an option.'
    };

    const { errors } = validateFlowConfig(flow);

    expect(errors).toContain('These steps are not connected to the start node: "unused_step"');
  });

  test('requires set_variable configuration details', () => {
    const flow = {
      start: {
        message: 'Welcome!',
        buttons: [
          { id: 'begin', label: 'Begin', action: 'next', next: 'set_priority' }
        ]
      },
      set_priority: {
        type: 'action',
        action_type: 'set_variable'
      },
      fallback: 'Please choose an option.'
    };

    const { errors } = validateFlowConfig(flow);

    expect(errors).toContain('Action node "set_priority" must define set_var for set_variable');
    expect(errors).toContain('Action node "set_priority" must define set_value for set_variable');
  });
});
