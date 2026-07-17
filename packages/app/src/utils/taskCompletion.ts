import { Task } from "@/hooks/tasks";
import { matchDate } from "./date";

type UpdateTaskFn = (variables: { id: string; data: Partial<Task> }) => void;

/**
 * Toggles a task's completion for the given day, branching on whether it's a
 * repeating task (completion tracked per-occurrence in `done[]`) or a
 * one-off task (`done` boolean). Shared by the task list checkbox and the
 * alarm ringing overlay so both stay consistent with the same completion rules.
 */
export function completeTaskOccurrence(task: Task, activeDate: Date, updateTask: UpdateTaskFn): void {
  if (!task.id) return;

  if (task.repeater && task.repeater.length !== 0) {
    const newDone = Array.isArray(task.done) ? [...task.done] : [];

    const rawDate = new Date(activeDate);
    rawDate.setHours(0, 0, 0, 0);

    const foundIdx = newDone.findIndex((entry) => matchDate(new Date(entry), rawDate));

    if (foundIdx === -1) {
      newDone.push(rawDate.toString());
    } else {
      newDone.splice(foundIdx, 1);
    }

    updateTask({ id: task.id, data: { ...task, done: newDone } });
  } else {
    updateTask({ id: task.id, data: { ...task, done: !task.done } });
  }
}
