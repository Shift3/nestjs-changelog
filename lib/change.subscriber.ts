import "reflect-metadata";
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from "typeorm";
import { ChangeAction } from "./change.entity";
import { ChangeRepository } from "./change.repository";


@EventSubscriber()
export class ChangeSubscriber implements EntitySubscriberInterface<any> {
  public static disabled: boolean = false;
  public static async disableTracking(fn: Function): Promise<void> {
    const originalDisabled = ChangeSubscriber.disabled;
    ChangeSubscriber.disabled = true;
    try {
      await fn();
    } finally {
      ChangeSubscriber.disabled = originalDisabled;
    }
  }

  entity: any;

  async afterInsert(event: InsertEvent<any>) {
    if (ChangeSubscriber.disabled)
      return;

    if (event.entity &&
				Reflect.hasMetadata("__track_changes", event.entity.constructor)) {
      await event.connection.getCustomRepository(ChangeRepository).createChangeEntry(event.entity, ChangeAction.CREATE);
    }
  }

  async afterUpdate(event: UpdateEvent<any>) {
    // IMPORTANT(justin): https://github.com/typeorm/typeorm/issues/2246 the
    // state of things here are terrible, there is no way to reliably fire
    // this event with the information needed. This event fires correctly on
    // `manager.save` and `entity.save` but not `manager.update` or if you do
    // an update via the `queryBuilder.update`

    if (ChangeSubscriber.disabled)
      return;

    if (event.entity) {
      if(event.updatedColumns.length == 0 && event.databaseEntity) {
        // TODO(justin): is this a potential jank ass way to detect soft removes? 
        // typeorm has longstanding issues with this one, deletedAt doesn't come
        // through here even though it should.
        // https://github.com/typeorm/typeorm/issues/6179
        // https://github.com/typeorm/typeorm/issues/7162
        // console.log('soft remove detected');
      }

      if (Reflect.hasMetadata("__track_changes", event.entity.constructor)) {
        await event.connection.getCustomRepository(ChangeRepository).createChangeEntry(event.entity, ChangeAction.UPDATE, event.databaseEntity);
      }
    }
  }

  async beforeRemove(event: RemoveEvent<any>) {
    if (ChangeSubscriber.disabled)
      return;

    if (event.entity && Reflect.hasMetadata("__track_changes", event.entity.constructor)) {
      await event.connection.getCustomRepository(ChangeRepository).createChangeEntry(event.entity, ChangeAction.DESTROY);
    }
  }
}
