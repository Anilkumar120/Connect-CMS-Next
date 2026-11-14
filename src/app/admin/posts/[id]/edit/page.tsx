
import { Suspense } from "react";
import PostEditor from "@/components/admin/PostEditor";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function EditPostContent({
  params,
}: EditPostPageProps) {
  const { id } = await params;

  return <PostEditor postId={id} />;
}

function PostEditorLoading() {
  return (
    <div
      style={{
        padding: 30,
        color: "#64748b",
        fontSize: 14,
      }}
    >
      Loading Post Editor...
    </div>
  );
}

export default function EditPostPage({
  params,
}: EditPostPageProps) {
  return (
    <Suspense fallback={<PostEditorLoading />}>
      <EditPostContent params={params} />
    </Suspense>
  );
}
