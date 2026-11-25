import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outfitHistoryReducer,
  ACTIONS,
  INITIAL_STATE,
} from '../../frontend/src/utils/outfitHistoryMachine.js';

// Helper to create mock look snapshots
function createMockLook(id, anchorId = '0500262002', slots = {}) {
  const defaultSlots = {
    lower_body: { article_id: `lower_${id}`, prod_name: `Pants ${id}` },
    shoes: { article_id: `shoes_${id}`, prod_name: `Shoes ${id}` },
    accessories: { article_id: `acc_${id}`, prod_name: `Bag ${id}` },
  };
  return {
    anchor: { article_id: anchorId, prod_name: `Anchor ${anchorId}` },
    slots: { ...defaultSlots, ...slots },
    overall_score: 0.95,
    selected_sizes: { anchor: 'M', lower_body: '32', shoes: '42' },
  };
}

test('1. Initial outfit generation sets history with 1 entry and activeIndex 0', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  assert.equal(state.history.length, 0);
  assert.equal(state.activeIndex, -1);
  assert.equal(state.isGenerating, true);

  const lookA = createMockLook('A', 'anchor_01');
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookA, contextKey: 'anchor_01:women' },
  });

  assert.equal(state.history.length, 1);
  assert.equal(state.activeIndex, 0);
  assert.equal(state.isGenerating, false);
  assert.equal(state.history[0].anchor.article_id, 'anchor_01');
});

test('2. Resynthesize appends a new outfit and advances active index', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  const lookA = createMockLook('A', 'anchor_01');
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookA, contextKey: 'anchor_01:women' },
  });

  // Start Resynthesize
  state = outfitHistoryReducer(state, { type: ACTIONS.GENERATION_STARTED });
  assert.equal(state.isGenerating, true);

  // Look B generated
  const lookB = createMockLook('B', 'anchor_01');
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookB, contextKey: 'anchor_01:women' },
  });

  assert.equal(state.history.length, 2);
  assert.equal(state.activeIndex, 1);
  assert.equal(state.history[1].slots.shoes.article_id, 'shoes_B');
});

test('3. Previous restores the prior outfit and Next restores the following outfit', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('B', 'anchor_01'), contextKey: 'anchor_01:women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('C', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  assert.equal(state.history.length, 3);
  assert.equal(state.activeIndex, 2); // Look C

  // Previous -> Look B
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_PREVIOUS });
  assert.equal(state.activeIndex, 1);
  assert.equal(state.history[state.activeIndex].slots.lower_body.article_id, 'lower_B');

  // Previous -> Look A
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_PREVIOUS });
  assert.equal(state.activeIndex, 0);
  assert.equal(state.history[state.activeIndex].slots.lower_body.article_id, 'lower_A');

  // Next -> Look B
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_NEXT });
  assert.equal(state.activeIndex, 1);
  assert.equal(state.history[state.activeIndex].slots.lower_body.article_id, 'lower_B');

  // Next -> Look C
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_NEXT });
  assert.equal(state.activeIndex, 2);
  assert.equal(state.history[state.activeIndex].slots.lower_body.article_id, 'lower_C');
});

test('4. Previous at first entry is a no-op (boundary check)', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  assert.equal(state.activeIndex, 0);
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_PREVIOUS });
  assert.equal(state.activeIndex, 0); // Unchanged
});

test('5. Next at last entry is a no-op (boundary check)', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  assert.equal(state.activeIndex, 0);
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_NEXT });
  assert.equal(state.activeIndex, 0); // Unchanged
});

test('6. Generating from earlier history preserves existing history (Scenario D)', () => {
  // History: [A, B, C], Current: B
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('B', 'anchor_01'), contextKey: 'anchor_01:women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('C', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  // User navigates back to B
  state = outfitHistoryReducer(state, { type: ACTIONS.GO_PREVIOUS });
  assert.equal(state.activeIndex, 1);

  // User clicks Resynthesize -> Look D generated
  state = outfitHistoryReducer(state, { type: ACTIONS.GENERATION_STARTED });
  const lookD = createMockLook('D', 'anchor_01');
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookD, contextKey: 'anchor_01:women' },
  });

  // Invariant: History must be [A, B, C, D] and current must be D (activeIndex = 3)
  assert.equal(state.history.length, 4);
  assert.equal(state.activeIndex, 3);
  assert.equal(state.history[0].slots.lower_body.article_id, 'lower_A');
  assert.equal(state.history[1].slots.lower_body.article_id, 'lower_B');
  assert.equal(state.history[2].slots.lower_body.article_id, 'lower_C'); // C is preserved!
  assert.equal(state.history[3].slots.lower_body.article_id, 'lower_D');
});

test('7. Failed generation does not alter history or activeIndex', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  // Attempt Resynthesize but fails
  state = outfitHistoryReducer(state, { type: ACTIONS.GENERATION_STARTED });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_FAILED,
    payload: { error: 'Network timeout', contextKey: 'anchor_01:women' },
  });

  assert.equal(state.history.length, 1);
  assert.equal(state.activeIndex, 0);
  assert.equal(state.isGenerating, false);
  assert.equal(state.error, 'Network timeout');
});

test('8. Changing anchor resets context and establishes a fresh history context (Scenario F)', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  // Switch to anchor_02
  state = outfitHistoryReducer(state, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_02', gender: 'women' },
  });

  assert.equal(state.history.length, 0);
  assert.equal(state.activeIndex, -1);
  assert.equal(state.contextKey, 'anchor_02:women');
  assert.equal(state.anchorProductId, 'anchor_02');

  // Load Look for anchor_02
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A2', 'anchor_02'), contextKey: 'anchor_02:women' },
  });

  assert.equal(state.history.length, 1);
  assert.equal(state.activeIndex, 0);
  assert.equal(state.history[0].anchor.article_id, 'anchor_02');
});

test('9. Stale async API response from old context is ignored (Scenario G / Race condition guard)', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });

  // User rapidly switches to men before request finishes
  state = outfitHistoryReducer(state, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'men' },
  });

  // Stale response arrives for old context 'anchor_01:women'
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('OldWomenLook', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  // Stale response must be discarded! History remains empty until men response arrives
  assert.equal(state.history.length, 0);
  assert.equal(state.activeIndex, -1);

  // Proper men response arrives
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('MenLook', 'anchor_01'), contextKey: 'anchor_01:men' },
  });
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].slots.lower_body.article_id, 'lower_MenLook');
});

test('10. Duplicate look signatures are prevented and candidate exhaustion handled', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  const lookA = createMockLook('A', 'anchor_01');
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookA, contextKey: 'anchor_01:women' },
  });

  // Attempt to insert identical look again
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: lookA, contextKey: 'anchor_01:women' },
  });

  // Invariant: Duplicate must not be inserted
  assert.equal(state.history.length, 1);
  assert.equal(state.activeIndex, 0);
  assert.equal(state.exhausted, true);

  // Backend returns explicit exhausted signal
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: {
      look: { ...lookA, exhausted: true, message: 'No more distinct looks available for these preferences.' },
      contextKey: 'anchor_01:women',
    },
  });
  assert.equal(state.history.length, 1);
  assert.equal(state.exhausted, true);
  assert.equal(state.error, 'No more distinct looks available for these preferences.');
});

test('11. Size changes update snapshot immutably without altering other history entries', () => {
  let state = outfitHistoryReducer(INITIAL_STATE, {
    type: ACTIONS.RESET_CONTEXT,
    payload: { anchorProductId: 'anchor_01', gender: 'women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('A', 'anchor_01'), contextKey: 'anchor_01:women' },
  });
  state = outfitHistoryReducer(state, {
    type: ACTIONS.GENERATION_SUCCEEDED,
    payload: { look: createMockLook('B', 'anchor_01'), contextKey: 'anchor_01:women' },
  });

  // Look B is active (index 1), change its lower_body size to '34'
  state = outfitHistoryReducer(state, {
    type: ACTIONS.UPDATE_SIZE,
    payload: { key: 'lower_body', size: '34' },
  });

  assert.equal(state.history[1].selected_sizes.lower_body, '34');
  // Look A's size must remain untouched
  assert.equal(state.history[0].selected_sizes.lower_body, '32');
});
