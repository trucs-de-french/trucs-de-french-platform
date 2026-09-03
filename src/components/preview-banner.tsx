import { endStudentPreview } from "@/app/admin/courses/actions";
import { SubmitButton } from "@/components/submit-button";

// Показується, коли вчитель дивиться курс через "Переглянути як студент"
// (admin/courses/[id]/page.tsx) і is_published/archived_at пропускають
// студента — @/lib/course-preview.
export function PreviewBanner({ productId }: { productId: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
      <span>Ви переглядаєте курс як записаний студент.</span>
      <form action={endStudentPreview.bind(null, productId)}>
        <SubmitButton
          pendingChildren="..."
          className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
        >
          Вийти з перегляду
        </SubmitButton>
      </form>
    </div>
  );
}

// Показується замість вмісту, коли is_published/archived_at заблокували б
// доступ реальному записаному студенту.
export function PreviewBlocked({ productId }: { productId: string }) {
  return (
    <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
      <p className="font-medium">Недоступно студенту</p>
      <p className="mt-1">
        Курс не опубліковано або архівовано — записаний студент цього не побачить.
      </p>
      <form action={endStudentPreview.bind(null, productId)} className="mt-3">
        <SubmitButton
          pendingChildren="..."
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900"
        >
          Вийти з перегляду
        </SubmitButton>
      </form>
    </div>
  );
}
