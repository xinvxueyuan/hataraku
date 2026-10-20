import { Button } from "@hataraku/ui/components/button";

/**
 * The two pieces every admin form repeats: the failure banner and the save/delete row.
 *
 * Keeping them here means a failed procedure reads the same on all four writing surfaces, and the
 * forms themselves stay about their fields.
 */
export const FormFailure = ({ message }: { message: string | null }) =>
  message === null ? null : (
    <p
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
      role="alert"
    >
      {message}
    </p>
  );

/** The first failure among the form's mutations, or `null` when all of them are idle. */
export const firstFailure = (errors: (Error | null)[]): string | null =>
  errors
    .map((error) => (error === null ? null : error.message))
    .find((message) => message !== null) ?? null;

export const FormActions = ({
  deleteLabel,
  isCreating,
  isDeleting,
  isSaving,
  onDelete,
  submitLabel,
}: {
  deleteLabel?: string;
  isCreating?: boolean;
  isDeleting?: boolean;
  isSaving: boolean;
  onDelete?: () => void;
  submitLabel: string;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button disabled={isSaving || isCreating === true} type="submit">
      {submitLabel}
    </Button>

    {deleteLabel === undefined || onDelete === undefined ? null : (
      <Button
        className="ml-auto"
        disabled={isDeleting === true}
        onClick={onDelete}
        type="button"
        variant="destructive"
      >
        {deleteLabel}
      </Button>
    )}
  </div>
);
