export const ACTION_TYPES = [
  {
    value: 'save_record',
    label: 'Save to dashboard',
    hint: 'Store collected answers as a record like a lead, order, or feedback entry.'
  },
  {
    value: 'notify_admin',
    label: 'Notify admin',
    hint: 'Log an internal notification so the team can follow up from the dashboard.'
  },
  {
    value: 'set_variable',
    label: 'Set a value',
    hint: 'Create or overwrite a variable before moving to the next step.'
  },
  {
    value: 'send_followup',
    label: 'Schedule follow-up',
    hint: 'Queue a WhatsApp follow-up message to be sent later.'
  }
];

const VALID_INPUT_TYPES = new Set(['text', 'number', 'email', 'phone', 'date', 'rating', 'yes_no']);
const VALID_BUTTON_ACTIONS = new Set(['next', 'booking_flow', 'booking_status', 'booking_cancel', 'text', 'ai']);
const VALID_ACTION_TYPES = new Set(ACTION_TYPES.map(action => action.value));
const VALID_OPERATORS = new Set(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getNodeIds(flow) {
  return Object.keys(flow || {}).filter(key =>
    key !== 'fallback' && key !== '_flows' && key !== '_startFlow' &&
    typeof flow[key] === 'object' && !Array.isArray(flow[key])
  );
}

function recordEdge(edges, fromNode, toNode) {
  if (!edges.has(fromNode)) edges.set(fromNode, []);
  edges.get(fromNode).push(toNode);
}

function findReachableNodes(edges, startNodes = ['start']) {
  const visited = new Set();
  const queue = [...startNodes];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (visited.has(nodeId) || !edges.has(nodeId)) continue;

    visited.add(nodeId);
    for (const nextNode of edges.get(nodeId) || []) {
      if (!visited.has(nextNode)) queue.push(nextNode);
    }
  }

  return visited;
}

function validateTarget(nodeId, label, targetId, knownNodes, edges, errors) {
  if (!hasText(targetId)) {
    errors.push(`${label} in "${nodeId}" needs a next step.`);
    return;
  }

  if (!knownNodes.has(targetId)) {
    errors.push(`${label} in "${nodeId}" points to missing step "${targetId}".`);
    return;
  }

  recordEdge(edges, nodeId, targetId);
}

export function validateFlowDraft(flow) {
  const errors = [];

  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) {
    return ['Build your flow before saving it.'];
  }

  const nodeIds = getNodeIds(flow);
  const knownNodes = new Set(nodeIds);
  const edges = new Map(nodeIds.map(nodeId => [nodeId, []]));

  if (!knownNodes.has('start')) {
    errors.push('Your flow needs a start step.');
  }

  if (Object.prototype.hasOwnProperty.call(flow, 'fallback') && typeof flow.fallback !== 'string') {
    errors.push('Fallback message must be plain text.');
  }

  for (const nodeId of nodeIds) {
    const node = flow[nodeId];
    const nodeType = node?.type || 'menu';

    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`Step "${nodeId}" is invalid.`);
      continue;
    }

    if ((nodeType === 'menu' || nodeType === 'input') && !hasText(node.message)) {
      errors.push(`Step "${nodeId}" needs a message.`);
    }

    if (nodeType === 'menu') {
      const buttons = Array.isArray(node.buttons) ? node.buttons : [];
      const buttonIds = new Set();

      for (const button of buttons) {
        if (!hasText(button?.id) || !hasText(button?.label)) {
          errors.push(`Every button in "${nodeId}" needs an id and label.`);
          continue;
        }

        if (buttonIds.has(button.id)) {
          errors.push(`Button id "${button.id}" is duplicated in "${nodeId}".`);
        } else {
          buttonIds.add(button.id);
        }

        const action = button.action || 'next';
        if (!VALID_BUTTON_ACTIONS.has(action)) {
          errors.push(`Button "${button.label}" in "${nodeId}" uses an unsupported action.`);
          continue;
        }

        if (action === 'next') {
          validateTarget(nodeId, `Button "${button.label}"`, button.next, knownNodes, edges, errors);
        }

        if (action === 'text' && !hasText(button.response)) {
          errors.push(`Button "${button.label}" in "${nodeId}" needs a text reply.`);
        }
      }
    }

    if (nodeType === 'input') {
      if (!hasText(node.variable)) {
        errors.push(`Input step "${nodeId}" needs a variable name.`);
      }

      if (node.input_type && !VALID_INPUT_TYPES.has(node.input_type)) {
        errors.push(`Input step "${nodeId}" uses an unsupported answer type.`);
      }

      if (node.next) {
        validateTarget(nodeId, `Input step "${nodeId}"`, node.next, knownNodes, edges, errors);
      }
    }

    if (nodeType === 'condition') {
      const rules = Array.isArray(node.rules) ? node.rules : [];

      if (!hasText(node.variable)) {
        errors.push(`Condition step "${nodeId}" needs a variable to check.`);
      }

      if (rules.length === 0 && !node.else_next) {
        errors.push(`Condition step "${nodeId}" needs at least one rule or an else branch.`);
      }

      rules.forEach((rule, index) => {
        if (rule?.operator && !VALID_OPERATORS.has(rule.operator)) {
          errors.push(`Rule ${index + 1} in "${nodeId}" uses an unsupported operator.`);
        }
        validateTarget(nodeId, `Rule ${index + 1}`, rule?.next, knownNodes, edges, errors);
      });

      if (node.else_next) {
        validateTarget(nodeId, 'Else branch', node.else_next, knownNodes, edges, errors);
      }
    }

    if (nodeType === 'action') {
      const actionType = node.action_type || 'save_record';

      if (!VALID_ACTION_TYPES.has(actionType)) {
        errors.push(`Action step "${nodeId}" uses an unsupported action.`);
      }

      if (actionType === 'set_variable') {
        if (!hasText(node.set_var)) {
          errors.push(`Action step "${nodeId}" needs a variable name to set.`);
        }
        if (node.set_value === undefined) {
          errors.push(`Action step "${nodeId}" needs a value to store.`);
        }
      }

      if (actionType === 'send_followup' && node.delay_minutes !== undefined && node.delay_minutes !== null && node.delay_minutes !== '') {
        const delay = parseInt(node.delay_minutes, 10);
        if (Number.isNaN(delay) || delay <= 0) {
          errors.push(`Action step "${nodeId}" needs a positive follow-up delay.`);
        }
      }

      if (node.next) {
        validateTarget(nodeId, `Action step "${nodeId}"`, node.next, knownNodes, edges, errors);
      }
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  // Start reachability from all flow-start screens (multi-flow support)
  const startScreens = nodeIds.filter(id => id === 'start' || id.endsWith('_start'));
  const reachableNodes = findReachableNodes(edges, startScreens.length > 0 ? startScreens : ['start']);
  const disconnectedNodes = nodeIds.filter(nodeId => !reachableNodes.has(nodeId));
  if (disconnectedNodes.length > 0) {
    errors.push(`These steps are disconnected from the start step: ${disconnectedNodes.join(', ')}`);
  }

  return errors;
}

export function deleteNodeAndCleanup(flow, nodeId) {
  if (!flow || nodeId === 'start') return flow;

  const nextFlow = {};

  for (const [currentId, currentNode] of Object.entries(flow)) {
    if (currentId === nodeId) continue;

    if (currentId === 'fallback' || !currentNode || typeof currentNode !== 'object' || Array.isArray(currentNode)) {
      nextFlow[currentId] = currentNode;
      continue;
    }

    const nodeType = currentNode.type || 'menu';
    const cleanedNode = { ...currentNode };

    if (nodeType === 'menu' && Array.isArray(currentNode.buttons)) {
      cleanedNode.buttons = currentNode.buttons.map(button => {
        if ((button.action || 'next') === 'next' && button.next === nodeId) {
          return { ...button, next: '' };
        }
        return button;
      });
    }

    if (nodeType === 'input' && currentNode.next === nodeId) {
      cleanedNode.next = '';
    }

    if (nodeType === 'condition') {
      if (Array.isArray(currentNode.rules)) {
        cleanedNode.rules = currentNode.rules.map(rule => (
          rule.next === nodeId ? { ...rule, next: '' } : rule
        ));
      }

      if (currentNode.else_next === nodeId) {
        cleanedNode.else_next = '';
      }
    }

    if (nodeType === 'action' && currentNode.next === nodeId) {
      cleanedNode.next = '';
    }

    nextFlow[currentId] = cleanedNode;
  }

  return nextFlow;
}
