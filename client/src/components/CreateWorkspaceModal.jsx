import React, { useState } from "react";

const initialForm = {
  name: "",
  description: "",
  mode: "general",
};

function CreateWorkspaceModal({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  function handleChange(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await onCreate({
        name: form.name,
        description: form.description || undefined,
        mode: form.mode,
      });
      setForm(initialForm);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not create workspace");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="modal-panel" role="dialog">
        <div className="modal-header">
          <h2>New Workspace</h2>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input
              maxLength={100}
              name="name"
              onChange={handleChange}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={500}
              name="description"
              onChange={handleChange}
              rows={4}
              value={form.description}
            />
          </label>
          <label>
            Mode
            <select name="mode" onChange={handleChange} value={form.mode}>
              <option value="general">General</option>
              <option value="developer">Developer</option>
              <option value="creative">Creative</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default CreateWorkspaceModal;
