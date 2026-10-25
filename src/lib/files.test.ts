import { describe, expect, it } from 'vitest';
import { courseImageUrl, DEFAULT_COURSE_IMAGE, fileUrl } from './files';

describe('fileUrl', () => {
  it('sends Moodle files through /api/file', () => {
    expect(fileUrl('http://localhost:8080/pluginfile.php/42/course/overviewfiles/a.jpg'))
      .toBe('/api/file?url=http%3A%2F%2Flocalhost%3A8080%2Fpluginfile.php%2F42%2Fcourse%2Foverviewfiles%2Fa.jpg');
  });

  it("uses Moodle's inline placeholder images as they are", () => {
    const pattern = 'data:image/svg+xml;base64,PHN2Zy8+';
    expect(fileUrl(pattern)).toBe(pattern);
  });

  it('drops data: addresses that are not images, and empty values', () => {
    expect(fileUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
    expect(fileUrl(undefined)).toBeUndefined();
    expect(fileUrl('')).toBeUndefined();
  });
});

describe('courseImageUrl', () => {
  it("uses the course's own uploaded image", () => {
    expect(courseImageUrl('http://localhost:8080/pluginfile.php/42/course/overviewfiles/a.jpg')).toMatch(/^\/api\/file\?url=/);
  });

  it("uses the default picture when there's no image, or only Moodle's generated pattern", () => {
    expect(courseImageUrl(undefined)).toBe(DEFAULT_COURSE_IMAGE);
    expect(courseImageUrl('data:image/svg+xml;base64,PHN2Zy8+')).toBe(DEFAULT_COURSE_IMAGE);
    expect(courseImageUrl('http://localhost:8080/pluginfile.php/42/course/generated/course.svg')).toBe(DEFAULT_COURSE_IMAGE);
  });
});
