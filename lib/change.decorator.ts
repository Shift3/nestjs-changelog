import "reflect-metadata";

export interface ITrackChangesOptions {
  /* only the attributes listed will trigger the creation of a change record,
     by default all attributes are watched */
  only?: string[],

  /* the attributes listed in `except` will not trigger the creation of a
     change record if only they are changed */
  except?: string[],

  /* allows you to choose whether to ignore timestamps like created at,
     updated at, and deleted at. By default, timestamps are ignored, set this
     to false to track changes to timestamps */
  ignoresTimestamps?: boolean,
}
const defaultOptions: ITrackChangesOptions = {
  ignoresTimestamps: true
}

export function TrackChanges(options?: ITrackChangesOptions): ClassDecorator {
  return function(ctor: Function) {
    Reflect.defineMetadata("__track_changes", true, ctor);
    Reflect.defineMetadata("__track_changes_options", { ...defaultOptions, ...options }, ctor);
  }
}
