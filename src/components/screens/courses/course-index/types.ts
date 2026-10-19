// The course index only needs a little of each activity, so the layout sends just this to the browser.
export interface IndexActivity {
  id: number;
  name: string;
  href?: string; // Missing for activities with no page of their own
  completion: 'done' | 'todo' | null; // null when completion isn't tracked
}

export interface IndexSection {
  id: number;
  name: string;
  activities: IndexActivity[];
}
