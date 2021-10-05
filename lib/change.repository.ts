import { ClassConstructor, plainToClass } from 'class-transformer';
import { EntityRepository, getMetadataArgsStorage, LessThan, MoreThan, Not, ObjectLiteral, Repository } from 'typeorm';
import { ITrackChangesOptions } from './change.decorator';
import { ChangeAction, Change } from './change.entity';

@EntityRepository(Change)
export class ChangeRepository extends Repository<Change> {
  getEntityPK<T extends ObjectLiteral>(entity: T) {
    let pks = this.manager.connection.getMetadata(entity.constructor).primaryColumns.map(p => p.getEntityValue(entity))
    return pks.join(':::');
  }

  async createAuditEntry<T extends ObjectLiteral>(entity: T, action: ChangeAction, databaseEntity?: any) {
    const options: ITrackChangesOptions = Reflect.getMetadata("__Change_options", entity.constructor);

    let columns = this.manager.connection.getMetadata(entity.constructor).ownColumns;
    if (options.except)
      columns = columns.filter(c => !(options.except || []).includes(c.propertyName));
    if (options.only)
      columns = columns.filter(c => (options.only || []).includes(c.propertyName));

    // NOTE(justin): serialized new object
    let obj = columns.reduce((acc, c) => {
      return { ...acc, [c.propertyName]: c.getEntityValue(entity) };
    }, {});

    // NOTE(justin): object changes
    let changes: any = {}
    if (databaseEntity) {
      columns.forEach(c => {
        const before = c.getEntityValue(databaseEntity);
        const after = c.getEntityValue(entity);

        if (before != after) {
          changes[c.propertyName] = [before, after];
        }
      });
    }

    const audit = new Change();
    audit.itemType = entity.constructor.name;
    audit.itemId = this.getEntityPK(entity);
    audit.json = obj;
    audit.action = action;
    audit.changes = changes;
    audit.who = Change.currentUserId;
    await this.manager.save(audit);
  }

  auditHistoryQuery<T extends ObjectLiteral>(entity: T) {
    return this
      .createQueryBuilder()
      .where('"Change"."itemId" = :itemId', { itemId: this.getEntityPK(entity) })
      .andWhere('"Change"."itemType" = :itemType', { itemType: entity.constructor.name })
      .orderBy('"Change"."createdAt"', 'DESC')
  }

  async lastAudit<T extends ObjectLiteral>(entity: T) {
    return await this.auditHistoryQuery(entity).limit(1).getOneOrFail();
  }

  async firstAudit<T extends ObjectLiteral>(entity: T) {
    return await this
      .auditHistoryQuery(entity)
      .orderBy('"createdAt"', 'ASC')
      .limit(1)
      .getOneOrFail();
  }



  async version(audit: Change) {
    return this.count({
      where: {
        itemType: audit.itemType,
        itemId: audit.itemId,
        createdAt: LessThan(audit.createdAt)
      },
    });
  }

  async polymorphicGet(itemType: string, itemId: number) {
    for (const table of getMetadataArgsStorage().tables) {
      if (itemType == (table.target as Function).name) {
        let itemKlass = (table.target as Function);
        const itemRepository = this.manager.getRepository(itemKlass as ClassConstructor<typeof itemKlass>);
        return await itemRepository.findOne({ where: { id: itemId } });
      }
    }
  }

  async revert(audit: Change) {
    for (const table of getMetadataArgsStorage().tables) {
      if (audit.itemType == (table.target as Function).name) {
        let itemKlass = (table.target as Function);
        let item = plainToClass(itemKlass as ClassConstructor<typeof itemKlass>, audit.json);

        this.manager.transaction(async (transactionManager) => {
          await transactionManager.update(itemKlass, {id: audit.itemId}, item);
          await transactionManager.delete(itemKlass, {
            id: Not(audit.id),
            createdAt: MoreThan(audit.createdAt),
          });
        });

        break;
      }
    }
  }

  async next(audit: Change) {
    return this.findOneOrFail({
      where: {
        id: Not(audit.id),
        createdAt: MoreThan(audit.createdAt),
        itemId: audit.itemId,
        itemType: audit.itemType,
      },
      order: {
        createdAt: 'ASC',
      }
    });
  }

  async previous(audit: Change) {
    return this.findOneOrFail({
      where: {
        id: Not(audit.id),
        createdAt: LessThan(audit.createdAt),
        itemId: audit.itemId,
        itemType: audit.itemType,
      },
      order: {
        createdAt: 'DESC',
      }
    });
  }
}
