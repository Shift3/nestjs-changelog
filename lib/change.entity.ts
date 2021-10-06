import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum ChangeAction {
  CREATE  = 'create',
  UPDATE  = 'update',
  DESTROY = 'destroy',
}

@Entity()
@Index("polymorphic_fk_index", ["itemId", "itemType"])
export class Change extends BaseEntity {
  public static currentUserId: string | null;
  public static currentUserDisplay: string | null;

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  itemId: string;

  @Column()
  itemType: string;

  @Column({ type: 'json', nullable: true })
  json: object;

  @Column({ type: 'json' })
  changes: object;

  @Column({ nullable: true })
  who: string;

  @Column({ nullable: true })
  whoDisplay: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column()
  action: ChangeAction;
}
