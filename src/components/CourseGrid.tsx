import styles from '@/css/CourseGrid.module.css';

// A responsive list of course cards: as many 15rem-wide columns as fit.
export function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul role="list" className={styles.grid}>
      {children}
    </ul>
  );
}
