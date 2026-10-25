// Messages sent from the app through Moodle's messaging.
export const MESSAGE_MAX = 2000;

export interface MessageState {
  ok?: boolean;
  message?: string;
}
