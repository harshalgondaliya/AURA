/**
 * frontend/src/utils/outfitHistoryMachine.js
 * Centralized, Pure State Machine for Outfit Studio Recommendation History.
 */

export const ACTIONS = {
  RESET_CONTEXT: 'RESET_CONTEXT',
  GENERATION_STARTED: 'GENERATION_STARTED',
  GENERATION_SUCCEEDED: 'GENERATION_SUCCEEDED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  GO_PREVIOUS: 'GO_PREVIOUS',
  GO_NEXT: 'GO_NEXT',
  UPDATE_SIZE: 'UPDATE_SIZE',
  SET_SAVED: 'SET_SAVED',
};

export const INITIAL_STATE = {
  history: [],
  activeIndex: -1,
  anchorProductId: null,
  contextKey: null,
  isGenerating: false,
  error: null,
  exhausted: false,
  isSaved: false,
};

export function computeLookSignature(look) {
  if (!look) return '';
  const slotSignatures = look.slots
    ? Object.entries(look.slots)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, s]) => `${k}:${s?.article_id || ''}`)
        .join('|')
    : '';
  return `${look.anchor?.article_id || ''}#${slotSignatures}`;
}

export function extractSizesFromData(data) {
  const s = {};
  if (data?.anchor) {
    s.anchor = data.anchor.selected_size || (Array.isArray(data.anchor.sizes) && data.anchor.sizes.length > 0 ? data.anchor.sizes[0] : '');
  }
  if (data?.slots) {
    Object.entries(data.slots).forEach(([k, item]) => {
      s[k] = item?.selected_size || (Array.isArray(item?.sizes) && item.sizes.length > 0 ? item.sizes[0] : '');
    });
  }
  return s;
}

export function outfitHistoryReducer(state, action) {
  switch (action.type) {
    case ACTIONS.RESET_CONTEXT: {
      const { anchorProductId, gender } = action.payload;
      return {
        ...state,
        history: [],
        activeIndex: -1,
        anchorProductId,
        contextKey: `${anchorProductId}:${gender}`,
        isGenerating: true,
        error: null,
        exhausted: false,
        isSaved: false,
      };
    }

    case ACTIONS.GENERATION_STARTED: {
      return {
        ...state,
        isGenerating: true,
        error: null,
      };
    }

    case ACTIONS.GENERATION_SUCCEEDED: {
      const { look, contextKey } = action.payload;
      // Stale context guard: ignore responses for a previous anchor or gender
      if (contextKey !== state.contextKey) {
        return state;
      }

      // Check if backend reported candidate pool exhaustion
      if (look.exhausted) {
        return {
          ...state,
          isGenerating: false,
          exhausted: true,
          error: look.message || 'No more distinct looks available for these preferences.',
        };
      }

      // Compute canonical outfit signature to prevent duplicate look entries
      const lookSignature = computeLookSignature(look);

      // If an exact identical outfit signature is already stored in history, don't insert duplicate
      const isDuplicate = state.history.some((h) => h.signature === lookSignature);
      if (isDuplicate) {
        return {
          ...state,
          isGenerating: false,
          exhausted: true,
          error: 'No more distinct looks available for these preferences.',
        };
      }

      const immutableLook = {
        ...look,
        signature: lookSignature,
        selected_sizes: { ...(look.selected_sizes || {}) },
      };

      // Invariant: New generation appends to existing history and advances activeIndex to the latest entry
      const newHistory = [...state.history, immutableLook];
      const newIndex = newHistory.length - 1;

      return {
        ...state,
        history: newHistory,
        activeIndex: newIndex,
        isGenerating: false,
        error: null,
        exhausted: false,
        isSaved: false,
      };
    }

    case ACTIONS.GENERATION_FAILED: {
      const { error, contextKey } = action.payload;
      if (contextKey && contextKey !== state.contextKey) {
        return state;
      }
      return {
        ...state,
        isGenerating: false,
        error: error || 'Failed to synthesize outfit',
      };
    }

    case ACTIONS.GO_PREVIOUS: {
      // Invariant: Navigation only moves active index, zero API calls, zero mutations
      if (state.activeIndex <= 0) return state;
      return {
        ...state,
        activeIndex: state.activeIndex - 1,
        isSaved: false,
        error: null,
      };
    }

    case ACTIONS.GO_NEXT: {
      // Invariant: Navigation only moves active index, zero API calls, zero mutations
      if (state.activeIndex >= state.history.length - 1) return state;
      return {
        ...state,
        activeIndex: state.activeIndex + 1,
        isSaved: false,
        error: null,
      };
    }

    case ACTIONS.UPDATE_SIZE: {
      const { key, size } = action.payload;
      if (state.activeIndex < 0 || !state.history[state.activeIndex]) return state;

      const currentLook = state.history[state.activeIndex];
      const updatedSizes = {
        ...(currentLook.selected_sizes || {}),
        [key]: size,
      };

      const updatedLook = {
        ...currentLook,
        selected_sizes: updatedSizes,
      };

      const updatedHistory = [...state.history];
      updatedHistory[state.activeIndex] = updatedLook;

      return {
        ...state,
        history: updatedHistory,
      };
    }

    case ACTIONS.SET_SAVED: {
      return {
        ...state,
        isSaved: action.payload,
      };
    }

    default:
      return state;
  }
}
