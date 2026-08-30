import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Form, FormField } from "@/components/ui/form";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import debounce from "@/lib/debounce";

type TaskTitleProps = {
  taskId: string;
};

export default function TaskTitle({ taskId }: TaskTitleProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const isInitializedRef = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskTitle);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskTitle;
  }, [task, updateTaskTitle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: taskId is not needed here
  useEffect(() => {
    isInitializedRef.current = false;
  }, [taskId]);

  const form = useForm<{
    title: string;
  }>({
    values: {
      title: task?.title || "",
    },
  });

  useEffect(() => {
    if (task?.title !== undefined) isInitializedRef.current = true;
  }, [task?.title]);

  const debouncedUpdate = useCallback(
    debounce(async (title: string) => {
      if (!isInitializedRef.current) return;

      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;

      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          title,
        });
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }, 800),
    [],
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!isInitializedRef.current) return;

      debouncedUpdate(value);
    },
    [debouncedUpdate],
  );

  // docs/found-issues.md:L80 -- auto-growing textarea so a realistic RO
  // title wraps instead of clipping at phone width. This effect handles
  // "on mount" and any data-driven value change (task switch); the
  // per-keystroke case is handled inline in onChange below, since the
  // Controller render prop isolates keystroke re-renders from this
  // component (task?.title only changes on real server data).
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resyncHeight = useCallback(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    // task?.title is read here (not just listed as a dep) so this effect
    // is a no-op until the task has actually loaded -- and so it reruns
    // on every real data-driven value change, e.g. switching tasks.
    if (task?.title === undefined) return;
    resyncHeight();
  }, [task?.title, resyncHeight]);

  // docs/found-issues.md:L80 -- the mount/task-switch resync above measures
  // once, too early: at narrow width the task-detail dialog has not
  // finished its entrance layout when it fires, so the textarea is
  // transiently wide, scrollHeight reports one line, and that height is
  // pinned before the settled narrower width ever wraps the title to a
  // second line. A ResizeObserver re-runs the same resync whenever the
  // textarea's own width actually changes (its entrance layout settling,
  // or a later viewport/panel resize) so the pinned height always matches
  // the settled width. Guarded on API availability (jsdom/SSR renders
  // unchanged) and on the observed width actually changing -- resyncHeight
  // itself writes the element's inline height, which is a box change the
  // observer would otherwise re-observe and re-enter on forever.
  const lastWidthRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = titleTextareaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width === undefined || width === lastWidthRef.current) return;
      lastWidthRef.current = width;
      resyncHeight();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [resyncHeight]);

  // docs/found-issues.md:L80 -- a title is single-line semantically even
  // though the box now wraps; Enter confirms/blurs instead of inserting a
  // newline.
  const handleTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    [],
  );

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <textarea
            {...field}
            ref={(el) => {
              field.ref(el);
              titleTextareaRef.current = el;
            }}
            rows={1}
            placeholder={t("tasks:detail.titlePlaceholder")}
            readOnly={!canEdit}
            className="block h-auto w-full resize-none overflow-hidden appearance-none border-0 bg-transparent p-0 font-heading text-xl md:text-[2rem] leading-[1.15] font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:text-foreground/45"
            onChange={(e) => {
              field.onChange(e);
              handleTitleChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleTitleKeyDown}
          />
        )}
      />
    </Form>
  );
}
