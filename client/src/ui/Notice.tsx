import styles from "./Notice.module.css";

/**
 * A short, polite status message floating above the bottom edge, e.g. why a
 * command was rejected. The live region stays mounted so screen readers
 * announce each new message; the caller clears it after a few seconds.
 */
export function Notice({ message }: { message?: string }) {
  return (
    <div className={styles.region} role="status">
      {message && (
        <p key={message} className={styles.notice}>
          {message}
        </p>
      )}
    </div>
  );
}
