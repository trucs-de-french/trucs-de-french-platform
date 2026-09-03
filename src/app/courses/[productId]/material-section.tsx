"use client";

import { useState } from "react";
import Link from "next/link";

type Material = { id: string; title: string | null; file_url: string | null };

// Акордеон згортає/розгортає СПИСОК карток під заголовком — не вміст
// окремого матеріалу (клік на картку, як і раніше, веде на
// /materials/[materialId], сервер (DelfMaterials) фетчить дані, цей
// компонент лише керує розгорнуто/згорнуто).
export function MaterialSection({
  label,
  materials,
  productId,
}: {
  label: string;
  materials: Material[];
  productId: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <span aria-hidden className="text-neutral-500 dark:text-neutral-400">
          {open ? "▾" : "▸"}
        </span>
        <h2 className="text-lg font-medium">{label}</h2>
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id}>
              <Link
                href={`/courses/${productId}/materials/${m.id}`}
                className="block rounded-md border p-3 font-medium hover:bg-neutral-50 hover:underline dark:hover:bg-neutral-800"
              >
                {m.title || m.file_url || "Матеріал"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
