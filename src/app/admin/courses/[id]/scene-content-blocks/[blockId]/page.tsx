import Link from "next/link";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSceneContentBlock, deleteSceneContentBlock } from "@/app/admin/scene-content-blocks/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { ContentBlockFields, type ContentBlockInitial } from "../content-block-fields";
import { BUTTON_DANGER } from "@/lib/button-styles";
import { BREADCRUMB_LINK } from "@/lib/typography-styles";

type BlockDetail = ContentBlockInitial & { id: string; scene_id: string };

export default async function EditSceneContentBlockPage({
  params,
}: {
  params: Promise<{ id: string; blockId: string }>;
}) {
  const { id: productId, blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase
    .from("scene_content_blocks")
    .select("id, scene_id, title, content_type, content_text, media_url, media_provider")
    .eq("id", blockId)
    .single<BlockDetail>();

  if (!block) notFound();

  const backHref = `/admin/courses/${productId}/scenes/${block.scene_id}`;

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        ← До сцени
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Редагування додаткового блоку</h1>

      <SaveForm
        action={updateSceneContentBlock.bind(null, productId, block.scene_id, blockId)}
        className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
        backLink={{ href: backHref, label: "← До сцени" }}
      >
        <ContentBlockFields initialBlock={block} />
      </SaveForm>

      <ConfirmForm
        action={deleteSceneContentBlock.bind(null, productId, block.scene_id, blockId)}
        message="Видалити цей блок? Цю дію не можна скасувати."
        className="mt-3"
      >
        <SubmitButton
          pendingChildren="Видаляю..."
          className={`inline-flex items-center gap-1.5 ${BUTTON_DANGER}`}
        >
          <Trash2 size={16} />
          Видалити блок
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}
