/** UI-local save domains sharing one change tracker, storage entry and navigation guard. */
export type TrackSaveSection = 'journey' | 'tuning';
export type TrackSaveSignatures = Record<TrackSaveSection, string>;
export type UnsavedTrackChanges = Record<TrackSaveSection, boolean> & { history?: boolean };
export type TrackSaveChoice = TrackSaveSection | 'history' | 'all';
