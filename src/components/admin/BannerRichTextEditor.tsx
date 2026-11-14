"use client";

import { useSyncExternalStore } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function BannerRichTextEditor({ value, onChange }: Props) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <textarea
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Slide rich text"
        style={{ width: "100%", minHeight: 110 }}
      />
    );
  }

  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      value={value}
      onEditorChange={onChange}
      init={{
        height: 190,
        menubar: false,
        branding: false,
        promotion: false,
        plugins: ["lists", "link", "autolink"],
        toolbar:
          "undo redo | blocks | bold italic underline | bullist numlist | link | removeformat",
        block_formats: "Paragraph=p; Heading 3=h3; Heading 4=h4",
        toolbar_mode: "sliding",
        resize: true,
        statusbar: false,
      }}
    />
  );
}
