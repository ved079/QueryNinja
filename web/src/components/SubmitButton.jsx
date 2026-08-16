/**
 * The Submit action, kept separate from the other toolbar buttons so its size
 * and style can be tuned independently. Pass `width`/`height` to resize it.
 */
export default function SubmitButton({ onClick, disabled, width, height, children = 'Submit' }) {
  return (
    <button
      type="button"
      className="submit-btn"
      onClick={onClick}
      disabled={disabled}
      style={{ width, height }}
    >
      {children}
    </button>
  );
}
