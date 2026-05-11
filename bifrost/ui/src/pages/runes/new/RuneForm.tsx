"use client";

import { Input } from "@base-ui/react/input";

type FormData = {
  title: string;
  description: string;
  priority: number;
  status: "draft" | "open";
  branch: string;
};

type RuneFormProps = {
  form: FormData;
  updateForm: <FieldKey extends keyof FormData>(field: FieldKey, value: FormData[FieldKey]) => void;
};

export const RuneForm = ({ form, updateForm }: RuneFormProps) => (
  <div className="space-y-6">
    <div>
      <label
        htmlFor="new-rune-title"
        className="text-xs uppercase tracking-wider block mb-2 font-bold"
      >
        Title
      </label>
      <Input
        id="new-rune-title"
        type="text"
        value={form.title}
        onChange={(event) => updateForm("title", event.target.value)}
        placeholder="Enter a descriptive title..."
        className="w-full px-4 py-3 text-lg outline-none"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px solid var(--color-border)",
          color: "var(--color-text)",
        }}
        autoFocus
      />
    </div>

    <div>
      <label
        htmlFor="new-rune-description"
        className="text-xs uppercase tracking-wider block mb-2 font-bold"
      >
        Description
      </label>
      <textarea
        id="new-rune-description"
        value={form.description}
        onChange={(event) => updateForm("description", event.target.value)}
        placeholder="Add details about what this rune involves..."
        rows={6}
        className="w-full px-4 py-3 text-base outline-none resize-none"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />
    </div>

    <div>
      <label
        htmlFor="new-rune-branch"
        className="text-xs uppercase tracking-wider block mb-2 font-bold"
      >
        Branch
      </label>
      <Input
        id="new-rune-branch"
        type="text"
        value={form.branch}
        onChange={(event) => updateForm("branch", event.target.value)}
        placeholder="e.g., feature/my-feature"
        className="w-full px-4 py-3 text-base font-mono outline-none"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />
    </div>
  </div>
);
