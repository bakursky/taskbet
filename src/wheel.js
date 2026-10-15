const NS = 'http://www.w3.org/2000/svg';
const CENTER = 210;
export const SPIN_DURATION_MS = 6800;

const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360;
const polar = (radius, degrees) => {
  const radians = degrees * Math.PI / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
};

export function describeSector(index, count, radius = 180) {
  if (!Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
    throw new RangeError('Invalid wheel sector');
  }
  if (count === 1) {
    return `M ${CENTER} ${CENTER - radius} A ${radius} ${radius} 0 1 1 ${CENTER} ${CENTER + radius} A ${radius} ${radius} 0 1 1 ${CENTER} ${CENTER - radius} Z`;
  }
  const slice = 360 / count;
  const start = polar(radius, -90 + index * slice);
  const end = polar(radius, -90 + (index + 1) * slice);
  const largeArc = slice > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function getWinningIndex(finalDegrees, count) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Wheel requires a task');
  const slice = 360 / count;
  return Math.min(count - 1, Math.floor(normalizeDegrees(-finalDegrees) / slice));
}

export function getLabelRotation(index, count) {
  if (!Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
    throw new RangeError('Invalid wheel label');
  }
  const middle = -90 + (index + 0.5) * (360 / count);
  return middle + 180;
}

export function chooseSpin(currentDegrees, count, random = Math.random) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Wheel requires a task');
  const winningIndex = Math.min(count - 1, Math.floor(random() * count));
  const turns = 5 + Math.floor(random() * 3);
  const slice = 360 / count;
  const targetModulo = normalizeDegrees(-(winningIndex + 0.5) * slice);
  const currentModulo = normalizeDegrees(currentDegrees);
  const delta = normalizeDegrees(targetModulo - currentModulo);
  return { finalDegrees: currentDegrees + turns * 360 + delta, winningIndex };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function shortLabel(title, count) {
  const limit = count >= 7 ? 11 : count >= 5 ? 14 : 18;
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

export function renderWheel(svg, tasks, rotationDegrees = 0) {
  svg.replaceChildren();
  svg.style.transform = `rotate(${rotationDegrees}deg)`;

  const rim = svgElement('circle', { cx: CENTER, cy: CENTER, r: 196, fill: '#141414', stroke: '#383838', 'stroke-width': 5 });
  svg.append(rim);

  if (!tasks.length) {
    svg.append(svgElement('circle', { cx: CENTER, cy: CENTER, r: 180, fill: '#242424', class: 'placeholder' }));
    const empty = svgElement('text', { x: CENTER, y: CENTER, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'wheel-empty' });
    empty.textContent = 'Добавь задачу';
    svg.append(empty);
    return;
  }

  const slice = 360 / tasks.length;
  tasks.forEach((task, index) => {
    const group = svgElement('g', { class: 'wheel-sector', 'data-task-id': task.id });
    group.append(svgElement('path', {
      d: describeSector(index, tasks.length, 180),
      fill: task.color,
      stroke: '#202020',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }));

    const middle = -90 + (index + 0.5) * slice;
    const labelPoint = polar(tasks.length === 1 ? 92 : 116, middle);
    const label = svgElement('text', {
      x: labelPoint.x,
      y: labelPoint.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'wheel-label',
      transform: `rotate(${getLabelRotation(index, tasks.length)} ${labelPoint.x} ${labelPoint.y})`,
    });
    label.textContent = shortLabel(task.title, tasks.length);
    group.append(label);
    svg.append(group);
  });
}
