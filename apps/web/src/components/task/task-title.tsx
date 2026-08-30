import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
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

  // docs/found-issues.md:L80 -- round 2. The value react-hook-form
  // actually rendered into the textarea, NOT task?.title and NOT the
  // form's own watch() callback (see the useLayoutEffect below).
  const watchedTitle = useWatch({ control: form.control, name: "title" });

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

  // docs/found-issues.md:L80 -- round 2. The effect above and the
  // ResizeObserver below both fire at the same too-early moment: react
  // has not yet written the resolved title into the textarea's DOM value
  // when they run. Subscribing to the value react-hook-form actually
  // rendered (via useWatch above, NOT the form's own watch() callback,
  // which fires synchronously on the form's internal notification BEFORE
  // React re-renders the controlled field and writes the DOM value -- it
  // would measure the stale value and silently reintroduce this bug)
  // re-renders this component when that value lands, and a layout effect
  // keyed on it fires after the commit that writes the DOM -- so
  // scrollHeight is read against the real title, not an empty or stale
  // box. This is the fix for the round-2 mount clip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: watchedTitle triggers the resync when the rendered value changes; it is not read inside the body
  useLayoutEffect(() => {
    resyncHeight();
  }, [watchedTitle, resyncHeight]);

  // docs/found-issues.md:L80 -- round 2 established that this observer's
  // measurement code was always correct, but its trigger was not: its
  // first observation lands at the same too-early moment the title-keyed
  // effect above already fires, records that width via lastWidthRef, and
  // is then correctly silent for the rest of the mount because the
  // textarea's width never changes again on this path -- proven live by
  // forcing a real width change (457 -> 479px), which the observer does
  // self-correct on. What was missing was a trigger tied to the CONTENT
  // becoming measurable rather than the width changing: the useWatch-keyed
  // effect above and the font-ready effect below now provide that. This
  // observer stays, unchanged, for the case it always served correctly --
  // a genuine width change (viewport resize, panel resize).
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

  // docs/found-issues.md:L80 -- round 2, defense in depth. The web app
  // self-hosts the Geist variable font; a font swap after the first
  // measurement changes the wrap point with no width change and no value
  // change, a case neither trigger above covers. typeof-guards document
  // for SSR, optional-chains the font-loading API's ready promise (skips
  // cleanly on jsdom/any environment without it), and the cancelled flag
  // set in cleanup makes a late resolution after unmount a no-op --
  // resyncHeight also null-checks its ref, so this is belt and braces.
  useEffect(() => {
    let cancelled = false;
    if (typeof document === "undefined") return;
    document.fonts?.ready?.then(() => {
      if (cancelled) return;
      resyncHeight();
    });
    return () => {
      cancelled = true;
    };
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
