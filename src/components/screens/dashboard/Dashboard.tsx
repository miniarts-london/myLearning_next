import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CourseCard } from '@/components/screens/dashboard/CourseCard';
import { CourseGrid } from '@/components/screens/dashboard/CourseGrid';
import { SectionTitle } from '@/components/SectionTitle';
import { UpNext } from '@/components/screens/dashboard/UpNext';
import { UpcomingEvents } from '@/components/screens/dashboard/UpcomingEvents';
import type { EventItem } from '@/lib/events';
import { roomWhenLabel, type DashboardClassroomCard } from '@/lib/rooms';
import type { EnrolledCourse } from '@/lib/types';
import type { UpNextItem } from '@/lib/upNext';
import common from '@/css/common.module.css';
import roomStyles from '@/css/DashboardRooms.module.css';

interface DashboardScreenProps {
  firstname: string;
  courses: EnrolledCourse[];
  classrooms: DashboardClassroomCard[];
  // Each is undefined when it doesn't apply (no "Up next" for someone who only teaches; "Upcoming
  // events" only for teachers), and null when Moodle's calendar couldn't be reached.
  upNext?: UpNextItem[] | null;
  events?: EventItem[] | null;
}

function roomLine(room: DashboardClassroomCard): string {
  const kind = room.kind === 'meeting' ? 'Meeting' : (room.courseName ? `Class · ${room.courseName}` : 'Class');
  return kind;
}

export function DashboardScreen({ firstname, courses, upNext, events, classrooms }: DashboardScreenProps) {
  const presenting = classrooms.filter((room) => room.role === 'presenter');
  const attending = classrooms.filter((room) => room.role === 'member');
  return (
    <>
      <Typography variant="h1" className={common.pageTitle}>Welcome back, {firstname}</Typography>

      {/* "Up next": a learner's deadlines, or for a teacher, the upcoming events in their calendar.
          (Someone who both teaches and studies sees both, one after the other.) */}
      <section aria-labelledby="up-next">
        <SectionTitle id="up-next">Up next</SectionTitle>
        {upNext !== undefined && <UpNext items={upNext} />}
        {events !== undefined && <div className={upNext !== undefined ? common.gapAbove : undefined}><UpcomingEvents items={events} /></div>}
      </section>

      {classrooms.length > 0 && (
        <section aria-labelledby="my-classrooms">
          <SectionTitle id="my-classrooms">Classrooms</SectionTitle>
          {presenting.length > 0 && (
            <ul className={roomStyles.list}>
              {presenting.map((room) => (
                <li key={room.id}>
                  <a href={`/room-layout?room=${room.id}`} className={roomStyles.card}>
                    <span className={roomStyles.name}>{room.name}</span>
                    <span className={roomStyles.meta}>{roomLine(room)}</span>
                    <span className={roomStyles.meta}>{room.startsAt ? roomWhenLabel(room.startsAt) : 'Date and time not set'}</span>
                    <span className={roomStyles.meta}>{room.location || 'Location not set'}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {attending.length > 0 && (
            <ul className={`${roomStyles.list} ${presenting.length > 0 ? common.gapAbove : ''}`}>
              {attending.map((room) => (
                <li key={room.id}>
                  <a href={`/room-layout?room=${room.id}`} className={roomStyles.card}>
                    <span className={roomStyles.name}>{room.name}</span>
                    <span className={roomStyles.meta}>
                      {roomLine(room)}{room.startsAt ? ` · ${roomWhenLabel(room.startsAt)}` : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="my-courses">
        <SectionTitle id="my-courses">My courses</SectionTitle>
        {courses.length === 0 ? (
          <Alert severity="info">
            You aren&apos;t enrolled in any courses yet. <Link href="/catalogue">Browse the courses</Link>.
          </Alert>
        ) : (
          <CourseGrid>
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard id={course.id} name={course.fullname} image={course.courseimage} progress={course.progress} />
              </li>
            ))}
          </CourseGrid>
        )}
      </section>
    </>
  );
}
