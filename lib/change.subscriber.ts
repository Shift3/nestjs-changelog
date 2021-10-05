import "reflect-metadata";

import { EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from "typeorm";
import { ChangeAction } from "./change.entity";
import { ChangeRepository } from "./change.repository";


@EventSubscriber()
export class ChangeSubscriber implements EntitySubscriberInterface<any> {
  async afterInsert(event: InsertEvent<any>) {
    if (Reflect.hasMetadata("__audited", event.entity.constructor)) {
      await event.connection.getCustomRepository(ChangeRepository).createAuditEntry(event.entity, ChangeAction.CREATE);
    }
  }

  async afterUpdate(event: UpdateEvent<any>) {
    if (event.entity) {
      if (Reflect.hasMetadata("__audited", event.entity.constructor)) {
        await event.connection.getCustomRepository(ChangeRepository).createAuditEntry(event.entity, ChangeAction.UPDATE, event.databaseEntity);
      }
    }
  }

  async beforeRemove(event: RemoveEvent<any>) {
    if (Reflect.hasMetadata("__audited", event.entity.constructor)) {
      await event.connection.getCustomRepository(ChangeRepository).createAuditEntry(event.entity, ChangeAction.DESTROY);
    }
  }
}
