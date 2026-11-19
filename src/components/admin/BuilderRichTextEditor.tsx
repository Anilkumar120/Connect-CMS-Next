"use client";

import { useSyncExternalStore } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function BuilderRichTextEditor({ value, onChange }: Props) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <textarea
        rows={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Text widget content"
        style={{ width: "100%", minHeight: 180, boxSizing: "border-box" }}
      />
    );
  }

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        value={value}
        onEditorChange={onChange}
        init={{
          height: 340,
          min_height: 260,
          menubar: "edit view insert format table tools",
          branding: false,
          promotion: false,
          plugins: [
            "advlist", "autolink", "lists", "link", "image", "charmap",
            "preview", "anchor", "searchreplace", "visualblocks", "code",
            "fullscreen", "insertdatetime", "media", "table", "wordcount",
            "help", "hr", "nonbreaking", "emoticons",
          ],
          toolbar: [
            "undo redo | blocks | fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor",
            "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table hr",
            "removeformat | visualblocks code fullscreen",
          ].join(" | "),
          block_formats: "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Preformatted=pre; Blockquote=blockquote",
          toolbar_mode: "sliding",
          resize: true,
          statusbar: true,
          elementpath: true,
          paste_data_images: true,
          automatic_uploads: true,
          images_upload_handler: async (blobInfo) => {
            const formData = new FormData();
            formData.append("file", blobInfo.blob(), blobInfo.filename());
            const response = await fetch("/api/admin/pages/upload", {
              method: "POST",
              body: formData,
            });
            const result = await response.json();
            if (!response.ok || !result.success || !result.image) {
              throw new Error(result.message || "Image upload failed.");
            }
            return result.image as string;
          },
          content_style: `
            body { font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.65; color: #263445; padding: 12px; }
            img, video { max-width: 100%; height: auto; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #cbd5e1; padding: 6px 8px; }
            a { color: #1765b3; }
          `,
          skin: "oxide",
          content_css: "default",
          convert_urls: false,
          relative_urls: false,
          remove_script_host: false,
        }}
      />
    </div>
  );
}
