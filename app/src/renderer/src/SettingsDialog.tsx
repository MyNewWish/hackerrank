import { useEffect, useRef, useState } from "react";
import type { Settings } from "../../shared/api";

interface Props {
  initial: Settings;
  /** Saves the settings; rejects with a message to show if they are invalid. */
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

/** Edits the bank folder and the Python path. Blank fields mean the defaults. */
export function SettingsDialog({ initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className="settings" onClose={onClose} aria-label="Settings">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2>Settings</h2>
        <label>
          Question bank folder
          <input
            value={draft.bankDir}
            onChange={(e) => setDraft({ ...draft, bankDir: e.target.value })}
            placeholder="Blank = the repo's questions folder"
            spellCheck={false}
          />
          <span className="muted">Your solutions are saved in a <code>workspace</code> folder next to it.</span>
        </label>
        <label>
          Python interpreter
          <input
            value={draft.pythonPath}
            onChange={(e) => setDraft({ ...draft, pythonPath: e.target.value })}
            placeholder="Blank = auto-detect (python3, python, py -3)"
            spellCheck={false}
          />
          <span className="muted">e.g. a virtualenv's python executable.</span>
        </label>
        {error && <p className="settings-error">{error}</p>}
        <div className="settings-actions">
          <button type="button" className="secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
