import type { AppState } from '@domain/types';
import { experienceEngine as food } from '@domain/experience';

export function reconcileToday(state: AppState, date: string, mode: 'confirm' | 'swap'): AppState {
  const experience = state.experience!;
  const slot = experience.preferredSlot;
  const today = food.today(state, date, slot);
  const daily = today.choice;
  if (!daily || (today.status !== 'uncooked' && !(mode === 'swap' && today.status === 'ready')))
    return state;
  const week = experience.weeks.find((item) => item.id === experience.activeWeekId);
  if (!week) return state;
  const use =
    mode === 'swap'
      ? week.uses.find((item) => item.id === daily.useId && !item.skipped)
      : week.uses.find((item) => item.date === date && item.slot === slot && !item.skipped);
  if (!use) return state;
  const choice = week.choices.find((item) => item.id === use.choiceId);
  if (!choice) return state;
  if (mode === 'confirm' && daily.origin !== 'book' && daily.origin !== 'week') return state;
  if (
    daily.recipeId === choice.recipeId &&
    daily.useId === use.id &&
    daily.batchId === (choice.readyBatchId ?? null)
  )
    return state;
  const selected = food.chooseToday(state, date, slot, choice.recipeId, {
    useId: use.id,
    ...(choice.readyBatchId ? { batchId: choice.readyBatchId } : {}),
  });
  return {
    ...selected,
    experience: {
      ...selected.experience!,
      dailyChoices: selected.experience!.dailyChoices.map((item) =>
        item.id === daily.id ? { ...item, origin: 'week' } : item,
      ),
    },
  };
}

export function resolveCookingContext(
  state: AppState,
  input: { recipeId: string; date: string; choiceId?: string; weekId?: string },
) {
  const slot = state.experience!.preferredSlot;
  let working = state;
  const weekly = state.experience!.weeks.find(
    (week) =>
      week.id === input.weekId || week.choices.some((choice) => choice.id === input.choiceId),
  );
  const target = weekly?.choices.find((choice) => choice.id === input.choiceId);
  if (target) {
    const use = weekly!.uses.find((item) => item.choiceId === target.id && !item.skipped);
    working = food.chooseToday(working, input.date, slot, input.recipeId, { useId: use?.id });
  } else if (food.today(working, input.date, slot).choice?.recipeId !== input.recipeId) {
    working = food.chooseToday(working, input.date, slot, input.recipeId);
  }
  const daily = food.today(working, input.date, slot).choice!;
  const linkedWeek = working.experience!.weeks.find((week) =>
    week.uses.some((use) => use.id === daily.useId),
  );
  const requestedWeekId = target ? weekly!.id : (linkedWeek?.id ?? input.weekId);
  const running = working.experience!.sessions.find(
    (session) =>
      session.recipeId === input.recipeId &&
      !session.finishedAt &&
      (requestedWeekId === undefined || session.weekId === requestedWeekId),
  );
  if (running) {
    const currentUseWeek = working.experience!.weeks.find((week) =>
      week.uses.some((use) => use.id === daily.useId),
    );
    const useId = currentUseWeek?.id === running.weekId ? daily.useId : null;
    const experience = working.experience!;
    working = {
      ...working,
      experience: {
        ...experience,
        batches: experience.batches.map((batch) =>
          batch.choiceId === daily.id ? { ...batch, choiceId: null } : batch,
        ),
        sessions: experience.sessions.map((session) =>
          session.id === running.id
            ? { ...session, choiceId: daily.id }
            : session.choiceId === daily.id
              ? { ...session, choiceId: null }
              : session,
        ),
        dailyChoices: experience.dailyChoices.map((choice) =>
          choice.id === daily.id
            ? { ...choice, useId, sessionId: running.id, batchId: null, logId: null }
            : choice.sessionId === running.id
              ? { ...choice, sessionId: null }
              : choice,
        ),
      },
    };
  }
  return {
    state: working,
    dailyChoiceId: daily.id,
    weekId: running?.weekId ?? requestedWeekId,
    sessionId: running?.id,
  };
}
