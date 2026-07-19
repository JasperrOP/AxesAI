import mongoose, { Schema, Document } from 'mongoose';

/**
 * A persisted whiteboard for a meeting. `elements` holds the drawing primitives
 * (strokes / shapes / text) so a late joiner can render the full board, and the
 * teacher can reopen it after the meeting ends.
 */
export interface IWhiteboardElement {
  id: string;
  type: 'path' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text';
  color: string;
  width: number;
  points?: number[][];      // for freehand path / line / arrow
  x?: number; y?: number;   // for rect / ellipse / text
  w?: number; h?: number;
  text?: string;
  fontSize?: number;
  authorId?: string;
  authorName?: string;
}

export interface IWhiteboard extends Document {
  meetingId: mongoose.Types.ObjectId;
  classroomId: mongoose.Types.ObjectId;
  elements: IWhiteboardElement[];
  updatedAt: Date;
}

const WhiteboardSchema: Schema = new Schema({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, unique: true, index: true },
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  elements: { type: [Schema.Types.Mixed], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IWhiteboard>('Whiteboard', WhiteboardSchema);
