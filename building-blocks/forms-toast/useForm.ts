// useForm.ts — Tiny typed form hook with Zod-friendly validation, no external deps.
// Destination: src/lib/useForm.ts
'use client';

import {
  useCallback,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

/** Map of field name to error message. */
export type FormErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Validation result. Return an empty object (or omit keys) when valid.
 * Compatible with a wrapper around Zod's `safeParse`:
 *
 *   validate: (values) => {
 *     const r = schema.safeParse(values);
 *     if (r.success) return {};
 *     return Object.fromEntries(
 *       r.error.issues.map((i) => [i.path[0], i.message]),
 *     );
 *   }
 */
export type Validate<T> = (values: T) => FormErrors<T>;

export interface UseFormOptions<T> {
  initial: T;
  validate?: Validate<T>;
  onSubmit?: (values: T) => void | Promise<void>;
}

export interface UseFormReturn<T> {
  values: T;
  errors: FormErrors<T>;
  isSubmitting: boolean;
  /** Wire to an <input>/<select>/<textarea> onChange. */
  handleChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  /** Programmatically set a single field. */
  setValue: <K extends keyof T>(name: K, value: T[K]) => void;
  /** Wire to a <form> onSubmit. */
  handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  reset: () => void;
}

export function useForm<T extends Record<string, unknown>>({
  initial,
  validate,
  onSubmit,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    <K extends keyof T>(name: K, value: T[K]): void => {
      setValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [],
  );

  const handleChange = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ): void => {
      const { name, value, type } = event.target;
      const nextValue =
        type === 'checkbox' && event.target instanceof HTMLInputElement
          ? event.target.checked
          : value;
      setValue(name as keyof T, nextValue as T[keyof T]);
    },
    [setValue],
  );

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
      event?.preventDefault();

      if (validate) {
        const validationErrors = validate(values);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) return;
      } else {
        setErrors({});
      }

      if (!onSubmit) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, values, onSubmit],
  );

  const reset = useCallback((): void => {
    setValues(initial);
    setErrors({});
    setIsSubmitting(false);
  }, [initial]);

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    setValue,
    handleSubmit,
    reset,
  };
}
