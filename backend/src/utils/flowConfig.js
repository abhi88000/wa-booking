const FLOW_NODE_TYPES = ['menu', 'input', 'condition', 'action'];
const FLOW_INPUT_TYPES = ['text', 'number', 'email', 'phone', 'date', 'rating', 'yes_no'];
const FLOW_ACTION_TYPES = ['save_record', 'notify_admin', 'set_variable', 'send_followup'];
const FLOW_BUTTON_ACTIONS = ['next', 'booking_flow', 'booking_status', 'booking_cancel', 'text', 'ai'];
const FLOW_OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectReachable(startNode, edges) {
  const visited = new Set();
  const queue = [startNode];

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

function formatNodeList(nodeIds) {
  return nodeIds.map(id => `"${id}"`).join(', ');
}

function addEdge(edges, fromNode, toNode) {
  if (!edges.has(fromNode)) edges.set(fromNode, []);
  edges.get(fromNode).push(toNode);
}

function validateTarget(nodeId, fieldLabel, targetId, knownNodes, edges, errors) {
  if (!hasText(targetId)) {
    errors.push(`${fieldLabel} in node "${nodeId}" must point to another step`);
    return;
  }

  if (!knownNodes.has(targetId)) {
    errors.push(`${fieldLabel} in node "${nodeId}" points to missing node "${targetId}"`);
    return;
  }

  addEdge(edges, nodeId, targetId);
}

function validateFlowConfig(flowConfig) {
  const errors = [];

  if (!isPlainObject(flowConfig)) {
    return { errors: ['flow_config must be a JSON object'] };
  }

  const nodeIds = Object.keys(flowConfig).filter(key => key !== 'fallback');
  const knownNodes = new Set(nodeIds);
  const edges = new Map(nodeIds.map(nodeId => [nodeId, []]));

  if (!knownNodes.has('start')) {
    errors.push('flow_config must have a "start" node');
  }

  if (Object.prototype.hasOwnProperty.call(flowConfig, 'fallback') && typeof flowConfig.fallback !== 'string') {
    errors.push('fallback must be a string');
  }

  for (const nodeId of nodeIds) {
    const node = flowConfig[nodeId];

    if (!isPlainObject(node)) {
      errors.push(`Node "${nodeId}" must be an object`);
      continue;
    }

    const nodeType = node.type || 'menu';
    if (!FLOW_NODE_TYPES.includes(nodeType)) {
      errors.push(`Node "${nodeId}" has invalid type "${nodeType}"`);
      continue;
    }

    if ((nodeType === 'menu' || nodeType === 'input') && !hasText(node.message)) {
      errors.push(`Node "${nodeId}" must have a message`);
    }

    if (nodeType === 'menu') {
      const buttons = node.buttons || [];
      if (!Array.isArray(buttons)) {
        errors.push(`Node "${nodeId}" buttons must be an array`);
        continue;
      }

      if (buttons.length > 10) {
        errors.push(`Node "${nodeId}" has more than 10 buttons (WhatsApp limit)`);
      }

      const buttonIds = new Set();
      for (const button of buttons) {
        if (!isPlainObject(button)) {
          errors.push(`Each button in node "${nodeId}" must be an object`);
          continue;
        }

        if (!hasText(button.id) || !hasText(button.label)) {
          errors.push(`Each button in node "${nodeId}" must have id and label`);
          continue;
        }

        if (buttonIds.has(button.id)) {
          errors.push(`Node "${nodeId}" has duplicate button id "${button.id}"`);
        } else {
          buttonIds.add(button.id);
        }

        const action = button.action || 'next';
        if (!FLOW_BUTTON_ACTIONS.includes(action)) {
          errors.push(`Button "${button.label}" in node "${nodeId}" has invalid action "${action}"`);
          continue;
        }

        if (action === 'next') {
          validateTarget(nodeId, `Button "${button.label}"`, button.next, knownNodes, edges, errors);
        }

        if (action === 'text' && !hasText(button.response)) {
          errors.push(`Button "${button.label}" in node "${nodeId}" must have a text response`);
        }
      }
    }

    if (nodeType === 'input') {
      if (!hasText(node.variable)) {
        errors.push(`Input node "${nodeId}" must have a variable name`);
      }

      if (node.input_type && !FLOW_INPUT_TYPES.includes(node.input_type)) {
        errors.push(`Input node "${nodeId}" has invalid input_type "${node.input_type}"`);
      }

      if (node.next !== undefined && node.next !== null && node.next !== '') {
        validateTarget(nodeId, `Input node "${nodeId}" next`, node.next, knownNodes, edges, errors);
      }
    }

    if (nodeType === 'condition') {
      if (!hasText(node.variable)) {
        errors.push(`Condition node "${nodeId}" must have a variable to check`);
      }

      const rules = node.rules || [];
      if (!Array.isArray(rules)) {
        errors.push(`Condition node "${nodeId}" rules must be an array`);
      } else {
        for (let index = 0; index < rules.length; index++) {
          const rule = rules[index];
          if (!isPlainObject(rule)) {
            errors.push(`Rule ${index + 1} in node "${nodeId}" must be an object`);
            continue;
          }

          if (rule.operator && !FLOW_OPERATORS.includes(rule.operator)) {
            errors.push(`Condition node "${nodeId}" has invalid operator "${rule.operator}"`);
          }

          validateTarget(
            nodeId,
            `Rule ${index + 1} in condition node "${nodeId}"`,
            rule.next,
            knownNodes,
            edges,
            errors
          );
        }
      }

      if (node.else_next) {
        validateTarget(nodeId, `Else branch in node "${nodeId}"`, node.else_next, knownNodes, edges, errors);
      }

      if ((!Array.isArray(rules) || rules.length === 0) && !node.else_next) {
        errors.push(`Condition node "${nodeId}" must have at least one rule or an else branch`);
      }
    }

    if (nodeType === 'action') {
      const actionType = node.action_type || 'save_record';
      if (!FLOW_ACTION_TYPES.includes(actionType)) {
        errors.push(`Action node "${nodeId}" has invalid action_type "${actionType}"`);
      }

      if (actionType === 'set_variable') {
        if (!hasText(node.set_var)) {
          errors.push(`Action node "${nodeId}" must define set_var for set_variable`);
        }
        if (node.set_value === undefined) {
          errors.push(`Action node "${nodeId}" must define set_value for set_variable`);
        }
      }

      if (actionType === 'save_record' && node.save_fields && !Array.isArray(node.save_fields)) {
        errors.push(`Action node "${nodeId}" save_fields must be an array`);
      }

      if (actionType === 'send_followup' && node.delay_minutes !== undefined && node.delay_minutes !== null && node.delay_minutes !== '') {
        const delayMinutes = parseInt(node.delay_minutes, 10);
        if (Number.isNaN(delayMinutes) || delayMinutes <= 0) {
          errors.push(`Action node "${nodeId}" must have a positive delay_minutes value`);
        }
      }

      if (node.next !== undefined && node.next !== null && node.next !== '') {
        validateTarget(nodeId, `Action node "${nodeId}" next`, node.next, knownNodes, edges, errors);
      }
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const reachable = collectReachable('start', edges);
  const unreachableNodes = nodeIds.filter(nodeId => !reachable.has(nodeId));
  if (unreachableNodes.length > 0) {
    errors.push(`These steps are not connected to the start node: ${formatNodeList(unreachableNodes)}`);
  }

  return { errors };
}

module.exports = {
  FLOW_ACTION_TYPES,
  FLOW_BUTTON_ACTIONS,
  FLOW_INPUT_TYPES,
  FLOW_NODE_TYPES,
  FLOW_OPERATORS,
  validateFlowConfig
};
