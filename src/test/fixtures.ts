import type { EnrolledCourse } from '@/lib/types';

// Sample data for component tests. Build variations with spreads: course({ progress: 100 }).
export function course(overrides: Partial<EnrolledCourse> = {}): EnrolledCourse {
  return {
    id: 2,
    fullname: 'Accessible Web Design',
    shortname: 'AWD101',
    summary: '<p>Build websites everyone can use.</p>',
    category: 1,
    progress: 25,
    visible: 1,
    ...overrides,
  };
}
