import "reflect-metadata";

export interface ITrackChangesOptions {
  /* only the attributes listed will trigger the creation of a change record,
     by default all attributes are watched */
  only?: string[],

  /* the attributes listed in `except` will not trigger the creation of a
     change record if only they are changed */
  except?: string[],
}
const defaultOptions: ITrackChangesOptions = {}

export function TrackChanges(options?: ITrackChangesOptions): ClassDecorator {
  return function(ctor: Function) {
    Reflect.defineMetadata("__track_changes", true, ctor);
    Reflect.defineMetadata("__track_changes_options", { ...defaultOptions, ...options }, ctor);
  }
}
