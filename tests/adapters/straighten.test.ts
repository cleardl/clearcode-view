import { describe, expect, it } from 'vitest';
import { directConnection, type Point, type Rect } from '../../src/mermaid/straighten.js';

const api: Rect = { x: 399, y: 582.5, width: 152, height: 69 };
const dispatch: Point[] = [{ x: 431, y: 522.5 }, { x: 431, y: 552.5 }, { x: 453.27, y: 552.5 }, { x: 453.27, y: 582.5 }];
const policy: Point[] = [{ x: 519, y: 103.5 }, { x: 519, y: 205.5 }, { x: 519, y: 394 }, { x: 519, y: 552.5 }, { x: 496.73, y: 552.5 }, { x: 496.73, y: 582.5 }];

describe('rectangular port alignment', () => {
  it('keeps both incoming relations separate while removing their terminal steps', () => {
    const direct = directConnection(dispatch, [api], [api], [policy]);
    expect(direct).toEqual([{ x: 431, y: 522.5 }, { x: 431, y: 582.5 }]);
    expect(directConnection(policy, [api], [api], [direct!])).toEqual([{ x: 519, y: 103.5 }, { x: 519, y: 582.5 }]);
  });

  it('retains straight incoming connections when node clearance widens their layout channels', () => {
    const target: Rect = { x: 475, y: 582.5, width: 152, height: 69 };
    const widerDispatch = [{ x: 489, y: 522.5 }, { x: 489, y: 552.5 }, { x: 529.27, y: 552.5 }, { x: 529.27, y: 582.5 }];
    const widerPolicy = [{ x: 613, y: 103.5 }, { x: 613, y: 552.5 }, { x: 572.73, y: 552.5 }, { x: 572.73, y: 582.5 }];
    const direct = directConnection(widerDispatch, [target], [target], [widerPolicy]);
    expect(direct).toEqual([{ x: 489, y: 522.5 }, { x: 489, y: 582.5 }]);
    expect(directConnection(widerPolicy, [target], [target], [direct!])).toEqual([{ x: 613, y: 103.5 }, { x: 613, y: 582.5 }]);
  });

  it('aligns a cross-group output with its channel while preserving the label on the unchanged run', () => {
    const chat: Rect = { x: 117, y: 165.75, width: 152, height: 69 };
    const planner: Rect = { x: 144, y: 441.5, width: 152, height: 69 };
    const label: Rect = { x: 204, y: 320, width: 32, height: 22 };
    const plan = [{ x: 193, y: 234.75 }, { x: 193, y: 280 }, { x: 193, y: 300 }, { x: 220, y: 300 }, { x: 220, y: 382 }, { x: 220, y: 441.5 }];
    expect(directConnection(plan, [chat, planner], [chat, planner, label], [])).toEqual([{ x: 220, y: 234.75 }, { x: 220, y: 441.5 }]);
  });

  it('removes steps at both ends of a long return path while retaining its vertical channel', () => {
    const source: Rect = { x: 268, y: 1658.88, width: 152, height: 69 };
    const target: Rect = { x: 357, y: 154.5, width: 152, height: 91.5 };
    const resultLabel: Rect = { x: 382, y: 700, width: 48, height: 22 };
    const reply = [{ x: 365.73, y: 1658.88 }, { x: 365.73, y: 1615.5 }, { x: 406, y: 1615.5 }, { x: 406, y: 1434.5 }, { x: 406, y: 300 }, { x: 433, y: 300 }, { x: 433, y: 280 }, { x: 433, y: 246 }];
    expect(directConnection(reply, [source, target], [source, target, resultLabel], [])).toEqual([{ x: 406, y: 1658.88 }, { x: 406, y: 246 }]);
    expect(directConnection(reply, [source, target], [source, target, { x: 400, y: 263, width: 20, height: 16 }], [])).toBeUndefined();
  });

  it.each([
    { x: 426, y: 263, width: 14, height: 16 },
    { x: 417, y: 296, width: 4, height: 8 },
  ])('keeps a labelled terminal step when straightening would detach its label', label => {
    const source: Rect = { x: 268, y: 1658.88, width: 152, height: 69 };
    const target: Rect = { x: 357, y: 154.5, width: 152, height: 91.5 };
    const reply = [{ x: 365.73, y: 1658.88 }, { x: 365.73, y: 1615.5 }, { x: 406, y: 1615.5 }, { x: 406, y: 300 }, { x: 433, y: 300 }, { x: 433, y: 246 }];
    expect(directConnection(reply, [source, target], [source, target, label], [])).toBeUndefined();
  });

  it.each([
    { x: 428, y: 562, width: 6, height: 8 },
    { x: 437, y: 562, width: 20, height: 8 },
  ])('preserves a route when its replacement approaches a node or label', obstacle => {
    expect(directConnection(dispatch, [api], [api, obstacle], [])).toBeUndefined();
  });

  it.each([
    { other: [{ x: 420, y: 568 }, { x: 445, y: 568 }] },
    { other: [{ x: 436, y: 560 }, { x: 436, y: 582.5 }] },
  ])('keeps crossing and parallel connections clear', ({ other }) => {
    expect(directConnection(dispatch, [api], [api], [other])).toBeUndefined();
  });

  it('leaves ports near corners and nonrectangular targets unchanged', () => {
    const corner = dispatch.map(point => ({ ...point, x: point.x - 25 }));
    expect(directConnection(corner, [api], [api], [])).toBeUndefined();
    expect(directConnection(dispatch, [], [api], [])).toBeUndefined();
  });

  it('retains necessary turns, large offsets and long approach runs', () => {
    expect(directConnection([dispatch[0], dispatch[1], dispatch[3]], [api], [api], [])).toBeUndefined();
    expect(directConnection(dispatch.map(point => point.x === 431 ? { ...point, x: 400 } : point), [api], [api], [])).toBeUndefined();
    expect(directConnection(dispatch.map(point => ({ ...point, y: point.y === 582.5 ? 682.5 : point.y })), [{ ...api, y: 682.5 }], [], [])).toBeUndefined();
    expect(directConnection([{ x: 431, y: 570 }, ...dispatch.slice(1)], [api], [api], [])).toBeUndefined();
  });

  it('handles a horizontal connection and a short step next to its source', () => {
    const turn: Point[] = [{ x: 20, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 50 }, { x: 100, y: 50 }];
    const source: Rect = { x: 0, y: 0, width: 20, height: 100 };
    expect(directConnection(turn, [source], [source], [])).toEqual([{ x: 20, y: 50 }, { x: 100, y: 50 }]);
  });
});
