import "reflect-metadata";

export interface ITrackChangesOptions {
  only?: string[],
  except?: string[],

}
const defaultOptions: ITrackChangesOptions = {}

export function TrackChanges(options?: ITrackChangesOptions): ClassDecorator {
  return function(ctor: Function) {
    Reflect.defineMetadata("__audited", true, ctor);
    Reflect.defineMetadata("__audited_options", { ...defaultOptions, ...options }, ctor);
  }
}
