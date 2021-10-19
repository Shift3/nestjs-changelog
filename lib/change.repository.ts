import { ClassConstructor, plainToClass } from 'class-transformer';
import { EntityRepository, getMetadataArgsStorage, LessThan, LessThanOrEqual, MoreThan, Not, ObjectLiteral, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { ITrackChangesOptions } from './change.decorator';
import { Change, ChangeAction } from './change.entity';
import { ChangeModuleOptions } from './change.module';

@EntityRepository(Change)
export class ChangeRepository extends Repository<Change> {
  static options: ChangeModuleOptions = {};

  getEntityPK<T extends ObjectLiteral>(entity: T): string {
    let pks = this.manager.connection.getMetadata(entity.constructor).primaryColumns.map(p => p.getEntityValue(entity))
    return pks.join(':::');
  }

  retreiveEntityBeforeChange(change: Change) {
    const itemKlass = this.itemTypeToEntityType(change.itemType);

    if (ChangeRepository.options.customDeserializer) {
      return ChangeRepository.options.customDeserializer(itemKlass as ClassConstructor<typeof itemKlass>, change.json);
    }

    let item = plainToClass(itemKlass as ClassConstructor<typeof itemKlass>, change.json);
    return item;
  }

  /*
    Creates a change entry for the given entity. Calculates the changeset as
    the difference between entity and entityBefore. entityBefore only needs
    to be provided in the case of an update
      
    For creation, entity is the entity after creation.
    For update, entity is the entity after updating, entityBefore must be provided and is the entity before updating.
    For removal, entity is the entity state before removal, entityBefore should not be provided.
  */
  async createChangeEntry<T extends ObjectLiteral>(entity: T, action: ChangeAction, entityBefore?: T) {
    const options: ITrackChangesOptions = Reflect.getMetadata("__track_changes_options", entity.constructor);

    let columns = this.manager.connection.getMetadata(entity.constructor).ownColumns;
    if (options.except)
      columns = columns.filter(c => !(options.except || []).includes(c.propertyName));
    if (options.only)
      columns = columns.filter(c => (options.only || []).includes(c.propertyName));
    if (options.ignoresTimestamps)
      columns = columns.filter(c => !c.isUpdateDate && !c.isCreateDate && !c.isDeleteDate)

    // NOTE(justin): for update events we track object changes
    let changes: any = {}
    if (entityBefore) {
      columns.forEach(c => {
        const before = c.getEntityValue(entityBefore);
        const after = c.getEntityValue(entity);

        if (before != after) {
          changes[c.propertyName] = [before, after];
        }
      });
    }

    // NOTE(justin): When there are no changes, we bail out. This is usually
    // because we are using `except` syntax for the decorator and an ignored
    // property was changed.
    if (action === ChangeAction.UPDATE && Object.keys(changes).length === 0) {
      return;
    }

    // NOTE(justin): Serialized state of entity before change occurred.
    let obj = null;
    if (action === ChangeAction.UPDATE) {
      obj = this.serializeEntity(columns, entityBefore);
    } else if (action === ChangeAction.DESTROY) {
      obj = this.serializeEntity(columns, entity);
    }

    const change = new Change();
    change.itemType = entity.constructor.name;
    change.itemId = this.getEntityPK(entity);
    change.json = obj;
    change.action = action;
    change.changes = changes;
    change.who = Change.currentUserId;
    change.whoDisplay = Change.currentUserDisplay;
    await this.manager.save(change);

    if (ChangeRepository.options.maxChangesPerEntityInstance != null) {
      const offset = Math.max(ChangeRepository.options.maxChangesPerEntityInstance - 1, 0);
      const startOfRecordsToDelete = await this.manager
        .createQueryBuilder(Change, 'change')
        .where('change.itemId = :itemId', { itemId: change.itemId })
        .andWhere('change.itemType = :itemType', { itemType: change.itemType })
        .orderBy('change.createdAt', 'DESC')
        .offset(offset)
        .limit(1)
        .getOne();

      if (startOfRecordsToDelete) {
        await this.manager.getRepository(Change).delete({
          createdAt: LessThanOrEqual(startOfRecordsToDelete.createdAt)
        });
      }
    }
  }

  changeLogQuery<T extends ObjectLiteral>(entity: T) {
    return this.manager
      .createQueryBuilder(Change, 'change')
      .where('change.itemId = :itemId', { itemId: this.getEntityPK(entity) })
      .andWhere('change.itemType = :itemType', { itemType: entity.constructor.name })
      .orderBy('change.createdAt', 'DESC')
  }

  async lastChange<T extends ObjectLiteral>(entity: T) {
    return await this.changeLogQuery(entity).limit(1).getOneOrFail();
  }

  async firstChange<T extends ObjectLiteral>(entity: T) {
    return await this
      .changeLogQuery(entity)
      .orderBy('"createdAt"', 'ASC')
      .limit(1)
      .getOneOrFail();
  }

  async version(change: Change) {
    return this.count({
      where: {
        itemType: change.itemType,
        itemId: change.itemId,
        createdAt: LessThan(change.createdAt)
      },
    });
  }

  async polymorphicGet<T extends ObjectLiteral>(itemType: string, itemId: number) : Promise<T> {
    const itemKlass = this.itemTypeToEntityType(itemType);
    return this.manager.findOne(itemKlass, itemId);
  }

  async revert(change: Change) {
    const itemKlass = this.itemTypeToEntityType(change.itemType);

    await this.manager.transaction(async transactionManager => {
      // NOTE(justin): have to actually retrieve a copy of our current
      // repository just because we need to get it off of the
      // transactionManager since typeorm transactions are not global...
      const transactedChangeRepository = transactionManager.getCustomRepository(ChangeRepository);

      if (change.json) {
        // this is either a delete or update event, so we basically upsert the entity here.

        let item = transactedChangeRepository.retreiveEntityBeforeChange(change);
        let oldItem = await transactionManager.getRepository(itemKlass).findOne(change.itemId);
        if (oldItem) {
          await transactionManager.getRepository(itemKlass).update({ id: change.itemId }, item);

          // TODO(justin): get rid of this bs hackery
          await transactedChangeRepository.doCrazyTownManyToOneFix(itemKlass, item, change);
          await transactedChangeRepository.createChangeEntry(item, ChangeAction.UPDATE, oldItem as unknown);
        } else {
          let entity = transactionManager.getRepository(itemKlass).create(item);
          let newEntity = await transactionManager.save(entity);
          
          // NOTE(justin): this is a gross hack because primary key generated
          // columns can't be disabled
          if (change.itemId != newEntity['id']) {
            await transactionManager.update(itemKlass, { id: newEntity['id'] }, { id: change.itemId });
          }

          // TODO(justin): get rid of this bs hackery
          await transactedChangeRepository.doCrazyTownManyToOneFix(itemKlass, item, change);
          await transactedChangeRepository.createChangeEntry(item, ChangeAction.CREATE);
        }
      } else {
        // this is a create event, so we basically just need to delete the entity.
        let item = await transactionManager.getRepository(itemKlass).findOne(change.itemId);
        let deleted = await transactionManager.delete(itemKlass, { id: change.itemId });
        // if nothing was deleted then we cannot undo this create event.
        if (deleted.affected) {
          await transactedChangeRepository.createChangeEntry(item, ChangeAction.DESTROY);
        }
      }
    });
  }

  async next(change: Change) {
    return this.findOne({
      where: {
        id: Not(change.id),
        createdAt: MoreThan(change.createdAt),
        itemId: change.itemId,
        itemType: change.itemType,
      },
      order: {
        createdAt: 'ASC',
      }
    });
  }

  async previous(change: Change) {
    return this.findOne({
      where: {
        id: Not(change.id),
        createdAt: LessThan(change.createdAt),
        itemId: change.itemId,
        itemType: change.itemType,
      },
      order: {
        createdAt: 'DESC',
      }
    });
  }

  //
  // private
  //
  private async doCrazyTownManyToOneFix<T extends ObjectLiteral>(itemKlass: Function, item: T, change: Change) {
    // NOTE(justin): this is another gross hack because typeorm is just
    // all over the place. how the **** am I supposed to update an
    // ManyToOne relationship without having to actually query that
    // entity?
    let updatesNeeded = [];
    for (const column of this.manager.connection.getMetadata(itemKlass).ownColumns) {
      if(column.relationMetadata?.isManyToOne) {
        if (item[column.propertyName]) {
          updatesNeeded.push({
            value: item[column.propertyName],
            databaseName: column.databaseName
          });
        }
      }
    }

    if (updatesNeeded.length > 0) {
      let counter = 1;
      let setString = updatesNeeded.map(u => `"${u.databaseName}" = $${counter++}`).join(' ');
      await this.manager.query(`
          UPDATE "${this.manager.connection.getMetadata(itemKlass).tableName}"
          SET ${setString}
          WHERE id = $${counter}
        `, [...updatesNeeded.map(u => u.value), change.itemId]
      );
    }
  }

  private itemTypeToEntityType(itemType: string): Function | null {
    for (const table of getMetadataArgsStorage().tables) {
      if (itemType == (table.target as Function).name) {
        let itemKlass = (table.target as Function);
        return itemKlass;
      }
    }

    return null;
  }

  private serializeEntity<T extends ObjectLiteral>(columns: ColumnMetadata[], entity: T) {
    if (ChangeRepository.options.customSerializer) {
      return ChangeRepository.options.customSerializer(columns, entity);
    }

    return columns.reduce((acc, c) => {
      return { ...acc, [c.propertyName]: c.getEntityValue(entity) };
    }, {});
  }
}
