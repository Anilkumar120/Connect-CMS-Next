
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";

export type TinyMcePageEditorHandle = {
  getContent: () => string;
};

type TinyMcePageEditorProps = {
  initialContent?: string;
};

const TinyMcePageEditor = forwardRef<
  TinyMcePageEditorHandle,
  TinyMcePageEditorProps
>(function TinyMcePageEditor(
  { initialContent = "" },
  ref
) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [mounted, setMounted] = useState(false);

  // Render TinyMCE only after the browser has mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  useImperativeHandle(ref, () => ({
    getContent() {
      return editorRef.current?.getContent() || "";
    },
  }));

  return (
    <div className="tiny-page-editor">
      {mounted ? (
        <Editor
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          licenseKey="gpl"
          onInit={(_event, editor) => {
            editorRef.current = editor;
          }}
          onRemove={() => {
            editorRef.current = null;
          }}
          initialValue={initialContent}
          init={{
            height: 520,
            menubar: false,
            branding: false,
            promotion: false,

            plugins: [
              "advlist",
              "autolink",
              "lists",
              "link",
              "image",
              "charmap",
              "preview",
              "anchor",
              "searchreplace",
              "visualblocks",
              "code",
              "fullscreen",
              "insertdatetime",
              "media",
              "table",
              "help",
              "wordcount",
            ],

            toolbar:
              "undo redo | blocks | bold italic underline strikethrough | " +
              "forecolor backcolor | alignleft aligncenter alignright alignjustify | " +
              "bullist numlist | outdent indent | link image media table | " +
              "removeformat | code fullscreen",

            block_formats:
              "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; " +
              "Heading 4=h4; Heading 5=h5; Heading 6=h6",

            toolbar_mode: "sliding",
            resize: true,
            statusbar: true,
            elementpath: true,

            paste_data_images: true,
            automatic_uploads: true,

            images_upload_handler: async (blobInfo, progress) => {
              const formData = new FormData();

              formData.append(
                "file",
                blobInfo.blob(),
                blobInfo.filename()
              );

              const response = await fetch(
                "/api/admin/pages/upload",
                {
                  method: "POST",
                  body: formData,
                }
              );

              const result = await response.json();

              if (
                !response.ok ||
                !result.success ||
                !result.image
              ) {
                throw new Error(
                  result.message || "Image upload failed."
                );
              }

              progress(100);
              return result.image as string;
            },

            content_style: `
              body {
                font-family: Arial, Helvetica, sans-serif;
                font-size: 16px;
                line-height: 1.7;
                color: #263445;
                padding: 12px;
              }

              img {
                max-width: 100%;
                height: auto;
              }

              a {
                color: #1765b3;
              }
            `,

            skin: "oxide",
            content_css: "default",

            convert_urls: false,
            relative_urls: false,
            remove_script_host: false,

            setup: (editor) => {
              editor.on("init", () => {
                editor.getBody().setAttribute(
                  "spellcheck",
                  "true"
                );
              });
            },
          }}
        />
      ) : (
        <div
          style={{
            height: 520,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #dce2ea",
            borderRadius: 7,
            background: "#fff",
            color: "#667085",
            fontSize: 13,
          }}
        >
          Loading visual editor...
        </div>
      )}

      <style jsx global>{`
        .tiny-page-editor {
          width: 100%;
          min-width: 0;
        }

        .tiny-page-editor .tox-tinymce {
          border: 1px solid #dce2ea !important;
          border-radius: 7px !important;
        }

        .tiny-page-editor .tox .tox-toolbar__primary {
          background: #f8fafc !important;
        }

        .tiny-page-editor .tox .tox-edit-area::before {
          border: 0 !important;
        }

        .tiny-page-editor .tox .tox-statusbar {
          border-top: 1px solid #e5eaf0 !important;
        }
      `}</style>
    </div>
  );
});

export default TinyMcePageEditor;
